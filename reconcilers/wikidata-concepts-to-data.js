function initialise(parameters, requestor, die) {

    const request = requestor({
        messages: e => {
            const concepts = e.config.passthrough.conceptIDs
            if (e.response.status >= 400) return `Received code ${e.response.status} for concept "${concepts}"`
        }
    })

    function locate(entries) {
        if (!parameters.conceptIDField) die('No concept ID field found')
        const conceptIDs = entries.map(entry => {
            return entry[parameters.conceptIDField]
        })
        return {
            url: 'https://www.wikidata.org/w/api.php',
            params: {
                action: 'wbgetentities',
                props: 'claims',
                languages: 'en',
                format: 'json',
                ids: conceptIDs.join('|')
            },
            passthrough: {
                conceptIDs
            }
        }
    }

    function parse(response) {
        if (!parameters.property) die('No property found')
        return Object.values(response.data.entities).map(entity => {
            const claim = entity.claims[parameters.property]
            if (!claim) return {
                value: null
            }
            const datavalue = claim[0].mainsnak.datavalue
            const value = datavalue.type === 'string' ? datavalue.value
                : datavalue.type === 'time' ? datavalue.value.time
                : null
            return {
                value
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
    batch: 50,
    parameters: [
        { name: 'conceptIDField', description: 'Concept ID column.' },
        { name: 'property', description: 'Wikidata property to extract.' }
    ],
    columns: [
        { name: 'value' }
    ]
}

export default { initialise, details }
