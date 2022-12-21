function initialise(parameters, requestor, alert, die) {

    const request = requestor({
        messages: e => {
            if (e.response.status >= 400) return `Received code ${e.response.status}`
        }
    })

    function locate(entries) {
        const maximumResults = parameters.maximumResults || 1
        const queries = entries.map((entry, i) => {
            const companyName = entry.data[parameters.companyNameField]
            if (!companyName) return // have to skip, ideally would log an error
            const companyJurisdiction = parameters.jurisdiction || entry.data[parameters.companyJurisdictionField] || null
            return [`q${i}`, {
                query: companyName,
                ...(companyJurisdiction ? { jurisdiction_code: companyJurisdiction } : {}),
                limit: maximumResults
            }]
        })
        return {
            url: 'https://opencorporates.com/reconcile',
            method: 'POST',
            dataForm: {
                queries: Object.fromEntries(queries)
            },
            passthrough: {
                entries
            }
        }
    }

    function parse(response) {
        return Object.entries(response.data).filter(entry => typeof entry[1] !== 'number').map(([, entry]) => { // filter out duration key
            const companies = entry.result
            return companies.map(company => {
                return {
                    companyJurisdiction: company.id.match(/companies\/(.+)\//)[1],
                    companyNumber: company.id.match(/companies\/.+\/(.+)/)[1],
                    companyName: company.name
                }
            })
        })
    }

    async function run(inputs) {
        const dataLocated = locate(inputs)
        const dataLocatedRequested = await request(dataLocated)
        const dataParsed = parse(dataLocatedRequested)
        return dataParsed
    }

    return run

}

const details = {
    batch: 10,
    parameters: [
        { name: 'jurisdiction', description: 'If all companies have the same jurisdiction you can specify it here instead of in a column. Use ISO 3166-2 format. [optional]' },
        { name: 'companyNameField', description: 'Company name column.' },
        { name: 'companyJurisdictionField', description: 'Jurisdiction code column, if any. It should use ISO 3166-2 format. [optional]' },
        { name: 'maximumResults', description: 'Maximum number of results to include for each name. [optional, default: 1]' }
    ],
    columns: [
        { name: 'companyJurisdiction' },
        { name: 'companyNumber' },
        { name: 'companyName' }
    ]
}

export default { initialise, details }
