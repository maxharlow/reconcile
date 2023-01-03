function initialise(parameters, requestor, alert) {

    const request = requestor({
        messages: e => {
            const term = e.config.passthrough.term
            const page = e.config.passthrough.page
            if (e.response.status >= 400) return `Received code ${e.response.status} for term "${term}" on page ${page}`
        }
    })

    function locate(entry) {
        if (!parameters.termField) {
            alert({
                message: 'No term field found!',
                importance: 'error'
            })
            return
        }
        const term = entry.data[parameters.termField]
        if (!term) {
            alert({
                message: `No term found on line ${entry.line}`,
                importance: 'error'
            })
            return
        }
        return {
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
        { name: 'termField', description: 'Term column.' },
        { name: 'includeAll', description: 'Set true to include all URLs, instead of just the first. [optional, default is first 50 only]' }
    ],
    columns: [
        { name: 'wikidataConceptID' },
        { name: 'wikidataConceptLabel' }
    ]
}

export default { initialise, details }
