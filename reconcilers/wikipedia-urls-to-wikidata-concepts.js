import Cheerio from 'cheerio'

function initialise(parameters, requestor, alert) {

    const request = requestor({
        messages: e => {
            const url = e.config.passthrough.url
            if (e.response.status >= 400) return `Received code ${e.response.status} for URL "${url}"`
        }
    })

    function locate(entry) {
        if (!parameters.urlField) throw new Error('No URL field found!')
        const url = entry.data[parameters.urlField]
        if (!url) {
            alert({
                message: `No URL found on line ${entry.line}`,
                importance: 'error'
            })
            return
        }
        return {
            url,
            passthrough: {
                url
            }
        }
    }

    function parse(response) {
        if (!response) return
        const document = Cheerio.load(response.data)
        const wikidataConcept = document('#t-wikibase a').attr('href')
        if (!wikidataConcept) {
            alert({
                message: `No Wikidata concept found for URL: "${response.passthrough.url}"`,
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
        { name: 'urlField', description: 'URL column.' }
    ],
    columns: [
        { name: 'wikidataConceptID' }
    ]
}

export default { initialise, details }
