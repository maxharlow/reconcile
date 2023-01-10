import Cheerio from 'cheerio'

function initialise(parameters, requestor, alert) {

    const request = requestor({
        messages: e => {
            const wikipediaURL = e.config.passthrough.wikipediaURL
            if (e.response.status >= 400) return `Received code ${e.response.status} for Wikipedia URL "${wikipediaURL}"`
        }
    })

    function locate(entry) {
        const wikipediaURL = entry.data[parameters.wikipediaURLField]
        if (!wikipediaURL) {
            alert({
                message: `No Wikipedia URL found on line ${entry.line}`,
                importance: 'error'
            })
            return
        }
        return {
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
                message: `No Wikidata concept found for Wikipedia URL: "${response.passthrough.wikipediaURL}"`,
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
