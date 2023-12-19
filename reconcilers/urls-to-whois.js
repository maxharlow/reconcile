import Util from 'util'
import DNS from 'dns'
import Net from 'net'

function initialise(parameters, _, alert) {

    async function request(url) {
        const domain = url.replace(/https?:\/\/(www\.)?/, '').split('/')[0]
        const server = domain.substring(domain.lastIndexOf('.') + 1) + '.whois-servers.net'
        const addresses = await Util.promisify(DNS.resolveCname)(server)
        const host = addresses[0] || server
        alert({
            identifier: url,
            source: host,
            message: 'requesting...'
        })
        try {
            let data = ''
            const socket = Net.createConnection(43, host, () => {
	            socket.write(`${domain}\r\n`, 'ascii')
            })
            socket.setEncoding('ascii')
            socket.on('data', chunk => data = data + chunk)
            const output = await new Promise((resolve, reject) => {
                socket.on('error', e => reject(e))
                socket.on('close', hadError => {
	                if (hadError) return
                    alert({
                        identifier: url,
                        source: host,
                        message: 'done'
                    })
                    resolve({
                        data,
                        passthrough: { url }
                    })
                })
            })
            return output
        }
        catch (e) {
            alert({
                identifier: url,
                source: host,
                message: e.message,
                importance: 'error'
            })
            return null
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
        if (!response) return
        if (!response.data) {
            alert({
                identifier: response.passthrough.url,
                message: 'no response',
                importance: 'error'
            })
            return
        }
        if (!parameters.lineMatch) return { data: response.data }
        const data = response.data.split('\n').filter(line => line.match(parameters.lineMatch)).map(line => line.trim()).join('\n')
        if (!data) {
            alert({
                identifier: response.passthrough.url,
                message: 'no line matches',
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
