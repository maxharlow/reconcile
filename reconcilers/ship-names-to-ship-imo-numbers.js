import Axios from 'axios'
import Querystring from 'querystring'
import Cheerio from 'cheerio'

function initialise(parameters, requestor, die) {

    const request = requestor(Infinity, e => {
        const ship = e.config.passthrough.shipName
        if (e.response.headers.connection === 'close') die('The rate limit has been reached (Equasis allows about 500 per day)')
        if (e.response.status >= 400) return `Received code ${e.response.status} for ship ${ship}`
    })

    async function login() {
        try {
            const response = await Axios({
                url: 'http://www.equasis.org/EquasisWeb/authen/HomePage',
                method: 'POST',
                validateStatus: status => (status >= 200 && status < 300) || status === 404,
                data: Querystring.stringify({
                    j_email: parameters.email,
                    j_password: parameters.password
                })
            })
            if (response.status === 404) throw new Error('Credentials are incorrect')
            const value = response.headers['set-cookie'][0].split(';')[0]
            return value
        }
        catch (e) {
            throw new Error(`Could not log in! ${e.message}`)
        }
    }

    function locate(entry, key) {
        const shipName = entry[parameters.shipNameField]
        if (!shipName) throw new Error('No ship name found')
        return {
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
                key
            }
        }
    }

    async function paginate(response) {
        const document = Cheerio.load(response.data)
        const hasMorePages = document('.pagination').length
        if (hasMorePages) {
            const pageTotal = Number(document('.pagination li:last-of-type a').attr('onclick').match(/value=([0-9+])/)[1])
            const pageNumbers = Array.from(Array(pageTotal).keys()).map(i => i + 1).slice(1) // slice off first page as we already have that
            const pageRequests = pageNumbers.map(async page => {
                const query = {
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
                        shipName: response.passthrough.shipName
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
        { name: 'email', description: 'The email address for a registered Equasis account.' },
        { name: 'password', description: 'The password for a registered Equasis account' },
        { name: 'shipNameField', description: 'Ship name field.' }
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
