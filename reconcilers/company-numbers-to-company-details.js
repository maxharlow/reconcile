function initialise(parameters, requestor, die) {

    const request = requestor({
        messages: e => {
            const company = `${e.config.passthrough.companyNumber} (${e.config.passthrough.companyJurisdiction.toUpperCase()})`
            if (e.response.status === 404) return `Could not find company ${company}`
            if (e.response.status === 403) die('The rate limit has been reached' + (e.config.params.api_token ? '' : ' -- try using an API token'))
            if (e.response.status === 401) die(`Invalid API token ${e.config.params.api_token || ''}`)
            if (e.response.status >= 400) return `Received code ${e.response.status} for company ${company}`
        }
    })

    function locate(entry) {
        const apiVersion = 'v0.4.8'
        const companyNumber = entry.data[parameters.companyNumberField]
        const companyJurisdiction = parameters.jurisdiction || entry.data[parameters.companyJurisdictionField]
        if (!companyNumber || companyNumber.match(/^0+$/)) throw new Error(`No company number found on line ${entry.line}`)
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
        const company = response.data.results.company
        return {
            companyJurisdiction: company.jurisdiction_code,
            companyName: company.name,
            companyIncorporationDate: company.incorporation_date,
            companyDissolutionDate: company.dissolution_date,
            companyType: company.company_type,
            companyStatus: company.current_status,
            companyAddress: company.registered_address_in_full ? company.registered_address_in_full.replace(/\n/g, ', ') : null,
            companyPreviousNames: company.previous_names.map(name => name.company_name).join('; '),
            companyAlternativeNames: company.alternative_names.join('; '),
            companyBeneficialOwners: company.ultimate_beneficial_owners.map(owner => owner.ultimate_beneficial_owner.name).join('; '),
            companyAgentName: company.agent_name,
            companyAgentAddress: company.agent_address,
            companyIndustry: company.industry_codes.map(code => `${code.industry_code.description} [${code.industry_code.code}] (${code.industry_code.code_scheme_name})`).join('; ')
        }
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        if (!dataLocatedRequested) return null
        const dataParsed = parse(dataLocatedRequested)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        { name: 'apiToken', description: 'An OpenCorporates API token. You are limited to 500 requests per month otherwise. [optional]' },
        { name: 'jurisdiction', description: 'If all companies have the same jurisdiction you can specify it here instead of in a column. Use ISO 3166-2 format. Required unless companyJurisdictionField is specified.' },
        { name: 'companyNumberField', description: 'Company number column.' },
        { name: 'companyJurisdictionField', description: 'Jurisdiction code column, if any. It should use ISO 3166-2 format. Required unless jurisdiction is specified.' }
    ],
    columns: [
        { name: 'companyJurisdiction' },
        { name: 'companyName' },
        { name: 'companyIncorporationDate' },
        { name: 'companyDissolutionDate' },
        { name: 'companyType' },
        { name: 'companyStatus' },
        { name: 'companyAddress' },
        { name: 'companyPreviousNames' },
        { name: 'companyAlternativeNames' },
        { name: 'companyBeneficialOwners' },
        { name: 'companyAgentName' },
        { name: 'companyAgentAddress' },
        { name: 'companyIndustry' }
    ]
}

export default { initialise, details }
