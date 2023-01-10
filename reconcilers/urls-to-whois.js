import Util from 'util'
import DNS from 'dns'
import Net from 'net'

function initialise(parameters, _, alert) {

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
        const url = entry.data[parameters.urlField]
        if (!url) {
            alert({
                message: `No URL found on line ${entry.line}`,
                importance: 'error'
            })
            return
        }
        return url
    }

    function parse(response) {
        if (!response) return
        if (!response.data) {
            alert({
                message: `No response for URL ${response.passthrough.url}`,
                importance: 'error'
            })
            return
        }
        if (!parameters.lineMatch) return { data: response.data }
        const data = response.data.split('\n').filter(line => line.match(parameters.lineMatch)).map(line => line.trim()).join('\n')
        if (!data) {
            alert({
                message: `No line matches for URL ${response.passthrough.url}`,
                importance: 'error'
            })
            return
        }
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
        {
            name: 'urlField',
            description: 'URL column.',
            required: true
        },
        {
            name: 'lineMatch',
            description: 'Filter lines to only those matching.'
        }
    ],
    columns: [
        { name: 'data' }
    ]
}

export default { initialise, details }
