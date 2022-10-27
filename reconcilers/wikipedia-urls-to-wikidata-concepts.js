import Cheerio from 'cheerio'

function initialise(parameters, requestor, die) {

    const request = requestor({
        messages: e => {
            const url = e.config.passthrough.url
            if (e.response.status >= 400) return `Received code ${e.response.status} for URL "${url}"`
        }
    })

    function locate(entry) {
        if (!parameters.urlField) die('No URL field found!')
        const url = entry.data[parameters.urlField]
        if (!url) throw new Error(`No URL found on line ${entry.line}`)
        return {
            url,
            passthrough: {
                url
            }
        }
    }

    function parse(response) {
        const document = Cheerio.load(response.data)
        const wikidataConcept = document('#t-wikibase a').attr('href')
        if (!wikidataConcept) throw new Error(`No Wikidata concept found for URL: "${response.passthrough.url}"`)
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
        { name: 'urlField', description: 'URL column.' }
    ],
    columns: [
        { name: 'wikidataConceptID' }
    ]
}

export default { initialise, details }
