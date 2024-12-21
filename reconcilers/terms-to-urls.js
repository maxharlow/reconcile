import * as Cheerio from 'cheerio'

function initialise(parameters, requestor, alert) {

    const request = requestor({
        limit: 1,
        errors: response => {
            if (response.status === 429) throw new Error('the rate limit has been reached')
            if (response.status >= 400) return { message: `received code ${response.status} on page ${response.config.passthrough.page}`, retry: true }
        }
    })

    function locate(entry) {
        const term = entry.data[parameters.termField]
        if (!term) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no term found',
                importance: 'error'
            })
            return
        }
        return {
            identifier: `"${term}"`,
            url: 'https://www.google.com/search',
            headers: {
                'user-agent': 'Reconcile'
            },
            params: {
                q: parameters.supplement ? `${parameters.supplement} ${term}` : term
            },
            passthrough: {
                term,
                page: 1
            }
        }
    }

    async function paginate(response, responses = []) {
        if (!response) return
        const document = Cheerio.load(response.data)
        const hasMorePages = document('[aria-label="Next page"]').length
        if (parameters.includeAll && hasMorePages) {
            const page = responses.length
            const query = {
                identifier: `"${response.passthrough.term}"`,
                url: response.url,
                headers: {
                    'user-agent': 'Reconcile'
                },
                params: {
                    q: parameters.supplement ? `${parameters.supplement} ${term}` : response.passthrough.term,
                    start: (page + 1) * 10
                },
                passthrough: {
                    term: response.passthrough.term,
                    page: page + 1
                }
            }
            return paginate(await request(query), responses.concat(response))
        }
        else return responses.concat(response)
    }

    function parse(response) {
        if (!response) return
        const document = Cheerio.load(response.data)
        const results = document('#main > div > div > div > a[href^="/url"]')
        if (results.length === 0) {
            const term = parameters.supplement ? `${parameters.supplement} ${term}` : response.passthrough.term
            alert({
                identifier: `"${term}"`,
                message: 'could not find term',
                importance: 'error'
            })
            return []
        }
        return results.get().flatMap(element => {
            const result = Cheerio.load(element)
            if (result('h3').length === 0) return []
            return {
                resultTitle: result('h3').text().trim(),
                resultLocation: result('*').attr('href').split('/url?q=')[1].split('&sa')[0]
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
            name: 'termField',
            description: 'Term column.',
            required: true
        },
        {
            name: 'supplement',
            description: 'Extra terms to be included with the search.'
        },
        {
            name: 'includeAll',
            description: 'Set true to include all URLs, instead of just the first.',
            defaults: 'first page only'
        }
    ],
    columns: [
        { name: 'resultTitle' },
        { name: 'resultLocation' }
    ]
}

export default { initialise, details }
