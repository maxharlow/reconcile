import Util from 'util'
import DNS from 'dns'
import Net from 'net'

function initialise(parameters, _, die) {

    async function request(url) {
        const domain = url.replace(/https?:\/\/(www\.)?/, '').split('/')[0]
        const server = domain.substring(domain.lastIndexOf('.') + 1) + '.whois-servers.net'
        const addresses = await Util.promisify(DNS.resolveCname)(server)
        const host = addresses[0] || server
        let data = ''
        const socket = Net.createConnection(43, host, () => {
	        socket.write(`${domain}\r\n`, 'ascii')
        })
        socket.setEncoding('ascii')
        socket.on('data', chunk => data = data + chunk)
        return new Promise((resolve, reject) => {
            socket.on('error', e => reject(e))
            socket.on('close', hadError => {
	            if (!hadError) resolve({
                    data,
                    passthrough: { url }
                })
            })
        })
    }

    function locate(entry) {
        const url = entry[parameters.urlField]
        if (!url) throw new Error('No URL found')
        return url
    }

    function parse(response) {
        if (!parameters.lineMatch) return { data: response.data }
        const data = response.data.split('\n').filter(line => line.match(parameters.lineMatch)).map(line => line.trim()).join('\n')
        if (!data) throw new Error(`No line matches for URL ${response.passthrough.url}`)
        return { data }
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
        { name: 'lineMatch', description: 'Filter lines to only those matching [optional]' }
    ],
    columns: [
        { name: 'data' }
    ]
}

export default { initialise, details }
