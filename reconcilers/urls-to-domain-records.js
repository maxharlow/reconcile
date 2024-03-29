import Util from 'util'
import DNS from 'dns'

function initialise(parameters, _, alert) {

    async function request(url) {
        const domain = url.replace(/https?:\/\/(www\.)?/, '').split('/')[0]
        try {
            const records = await Util.promisify(DNS.resolve)(domain, parameters.recordType || 'A')
            return records.map(record => {
                return { record }
            })
        }
        catch (e) {
            alert({
                identifier: url,
                message: 'no domain record found',
                importance: 'error'
            })
            return
        }
    }

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
        return url
    }

    function parse(response) {
        return response
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
            name: 'recordType',
            description: 'Type of records to retrieve.',
            defaults: 'A'
        }
    ],
    columns: [
        { name: 'record' }
    ]
}

export default { initialise, details }
