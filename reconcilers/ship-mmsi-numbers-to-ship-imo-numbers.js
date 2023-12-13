import Axios from 'axios'
import Querystring from 'querystring'
import Cheerio from 'cheerio'

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
            if (response.status >= 400) return { message: `received code ${response.status}`, retry: true }
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
        const shipMMSINumber = entry.data[parameters.shipMMSINumberField]
        if (!shipMMSINumber) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no ship MMSI number found',
                importance: 'error'
            })
            return
        }
        return {
            identifier: `MMSI ${shipMMSINumber}`,
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
                identifier: `MMSI ${response.passthrough.shipMMSINumber}`,
                message: 'no results found',
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
        {
            name: 'credentials',
            description: 'A email address and password pair, separated by a colon, for a registered Equasis account.',
            required: true
        },
        {
            name: 'shipMMSINumberField',
            description: 'Ship MMSI number column.',
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
