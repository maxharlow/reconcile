function initialise(parameters, requestor, alert) {

    const request = requestor({
        messages: e => {
            if (e.response.status === 404) return 'could not find company'
            if (e.response.status === 403) throw new Error('the rate limit has been reached')
            if (e.response.status === 401) throw new Error(`API token ${e.config.params.api_token} is invalid`)
            if (e.response.status >= 400) return `received code ${e.response.status}`
        }
    })

    function locate(entry) {
        const apiVersion = 'v0.4.8'
        const companyNumber = entry.data[parameters.companyNumberField]
        const companyJurisdiction = parameters.jurisdiction || entry.data[parameters.companyJurisdictionField]
        if (!companyNumber || companyNumber.match(/^0+$/)) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no company number found',
                importance: 'error'
            })
            return
        }
        if (!companyJurisdiction) {
            alert({
                identifier: `Company ${companyNumber}`,
                message: 'no jurisdiction found',
                importance: 'error'
            })
            return
        }
        return {
            identifier: `Company ${companyNumber} (${companyJurisdiction})`,
            url: `https://api.opencorporates.com/${apiVersion}/companies/${companyJurisdiction}/${companyNumber}`,
            params: {
                api_token: parameters.apiToken
            },
            passthrough: {
                companyNumber,
                companyJurisdiction
            }
        }
    }

    function parse(response) {
        if (!response) return
        const company = response.data.results.company
        return {
            companyJurisdiction: company.jurisdiction_code,
            companyName: company.name,
            companyIncorporationDate: company.incorporation_date,
            companyDissolutionDate: company.dissolution_date,
            companyType: company.company_type,
            companyStatus: company.current_status,
            companyAddress: company.registered_address_in_full ? company.registered_address_in_full.replace(/\n/g, ', ') : null,
            companyPreviousNames: company.previous_names.map(name => name.company_name).join('; ') || null,
            companyAlternativeNames: company.alternative_names.map(name => name.company_name).join('; ') || null,
            companyBeneficialOwners: company.ultimate_beneficial_owners.map(owner => owner.ultimate_beneficial_owner.name).join('; ') || null,
            companyAgentName: company.agent_name || null,
            companyAgentAddress: company.agent_address || null,
            companyIndustry: company.industry_codes.map(code => `${code.industry_code.description} [${code.industry_code.code}] (${code.industry_code.code_scheme_name})`).join('; ') || null
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
        {
            name: 'apiToken',
            description: 'An OpenCorporates API token.',
            required: true
        },
        {
            name: 'companyNumberField',
            description: 'Company number column.',
            required: true
        },
        {
            name: 'companyJurisdictionField',
            description: 'Jurisdiction code column, if any. It should use ISO 3166-2 format. Required unless jurisdiction is specified.'
        },
        {
            name: 'jurisdiction',
            description: 'If all companies have the same jurisdiction you can specify it here instead of in a column. Required unless companyJurisdictionField is specified.'
        }
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
