function initialise(parameters, requestor, die) {

    const request = requestor(Infinity, e => {
        const company = `${e.config.passthrough.companyNumber} (${e.config.passthrough.companyJurisdiction.toUpperCase()})`
        if (e.response.status === 404) return `Could not find company ${company}`
        if (e.response.status === 403) die('The rate limit has been reached' + (e.config.params.api_token ? '' : ' -- try using an API token'))
        if (e.response.status === 401) die(`Invalid API token ${e.config.params.api_token || ''}`)
        if (e.response.status >= 400) return `Received code ${e.response.status} for company ${company}`
    })

    function locate(entry) {
        const apiVersion = 'v0.4.8'
        const companyNumber = entry[parameters.companyNumberField || 'companyNumber']
        const companyJurisdiction = parameters.jurisdiction || entry[parameters.companyJurisdictionField || 'companyJurisdiction']
        if (!companyNumber) throw new Error('No company number found')
        if (!companyJurisdiction) throw new Error(`No jurisdiction found for company ${companyNumber}`)
        return {
            url: `https://api.opencorporates.com/${apiVersion}/companies/${companyJurisdiction}/${companyNumber}`,
            params: {
                ...(parameters.apiToken ? { api_token: parameters.apiToken } : {})
            },
            passthrough: {
                companyNumber,
                companyJurisdiction
            }
        }
    }

    function parse(response) {
        const officers = response.data.results.company.officers
        return officers.map(officer => {
            const fields = {
                companyName: response.data.results.company.name,
                officerName: officer.officer.name,
                officerPosition: officer.officer.position,
                officerStartDate: officer.officer.start_date,
                officerEndDate: officer.officer.end_date,
                officerNationality: officer.officer.nationality,
                officerOccupation: officer.officer.occupation
            }
            if (officer.officer.address !== undefined) fields.officerAddress = officer.officer.address.replace(/\n/g, ', ') // only if API token sent
            if (officer.officer.date_of_birth !== undefined) fields.officerDateOfBirth = officer.officer.date_of_birth // only if API token sent
            return fields
        })
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataParsed = parse(dataLocatedRequested)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        { name: 'apiToken', description: 'An OpenCorporates API token. You are limited to 500 requests per month otherwise. [optional]' },
        { name: 'jurisdiction', description: 'If all companies have the same jurisdiction you can specify it here instead of in a column. Use ISO 3166-2 format. [optional]' },
        { name: 'companyNumberField', description: 'Company number column. [optional, default: "companyNumber"]' },
        { name: 'companyJurisdictionField', description: 'Jurisdiction code column, if any. It should use ISO 3166-2 format. [optional, default: "companyJurisdiction"]' }
    ],
    columns: [
        { name: 'companyName' },
        { name: 'officerName' },
        { name: 'officerPosition' },
        { name: 'officerStartDate' },
        { name: 'officerEndDate' },
        { name: 'officerNationality' },
        { name: 'officerOccupation' },
        { name: 'officerAddress', description: 'Only if an API token is sent.' },
        { name: 'officerDateOfBirth', description: 'Only if an API token is sent.' }
    ]
}

module.exports = { initialise, details }
