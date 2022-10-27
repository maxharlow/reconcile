function initialise(parameters, requestor, die) {

    const request = requestor({
        messages: e => {
            const term = e.config.passthrough.term
            if (e.response.status >= 400) return `Received code ${e.response.status} for term "${term}"`
        }
    })

    function locate(entry) {
        if (!parameters.termField) die('No term field found!')
        const term = entry.data[parameters.termField]
        if (!term) throw new Error(`No term found on line ${entry.line}`)
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
                term
            }
        }
    }

    async function paginate(response, responses = []) {
        const hasMorePages = response.data.search.length === 50
        if (parameters.includeAll && hasMorePages) {
            const query = {
                url: response.url,
                params: {
                    action: 'wbsearchentities',
                    type: 'item',
                    language: 'en',
                    limit: 50,
                    format: 'json',
                    search: response.passthrough.term,
                    continue: (responses.length + 1) * 50
                },
                passthrough: {
                    term: response.passthrough.term
                }
            }
            return paginate(await request(query), responses.concat(response))
        }
        else return responses.concat(response)
    }

    function parse(response) {
        return response.data.search.map(result => {
            return {
                conceptID: result.id,
                conceptDescription: result.description
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
        { name: 'termField', description: 'Term column.' },
        { name: 'includeAll', description: 'Set true to include all URLs, instead of just the first. [optional, default is first 50 only]' }
    ],
    columns: [
        { name: 'wikidataConceptID' },
        { name: 'wikidataConceptDescription' }
    ]
}

export default { initialise, details }
