function initialise(parameters, requestor, alert) {

    const request = requestor({
        errors: response => {
            if (response.status === 403) throw new Error('the rate limit has been reached')
            if (response.status >= 400) return { message: `received code ${response.status}`, retry: true }
        }
    })

    function locate(entries) {
        const maximumResults = parameters.maximumResults || 1
        const queries = entries.map((entry, i) => {
            const companyName = entry.data[parameters.companyNameField]
            if (!companyName) {
                alert({
                    identifier: `Line ${entry.line}`,
                    message: 'no company name found',
                    importance: 'error'
                })
                return
            }
            const companyJurisdiction = parameters.jurisdiction || entry.data[parameters.companyJurisdictionField] || null
            return [`q${i}`, {
                query: companyName,
                ...(companyJurisdiction ? { jurisdiction_code: companyJurisdiction } : {}),
                limit: maximumResults
            }]
        })
        return {
            identifier: ('"' + queries[0][1].query + '"' + (queries.length > 1 ? ' to ' + '"' + queries[entries.length - 1][1].query + '"' : '')),
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
        if (!response) return
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
        {
            name: 'companyNameField',
            description: 'Company name column.',
            required: true
        },
        {
            name: 'companyJurisdictionField',
            description: 'Jurisdiction code column, if any. It should use ISO 3166-2 format. Required unless jurisdiction is specified.'
        },
        {
            name: 'jurisdiction',
            description: 'If all companies have the same jurisdiction you can specify it here instead of in a column. Required unless companyJurisdictionField is specified.'
        },
        {
            name: 'maximumResults',
            description: 'Maximum number of results to include for each name.',
            defaults: '1'
        }
    ],
    columns: [
        { name: 'companyJurisdiction' },
        { name: 'companyNumber' },
        { name: 'companyName' }
    ]
}

export default { initialise, details }
