function initialise(parameters, requestor, alert) {

    const request = requestor({
        errors: response => {
            if (response.status >= 400) return { message: `received code ${response.status}`, retry: true }
        }
    })

    function locate(entries) {
        const wikidataConceptIDs = entries.map(entry => {
            const wikidataConceptID = entry.data[parameters.wikidataConceptIDField]
            if (!wikidataConceptID) throw new Error(`Line ${entry.line}: no Wikidata concept ID found`)
            return wikidataConceptID
        })
        return {
            identifier: wikidataConceptIDs.join(', '),
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
        if (response.data.error) {
            alert({
                identifier: response.passthrough.wikidataConceptIDs.join(', '),
                message: response.data.error.info.charAt(0).toLowerCase() + response.data.error.info.slice(1),
                importance: 'error'
            })
            return null
        }
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
        {
            name: 'wikidataConceptIDField',
            description: 'Concept ID column.',
            required: true
        },
        {
            name: 'wikidataProperty',
            description: 'Wikidata property to extract.',
            required: true
        }
    ],
    columns: [
        { name: 'value' }
    ]
}

export default { initialise, details }
