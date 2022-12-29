function initialise(parameters, requestor, alert) {

    const request = requestor({
        messages: e => {
            const concepts = e.config.passthrough.wikidataConceptIDs
            if (e.response.status >= 400) return `Received code ${e.response.status} for concepts: ${concepts}`
        }
    })

    function locate(entries) {
        const wikidataConceptIDs = entries.map(entry => {
            const wikidataConceptID = entry.data[parameters.wikidataConceptIDField]
            if (!wikidataConceptID) throw new Error(`No Wikidata concept ID field found on line ${entry.line}`)
            return wikidataConceptID
        })
        return {
            url: 'https://www.wikidata.org/w/api.php',
            params: {
                action: 'wbgetentities',
                props: 'claims',
                languages: 'en',
                format: 'json',
                ids: wikidataConceptIDs.join('|')
            },
            passthrough: {
                wikidataConceptIDs
            }
        }
    }

    function parse(response) {
        return Object.values(response.data.entities).map(entity => {
            const claim = entity.claims[parameters.wikidataProperty]
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
        { name: 'wikidataConceptIDField', description: 'Concept ID column.' },
        { name: 'wikidataProperty', description: 'Wikidata property to extract.' }
    ],
    columns: [
        { name: 'value' }
    ]
}

export default { initialise, details }
