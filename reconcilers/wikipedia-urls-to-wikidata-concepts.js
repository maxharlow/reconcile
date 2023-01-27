import Cheerio from 'cheerio'

function initialise(parameters, requestor, alert) {

    const request = requestor({
        messages: e => {
            if (e.response.status >= 400) return `received code ${e.response.status}`
        }
    })

    function locate(entry) {
        const wikipediaURL = entry.data[parameters.wikipediaURLField]
        if (!wikipediaURL) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no Wikipedia URL found',
                importance: 'error'
            })
            return
        }
        return {
            identifier: wikipediaURL,
            url: wikipediaURL,
            passthrough: {
                wikipediaURL
            }
        }
    }

    function parse(response) {
        if (!response) return
        const document = Cheerio.load(response.data)
        const wikidataConcept = document('#t-wikibase a').attr('href')
        if (!wikidataConcept) {
            alert({
                identifier: response.passthrough.wikipediaURL,
                message: 'no Wikidata concept found',
                importance: 'error'
            })
            return
        }
        return {
            wikidataConceptID: wikidataConcept.split('/').pop()
        }
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
    parameters: [
        {
            name: 'wikipediaURLField',
            description: 'Wikipedia URL column.'
        }
    ],
    columns: [
        { name: 'wikidataConceptID' }
    ]
}

export default { initialise, details }
