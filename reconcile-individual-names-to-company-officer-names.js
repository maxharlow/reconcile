function initialise(parameters, requestor) {

    const request = requestor.bind(null, (e, passthrough) => {
        const individual = passthrough.individualName + (passthrough.individualJurisdiction ? ` (${passthrough.individualJurisdiction.toUpperCase()})` : '')
        if (e.response.status === 403) throw new Error('The rate limit has been reached' + (e.config.params.api_token ? '' : '-- try using an API token'))
        if (e.response.status === 401) throw new Error(`API token ${e.config.params.api_token} is invalid`)
        if (e.response.status >= 400) throw new Error(`Received code ${e.response.status} for individual ${individual}`)
    })

    function locate(entry) {
        const apiVersion = 'v0.4.8'
        const individualName = entry[parameters.individualNameField || 'individualName']
        const individualDateOfBirth = entry[parameters.individualDateOfBirthField || 'individualDateOfBirth']
        const individualJurisdiction = parameters.jurisdiction || entry[parameters.individualJurisdictionField || 'individualJurisdiction']
        const maximumResults = parameters.maximumResults || 1
        if (!individualName) throw new Error('No individual name found')
        const url = `https://api.opencorporates.com/${apiVersion}/officers/search`
        return {
            url,
            params: {
                q: individualName.trim(),
                date_of_birth: individualDateOfBirth ? individualDateOfBirth : undefined,
                jurisdiction_code: individualJurisdiction ? individualJurisdiction.trim() : undefined,
                api_token: parameters.apiToken,
                per_page: maximumResults
            },
            passthrough: {
                individualName,
                individualJurisdiction
            }
        }
    }

    function parse(response) {
        if (response.data.results.officers.length === 0) {
            const individual = passthrough.individualName + (passthrough.individualJurisdiction ? ` (${passthrough.individualJurisdiction.toUpperCase()})` : '')
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
        const dataParsed = parse(dataLocatedRequested)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        { name: 'apiToken', description: 'An OpenCorporates API token. You are limited to 500 requests per month otherwise. [optional]' },
        { name: 'jurisdiction', description: 'If all individuals have the same jurisdiction you can specify it here instead of in a column. Use ISO 3166-2 format. [optional]' },
        { name: 'individualNameField', description: 'Individual name column. [optional, default: "individualName"]' },
        { name: 'individualDateOfBirthField', description: 'Individual birth date column. It should use ISO 8601 format. For a range the two dates should be separated with a colon. [optional, default: "individualDateOfBirth"]' },
        { name: 'individualJurisdictionField', description: 'Jurisdiction code column, if any. It should use ISO 3166-2 format. [optional, default: "individualJurisdiction"]' },
        { name: 'maximumResults', description: 'Maximum number of results to include for each name. [optional, default: 1, maximum 30, or 100 with an API token]' }
    ],
    columns: [
        { name: 'officerName' },
        { name: 'officerPosition' },
        { name: 'officerNationality' },
        { name: 'officerOccupation' },
        { name: 'officerAddress', description: 'Only if an API token is sent.' },
        { name: 'officerDateOfBirth', description: 'Only if an API token is sent.' },
        { name: 'companyName' },
        { name: 'companyNumber' },
        { name: 'companyJurisdiction' }
    ]
}

module.exports = { initialise, details }
