import Util from 'util'
import DNS from 'dns'

function initialise(parameters, _, die) {

    async function request(url) {
        const domain = url.replace(/https?:\/\/(www\.)?/, '').split('/')[0]
        const records = await Util.promisify(DNS.resolve)(domain, parameters.recordType || 'A')
        return records.map(record => {
            return { record }
        })
    }

    function locate(entry) {
        const url = entry[parameters.urlField]
        if (!url) throw new Error('No URL found')
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
        { name: 'urlField', description: 'URL column.' },
        { name: 'recordType', description: 'Type of records to retrieve [optional, default: A]' }
    ],
    columns: [
        { name: 'record' }
    ]
}

export default { initialise, details }
