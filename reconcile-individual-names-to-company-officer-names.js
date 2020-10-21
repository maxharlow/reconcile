function initialise(parameters, requestor, die) {

    const request = requestor(Infinity, e => {
        const individual = e.config.passthrough.individualName + (e.config.passthrough.individualJurisdiction ? ` (${e.config.passthrough.individualJurisdiction.toUpperCase()})` : '')
        if (e.response.status === 403) die('The rate limit has been reached')
        if (e.response.status === 401) die(`Invalid API token ${e.config.params.api_token}`)
        if (e.response.status >= 400) return `Received code ${e.response.status} for individual ${individual} [page ${e.config.passthrough.page}]`
    })

    function locate(entry) {
        if (!parameters.apiToken) die('No API token found')
        const apiVersion = 'v0.4.8'
        const individualName = entry[parameters.individualNameField || 'individualName']
        const individualDateOfBirth = entry[parameters.individualDateOfBirthField || 'individualDateOfBirth']
        const individualJurisdiction = parameters.jurisdiction || entry[parameters.individualJurisdictionField || 'individualJurisdiction']
        if (!individualName) throw new Error('No individual name found')
        return {
            url: `https://api.opencorporates.com/${apiVersion}/officers/search`,
            params: {
                q: individualName.trim(),
                date_of_birth: individualDateOfBirth,
                jurisdiction_code: individualJurisdiction ? individualJurisdiction.trim() : undefined,
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
            const individual = response.passthrough.individualName + (response.passthrough.individualJurisdiction ? ` (${response.passthrough.individualJurisdiction.toUpperCase()})` : '')
            throw new Error(`Could not find individual ${individual}`)
        }
        const officers = response.data.results.officers
        return officers.map(officer => {
            const fields = {
                officerName: officer.officer.name,
                officerPosition: officer.officer.position,
                officerStartDate: officer.officer.start_date,
                officerEndDate: officer.officer.end_date,
                officerNationality: officer.officer.nationality,
                officerOccupation: officer.officer.occupation,
                companyName: officer.officer.company.name,
                companyNumber: officer.officer.company.company_number,
                companyJurisdiction: officer.officer.company.jurisdiction_code
            }
            if (officer.officer.address !== undefined) fields.officerAddress = officer.officer.address.replace(/\n/g,', ') // only if API key sent
            if (officer.officer.date_of_birth !== undefined) fields.officerDateOfBirth = officer.officer.date_of_birth // only if API key sent
            return fields
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
        { name: 'apiToken', description: 'An OpenCorporates API token.' },
        { name: 'jurisdiction', description: 'If all individuals have the same jurisdiction you can specify it here instead of in a column. Use ISO 3166-2 format. [optional]' },
        { name: 'individualNameField', description: 'Individual name column. [optional, default: "individualName"]' },
        { name: 'individualDateOfBirthField', description: 'Individual birth date column. It should use ISO 8601 format. For a range the two dates should be separated with a colon. [optional, default: "individualDateOfBirth"]' },
        { name: 'individualJurisdictionField', description: 'Jurisdiction code column, if any. It should use ISO 3166-2 format. [optional, default: "individualJurisdiction"]' }
    ],
    columns: [
        { name: 'officerName' },
        { name: 'officerPosition' },
        { name: 'officerNationality' },
        { name: 'officerOccupation' },
        { name: 'officerAddress' },
        { name: 'officerDateOfBirth' },
        { name: 'companyName' },
        { name: 'companyNumber' },
        { name: 'companyJurisdiction' }
    ]
}

module.exports = { initialise, details }
