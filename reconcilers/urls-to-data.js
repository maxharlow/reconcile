import Cheerio from 'cheerio'

function initialise(parameters, requestor, die) {

    const request = requestor(Infinity, e => {
        const url = e.config.passthrough.url
        if (e.response.status >= 400) return `Received code ${e.response.status} for URL "${url}"`
    })

    function locate(entry) {
        const url = entry[parameters.urlField]
        if (!url) throw new Error('No URL found')
        return {
            url,
            passthrough: {
                url
            }
        }
    }

    function parse(response) {
        const document = Cheerio.load(response.data)
        return parameters.elements.map(element => {
            if (!element.key) die(`Element has no key: ${JSON.stringify(element)}`)
            if (!element.selector) die(`Element has no selector: ${JSON.stringify(element)}`)
            const selection = document(element.selector)
            if (!selection) throw new Error(`Could not select "${element.selector}"`)
            return {
                key: element.key,
                value: selection.text().trim().replace(/\n/g, '')
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
    parameters: [
        { name: 'urlField', description: 'URL column.' },
        { name: 'elements', description: 'Array of objects containing two fields, key and selector.' }
    ],
    columns: [
        { name: 'key' },
        { name: 'value' }
    ]
}

export default { initialise, details }
