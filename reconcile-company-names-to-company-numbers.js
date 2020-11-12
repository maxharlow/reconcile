function initialise(parameters, requestor, die) {

    const request = requestor(Infinity, e => {
        const company = e.config.passthrough.companyName + (e.config.passthrough.companyJurisdiction ? ` (${e.config.passthrough.companyJurisdiction.toUpperCase()})` : '')
        if (e.response.status === 403) die('The rate limit has been reached')
        if (e.response.status === 401) die(`Invalid API token ${e.config.params.api_token}`)
        if (e.response.status >= 400) return `Received code ${e.response.status} for company ${company}`
    })

    function locate(entry) {
        if (!parameters.apiToken) die('No API token found')
        const apiVersion = 'v0.4.8'
        const companyName = entry[parameters.companyNameField || 'companyName']
        const companyJurisdiction = parameters.jurisdiction || entry[parameters.companyJurisdictionField || 'companyJurisdiction']
        const maximumResults = parameters.maximumResults || 1
        if (!companyName) throw new Error('No company name found')
        return {
            url: `https://api.opencorporates.com/${apiVersion}/companies/search`,
            params: {
                q: companyName,
                normalise_company_name: 'true',
                jurisdiction_code: companyJurisdiction,
                api_token: parameters.apiToken,
                per_page: maximumResults
            },
            passthrough: {
                companyName,
                companyJurisdiction
            }
        }
    }

    function parse(response) {
        if (response.data.results.companies.length === 0) {
            const company = response.passthrough.companyName + (response.passthrough.companyJurisdiction ? ` (${response.passthrough.companyJurisdiction.toUpperCase()})` : '')
            throw new Error(`Could not find company ${company}`)
        }
        const companies = response.data.results.companies
        return companies.map(company => {
            return {
                companyJurisdiction: company.company.jurisdiction_code,
                companyNumber: company.company.company_number,
                companyName: company.company.name
            }
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
        { name: 'apiToken', description: 'An OpenCorporates API token.' },
        { name: 'jurisdiction', description: 'If all companies have the same jurisdiction you can specify it here instead of in a column. Use ISO 3166-2 format. [optional]' },
        { name: 'companyNameField', description: 'Company name column. [optional, default: "companyName"]' },
        { name: 'companyJurisdictionField', description: 'Jurisdiction code column, if any. It should use ISO 3166-2 format. [optional, default: "companyJurisdiction"]' },
        { name: 'maximumResults', description: 'Maximum number of results to include for each name. [optional, default: 1, maximum 30, or 100 with an API token]' }
    ],
    columns: [
        { name: 'companyJurisdiction' },
        { name: 'companyNumber' },
        { name: 'companyName' }
    ]
}

export default { initialise, details }
