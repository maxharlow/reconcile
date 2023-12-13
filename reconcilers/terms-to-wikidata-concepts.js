function initialise(parameters, requestor, alert) {

    const request = requestor({
        errors: response => {
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
            url: 'https://www.wikidata.org/w/api.php',
            params: {
                action: 'wbsearchentities',
                type: 'item',
                language: 'en',
                limit: 50,
                format: 'json',
                search: term
            },
            passthrough: {
                term,
                page: 1
            }
        }
    }

    async function paginate(response, responses = []) {
        if (!response) return
        const hasMorePages = response.data.search.length === 50
        if (parameters.includeAll && hasMorePages) {
            const page = responses.length
            const query = {
                identifier: `"${response.passthrough.term}"`,
                url: response.url,
                params: {
                    action: 'wbsearchentities',
                    type: 'item',
                    language: 'en',
                    limit: 50,
                    format: 'json',
                    search: response.passthrough.term,
                    continue: (page + 1) * 50
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
        return response.data.search.map(result => {
            return {
                wikidataConceptID: result.id,
                wikidataConceptLabel: result.label
            }
        })
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataLocatedPaginated = await paginate(dataLocatedRequested)
        if (!dataLocatedPaginated) return
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
            name: 'includeAll',
            description: 'Set true to include all URLs, instead of just the first.',
            defaults: 'first 50 only'
        }
    ],
    columns: [
        { name: 'wikidataConceptID' },
        { name: 'wikidataConceptLabel' }
    ]
}

export default { initialise, details }
