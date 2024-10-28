import Axios from 'axios'
import Querystring from 'querystring'
import * as Cheerio from 'cheerio'

function initialise(parameters, requestor, alert) {

    const credentials = [parameters.credentials].flat()

    const credentialsRotated = (() => {
        let next = 0
        return () => {
            const credential = credentials[next]
            next = (next + 1) % credentials.length
            return credential
        }
    })()

    const request = requestor({
        errors: response => {
            if (response.headers.connection === 'close') throw new Error('the rate limit has been reached (Equasis allows about 500 per day)')
            if (response.status >= 400) return { message: `received code ${response.status} on page ${response.config.passthrough.page}`, retry: true }
        }
    })

    async function login() {
        try {
            const [email, password] = credentialsRotated().split(/:(.*)/)
            const response = await Axios({
                method: 'POST',
                url: 'http://www.equasis.org/EquasisWeb/authen/HomePage',
                validateStatus: status => (status >= 200 && status < 300) || status === 404,
                data: Querystring.stringify({
                    j_email: email,
                    j_password: password
                })
            })
            if (response.status === 404) throw new Error('Equasis credentials are incorrect')
            const value = response.headers['set-cookie'][0].split(';')[0]
            return value
        }
        catch (e) {
            throw new Error(`could not log in! ${e.message}`)
        }
    }

    function locate(entry, key) {
        const shipName = entry.data[parameters.shipNameField]
        if (!shipName) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no ship name found',
                importance: 'error'
            })
            return
        }
        return {
            identifier: `"${shipName}"`,
            url: 'http://www.equasis.org/EquasisWeb/restricted/Search',
            method: 'POST',
            dataQuery: {
                P_PAGE: 1,
                P_PAGE_SHIP: 1,
                P_ENTREE: shipName
            },
            headers: {
                cookie: key
            },
            passthrough: {
                shipName,
                key,
                page: 1
            }
        }
    }

    async function paginate(response) {
        if (!response) return
        const document = Cheerio.load(response.data)
        const hasMorePages = document('.pagination').length
        if (hasMorePages) {
            const pageTotal = Number(document('.pagination li:last-of-type a').attr('onclick').match(/value=([0-9+])/)[1])
            const pageNumbers = Array.from(Array(pageTotal).keys()).map(i => i + 1).slice(1) // slice off first page as we already have that
            const pageRequests = pageNumbers.map(async page => {
                const query = {
                    identifier: `"${response.passthrough.shipName}"`,
                    url: response.url,
                    method: 'POST',
                    dataQuery: {
                        P_PAGE: 1,
                        P_PAGE_SHIP: page,
                        P_ENTREE: response.passthrough.shipName
                    },
                    headers: {
                        cookie: response.passthrough.key
                    },
                    passthrough: {
                        shipName: response.passthrough.shipName,
                        page: page
                    }
                }
                return request(query)
            })
            const pageResponses = await Promise.all(pageRequests)
            return [response].concat(pageResponses)
        }
        else return [response]
    }

    function parse(response) {
        if (!response) return
        const document = Cheerio.load(response.data)
        const ships = document('[name=formShip] table tr.hidden-sm').get()
        return ships.map(ship => {
            const element = Cheerio.load(ship)
            return {
                shipIMONumber: element('th a').text().trim(),
                shipName: element('td:nth-of-type(1)').text().trim(),
                shipTonnage: element('td:nth-of-type(2)').text().trim(),
                shipType: element('td:nth-of-type(3)').text().trim(),
                shipBuildYear: element('td:nth-of-type(4)').text().trim(),
                shipFlag: element('td:nth-of-type(5)').text().trim().replace(/\s\s+/g, ' ')
            }
        })
    }

    async function run(input) {
        const key = await login()
        const dataLocated = locate(input, key)
        const dataLocatedRequested = await request(dataLocated)
        const dataLocatedPaginated = await paginate(dataLocatedRequested)
        const dataParsed = dataLocatedPaginated.flatMap(parse)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        {
            name: 'credentials',
            description: 'A email address and password pair, separated by a colon, for a registered Equasis account.',
            required: true
        },
        {
            name: 'shipNameField',
            description: 'Ship name column.',
            required: true
        }
    ],
    columns: [
        { name: 'shipIMONumber' },
        { name: 'shipName' },
        { name: 'shipTonnage' },
        { name: 'shipType' },
        { name: 'shipBuildYear' },
        { name: 'shipFlag' }
    ]
}

export default { initialise, details }
