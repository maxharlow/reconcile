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
        const document = Cheerio.load(response.data)
        return parameters.elements.map(element => {
            if (!element.key) throw new Error(`element has no key: ${JSON.stringify(element)}`)
            if (!element.selector) throw new Error(`element has no selector: ${JSON.stringify(element)}`)
            const selection = document(element.selector)
            if (!selection) {
                alert({
                    identifier: response.passthrough.url,
                    message: `could not select "${element.selector}"`,
                    importance: 'error'
                })
                return
            }
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
        {
            name: 'urlField',
            description: 'URL column.',
            required: true
        },
        {
            name: 'elements',
            description: 'Array of objects containing two fields, key and selector.',
            required: true
        }
    ],
    columns: [
        { name: 'key' },
        { name: 'value' }
    ]
}

export default { initialise, details }
