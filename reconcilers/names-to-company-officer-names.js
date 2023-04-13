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
        const name = entry.data[parameters.nameField]
        const dateOfBirth = entry.data[parameters.dateOfBirthField]
        const jurisdiction = parameters.jurisdiction || entry.data[parameters.jurisdictionField]
        if (!name) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no name found',
                importance: 'error'
            })
            return
        }
        return {
            identifier: `"${name}"` + (jurisdiction ? ` (${jurisdiction})` : ''),
            url: `https://api.opencorporates.com/${apiVersion}/officers/search`,
            params: {
                q: name.trim(),
                ...(dateOfBirth ? { date_of_birth: dateOfBirth } : {}),
                ...(jurisdiction ? { jurisdiction_code: jurisdiction.trim() } : {}),
                api_token: parameters.apiToken,
                per_page: 100
            },
            passthrough: {
                name,
                dateOfBirth,
                jurisdiction,
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
                    identifier: `"${response.passthrough.name}"` + (response.passthrough.jurisdiction ? ` (${response.passthrough.jurisdiction})` : ''),
                    url: response.url,
                    params: {
                        q: response.passthrough.name.trim(),
                        date_of_birth: response.passthrough.dateOfBirth,
                        jurisdiction_code: response.passthrough.jurisdiction ? response.passthrough.jurisdiction.trim() : undefined,
                        api_token: parameters.apiToken,
                        per_page: 100,
                        page
                    },
                    passthrough: {
                        name: response.passthrough.name,
                        dateOfBirth: response.passthrough.dateOfBirth,
                        jurisdiction: response.passthrough.jurisdiction,
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
                identifier: `"${response.passthrough.name}"` + (response.passthrough.jurisdiction ? ` (${response.passthrough.jurisdiction})` : ''),
                message: 'could not find name',
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
            name: 'nameField',
            description: 'Name column.',
            required: true
        },
        {
            name: 'dateOfBirthField',
            description: 'Birth date column. It should use ISO 8601 format. For a range the two dates should be separated with a colon.'
        },
        {
            name: 'jurisdictionField',
            description: 'Jurisdiction code column, if any. It should use ISO 3166-2 format. Required unless jurisdiction is specified.'
        },
        {
            name: 'jurisdiction',
            description: 'If all officers have the same jurisdiction you can specify it here instead of in a column. Required unless jurisdictionField is specified.'
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
