import Axios from 'axios'
import Querystring from 'querystring'
import Cheerio from 'cheerio'

function initialise(parameters, requestor, alert) {

    const request = requestor({
        messages: e => {
            const ship = e.config.passthrough.shipMMSINumber
            if (e.response.headers.connection === 'close') throw new Error('The rate limit has been reached (Equasis allows about 500 per day)')
            if (e.response.status >= 400) return `Received code ${e.response.status} for ship ${ship}`
        }
    })

    async function login() {
        try {
            const response = await Axios({
                method: 'POST',
                url: 'http://www.equasis.org/EquasisWeb/authen/HomePage',
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
        const shipMMSINumber = entry.data[parameters.shipMMSINumberField]
        if (!shipMMSINumber) {
            alert({
                message: `No ship MMSI number found on line ${entry.line}`,
                importance: 'error'
            })
            return
        }
        return {
            url: 'http://www.equasis.org/EquasisWeb/restricted/Search',
            method: 'POST',
            dataQuery: {
                P_PAGE_SHIP: 1,
                P_MMSI: shipMMSINumber,
                buttonAdvancedSearch: 'advancedOk'
            },
            headers: {
                cookie: key
            },
            passthrough: {
                shipMMSINumber
            }
        }
    }

    function parse(response) {
        if (!response) return
        const document = Cheerio.load(response.data)
        if (document('.modal-body').text().trim() === 'No result has been found with your criteria.') {
            alert({
                message: `No results found for MMSI ${response.passthrough.shipMMSINumber}`,
                importance: 'error'
            })
            return
        }
        return {
            shipIMONumber: document('#ShipResultId .hidden-sm th a').text().trim(),
            shipName: document('#ShipResultId .hidden-sm td:nth-of-type(1)').text().trim(),
            shipTonnage: document('#ShipResultId .hidden-sm td:nth-of-type(2)').text().trim(),
            shipType: document('#ShipResultId .hidden-sm td:nth-of-type(3)').text().trim(),
            shipBuildYear: document('#ShipResultId .hidden-sm td:nth-of-type(4)').text().trim(),
            shipFlag: document('#ShipResultId .hidden-sm td:nth-of-type(5)').text().trim().replace(/\s+/g, ' ')
        }
    }

    async function run(input) {
        const key = await login()
        const dataLocated = locate(input, key)
        const dataLocatedRequested = await request(dataLocated)
        const dataParsed = parse(dataLocatedRequested)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        { name: 'email', description: 'The email address for a registered Equasis account.' },
        { name: 'password', description: 'The password for a registered Equasis account' },
        { name: 'shipMMSINumberField', description: 'Ship MMSI number column.' }
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