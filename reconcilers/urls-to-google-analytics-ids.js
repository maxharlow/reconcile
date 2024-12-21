import * as Cheerio from 'cheerio'

function initialise(parameters, requestor, alert) {

    const request = requestor({
        errors: response => {
            if (response.status >= 400) return { message: `received code ${response.status}`, retry: true }
        }
    })

    function locate(entry) {
        const url = entry.data[parameters.urlField]
        if (!url) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no URL found',
                importance: 'error'
            })
            return
        }
        return {
            identifier: url,
            url,
            passthrough: {
                url
            }
        }
    }

    function parse(response) {
        if (!response) return
        const regex = /(?<="|')[A-Z][A-Z]?-[A-Z0-9]{4,10}(?=\-[0-9]+)/ig
        const document = Cheerio.load(response.data)
        return document('script').get().flatMap(element => {
            const script = Cheerio.load(element)('*').text()
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
        {
            name: 'urlField',
            description: 'URL column.',
            required: true
        }
    ],
    columns: [
        { name: 'googleAnalyticsID' }
    ]
}

export default { initialise, details }
