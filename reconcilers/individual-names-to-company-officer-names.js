function initialise(parameters, requestor, alert) {

    const request = requestor({
        messages: e => {
            if (e.response.status === 403) throw new Error('the rate limit has been reached')
            if (e.response.status === 401) throw new Error(`API token ${e.config.params.api_token} is invalid`)
            if (e.response.status >= 400) return `received code ${e.response.status} on page ${e.config.passthrough.page}`
        }
    })

    function locate(entry) {
        const apiVersion = 'v0.4.8'
        const individualName = entry.data[parameters.individualNameField]
        const individualDateOfBirth = entry.data[parameters.individualDateOfBirthField]
        const individualJurisdiction = parameters.jurisdiction || entry.data[parameters.individualJurisdictionField]
        if (!individualName) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no individual name found',
                importance: 'error'
            })
            return
        }
        return {
            identifier: `"${individualName}"` + (individualJurisdiction ? ` (${individualJurisdiction})` : ''),
            url: `https://api.opencorporates.com/${apiVersion}/officers/search`,
            params: {
                q: individualName.trim(),
                ...(individualDateOfBirth ? { date_of_birth: individualDateOfBirth } : {}),
                ...(individualJurisdiction ? { jurisdiction_code: individualJurisdiction.trim() } : {}),
                api_token: parameters.apiToken,
                per_page: 100
            },
            passthrough: {
                individualName,
                individualDateOfBirth,
                individualJurisdiction,
                page: 1
            }
        }
    }

    async function paginate(response) {
        if (response.data.results.total_count > 100) {
            const pageTotal = response.data.results.total_pages
            const pageNumbers = Array.from(Array(pageTotal).keys()).slice(1) // slice off first page as we already have that
            const pageRequests = pageNumbers.map(async page => {
                const query = {
                    identifier: `"${response.passthrough.individualName}"` + (response.passthrough.individualJurisdiction ? ` (${response.passthrough.individualJurisdiction})` : ''),
                    url: response.url,
                    params: {
                        q: response.passthrough.individualName.trim(),
                        date_of_birth: response.passthrough.individualDateOfBirth,
                        jurisdiction_code: response.passthrough.individualJurisdiction ? response.passthrough.individualJurisdiction.trim() : undefined,
                        api_token: parameters.apiToken,
                        per_page: 100,
                        page
                    },
                    passthrough: {
                        individualName: response.passthrough.individualName,
                        individualDateOfBirth: response.passthrough.individualDateOfBirth,
                        individualJurisdiction: response.passthrough.individualJurisdiction,
                        page
                    }
                }
                return request(query)
            })
            const pageResponses = await Promise.all(pageRequests)
            return [response].concat(pageResponses)
        }
        else return [response]
    }

    function parse(response) {
        if (response.data.results.officers.length === 0) {
            alert({
                identifier: `"${individualName}"` + (individualJurisdiction ? ` (${individualJurisdiction})` : ''),
                message: 'could not find individual',
                importance: 'error'
            })
            return
        }
        const officers = response.data.results.officers
        return officers.map(officer => {
            return {
                officerName: officer.officer.name,
                officerPosition: officer.officer.position,
                officerStartDate: officer.officer.start_date,
                officerEndDate: officer.officer.end_date,
                officerNationality: officer.officer.nationality,
                officerOccupation: officer.officer.occupation,
                officerAddress: officer.officer.address ? officer.officer.address.replace(/\n/g,', ') : null,
                officerDateOfBirth: officer.officer.date_of_birth,
                companyName: officer.officer.company.name,
                companyNumber: officer.officer.company.company_number,
                companyJurisdiction: officer.officer.company.jurisdiction_code
            }
        })
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataLocatedPaginated = await paginate(dataLocatedRequested)
        const dataParsed = dataLocatedPaginated.flatMap(parse)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        {
            name: 'apiToken',
            description: 'An OpenCorporates API token.',
            required: true
        },
        {
            name: 'individualNameField',
            description: 'Individual name column.',
            required: true
        },
        {
            name: 'individualDateOfBirthField',
            description: 'Individual birth date column. It should use ISO 8601 format. For a range the two dates should be separated with a colon.'
        },
        {
            name: 'individualJurisdictionField',
            description: 'Jurisdiction code column, if any. It should use ISO 3166-2 format. Required unless jurisdiction is specified.'
        },
        {
            name: 'jurisdiction',
            description: 'If all individuals have the same jurisdiction you can specify it here instead of in a column. Required unless individualJurisdictionField is specified.'
        }
    ],
    columns: [
        { name: 'officerName' },
        { name: 'officerPosition' },
        { name: 'officerStartDate' },
        { name: 'officerEndDate' },
        { name: 'officerNationality' },
        { name: 'officerOccupation' },
        { name: 'officerAddress' },
        { name: 'officerDateOfBirth' },
        { name: 'companyName' },
        { name: 'companyNumber' },
        { name: 'companyJurisdiction' }
    ]
}

export default { initialise, details }
