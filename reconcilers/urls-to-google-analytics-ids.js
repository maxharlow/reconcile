import Cheerio from 'cheerio'

function initialise(parameters, requestor, die) {

    const request = requestor({
        messages: e => {
            const url = e.config.passthrough.url
            if (e.response.status >= 400) return `Received code ${e.response.status} for URL "${url}"`
        }
    })

    function locate(entry) {
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
        if (!response) return []
        const regex = /(?<="|')[A-Z][A-Z]?-[A-Z0-9]{4,10}(?=\-[0-9]+)/ig
        const document = Cheerio.load(response.data)
        return document('script').get().flatMap(element => {
            const script = Cheerio(element).text()
            if (!script.includes('google-analytics.com')) return []
            return Array.from(new Set(script.matchAll(regex) || [])).map(([googleAnalyticsID]) => {
                return {
                    googleAnalyticsID
                }
            })
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
    parameters: [
        { name: 'urlField', description: 'URL column.' }
    ],
    columns: [
        { name: 'googleAnalyticsID' }
    ]
}

export default { initialise, details }
