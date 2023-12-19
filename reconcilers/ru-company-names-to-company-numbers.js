function initialise(parameters, requestor, alert) {

    const request = requestor({
        limit: 0.99,
        errors: response => {
            if (response.data.status === 'wait') return { message: 'search not complete', retry: true }
            if (response.data.ERRORS) return { message: Object.values(response.data.ERRORS).join('; '), retry: true }
            if (response.status >= 400) return { message: `received code ${response.status}`, retry: true }
        }
    })

    function locate(entry) {
        const companyName = entry.data[parameters.companyNameField]
        if (!companyName) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no company name found',
                importance: 'error'
            })
            return
        }
        return {
            identifier: `"${companyName}"`,
            url: 'https://egrul.nalog.ru/',
            method: 'POST',
            dataRaw: {
                query: companyName
            },
            passthrough: {
                companyName,
                page: 1
            }
        }
    }

    function details(response) {
        return {
            identifier: `"${response.passthrough.companyName}"`,
            url: `https://egrul.nalog.ru/search-result/${response.data.t}`,
            passthrough: {
                companyName: response.passthrough.companyName
            }
        }
    }

    async function paginate(response) {
        if (!response) return
        const maximumResults = parameters.maximumResults || Infinity
        if (response.data.rows.length > 0 && response.data.rows[0].tot > 20) {
            const pageTotal = Math.ceil(Math.min(response.data.rows[0].tot, maximumResults) / 20)
            const pageNumbers = Array.from(Array(pageTotal).keys()).map(i => i + 1).slice(1) // slice off first page as we already have that
            const pageRequests = pageNumbers.map(async page => {
                const locateQuery = {
                    identifier: `"${response.passthrough.companyName}"`,
                    url: 'https://egrul.nalog.ru/',
                    method: 'POST',
                    dataRaw: {
                        query: response.passthrough.companyName,
                        page
                    },
                    passthrough: {
                        companyName: response.passthrough.companyName,
                        page
                    }
                }
                const locateResponse = await request(locateQuery)
                if (!locateResponse) return null
                const detailsQuery = {
                    identifier: `"${response.passthrough.companyName}"`,
                    url: `https://egrul.nalog.ru/search-result/${locateResponse.data.t}`,
                    passthrough: {
                        companyName: response.passthrough.companyName,
                        page
                    }
                }
                return request(detailsQuery)
            })
            const pageResponses = await Promise.all(pageRequests)
            return [response].concat(pageResponses)
        }
        else return [response]
    }

    function parse(response) {
        if (!response) return
        const maximumResults = parameters.maximumResults || Infinity
        return response.data.rows.slice(0, maximumResults).map(result => {
            return {
                companyNumber: result.i,
                companyName: result.n,
                companyAddress: result.a
            }
        })
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataDetailed = details(dataLocatedRequested)
        const dataDetailedRequested = await request(dataDetailed)
        const dataDetailedPaginated = await paginate(dataDetailedRequested)
        const dataParsed = dataDetailedPaginated.flatMap(parse)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        {
            name: 'companyNameField',
            description: 'Company name (or OGRN company number) column.',
            required: true
        },
        {
            name: 'maximumResults',
            description: 'Maximum number of results to include for each entity.',
            defaults: 'all'
        }
    ],
    columns: [
        { name: 'companyNumber', description: '(INN)' },
        { name: 'companyName' },
        { name: 'companyAddress' }
    ]
}

export default { initialise, details }
