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
        const shipIMONumber = entry.data[parameters.shipIMONumberField]
        if (!shipIMONumber) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no ship IMO number found',
                importance: 'error'
            })
            return
        }
        return {
            identifier: `Ship ${shipIMONumber}`,
            url: 'http://www.equasis.org/EquasisWeb/restricted/ShipHistory',
            method: 'POST',
            dataQuery: {
                P_IMO: shipIMONumber
            },
            headers: {
                cookie: key
            },
            passthrough: {
                shipIMONumber
            }
        }
    }

    function parse(response) {
        if (!response) return
        const document = Cheerio.load(response.data)
        const formerNames = document('#collapse1 tbody .hidden-sm').get().map(row => {
            const element = Cheerio.load(row)
            const name = element('td:nth-of-type(1)').text().trim()
            const date = element('td:nth-of-type(2)').text().trim()
            return `${name} (${date})`
        })
        const formerFlags = document('#collapse2 tbody .hidden-sm').get().map(row => {
            const element = Cheerio.load(row)
            const name = element('td:nth-of-type(1)').text().trim()
            const date = element('td:nth-of-type(2)').text().trim()
            return `${name} (${date})`
        })
        const details = {
            shipName: document('h4 b:first-of-type').text().trim(),
            shipCallSign: document('.grey_white_boxes .access-body .row:nth-of-type(2) > div:nth-of-type(2)').text().trim(),
            shipMMSI: document('.grey_white_boxes .access-body .row:nth-of-type(3) > div:nth-of-type(2)').text().trim(),
            shipTonnage: document('.grey_white_boxes .access-body .row:nth-of-type(4) > div:nth-of-type(2)').text().trim(),
            shipDWT: document('.grey_white_boxes .access-body .row:nth-of-type(5) > div:nth-of-type(2)').text().trim(),
            shipType: document('.grey_white_boxes .access-body .row:nth-of-type(6) > div:nth-of-type(2)').text().trim(),
            shipBuildYear: document('.grey_white_boxes .access-body .row:nth-of-type(7) > div:nth-of-type(2)').text().trim(),
            shipFlag: document('.grey_white_boxes .access-body .row:nth-of-type(1) > div:nth-of-type(4)').text().trim().slice(1, -1),
            shipStatus: document('.grey_white_boxes .access-body .row:nth-of-type(8) > div:nth-of-type(2)').text().trim(),
            shipFormerNames: formerNames.join('; '),
            shipFormerFlags: formerFlags.join('; ')
        }
        const companies = document('#collapse4 tbody tr.hidden-sm').get()
        return companies.map(company => {
            const element = Cheerio.load(company)
            return {
                ...details,
                shipCompanyRole: element('td:nth-of-type(2)').text().trim(),
                shipCompanyName: element('td:nth-of-type(1)').text().trim(),
                shipCompanyDate: element('td:nth-of-type(3)').text().trim()
            }
        })
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
            name: 'shipIMONumberField',
            description: 'Ship IMO number (or ship name) column.',
            required: true
        }
    ],
    columns: [
        { name: 'shipName' },
        { name: 'shipCallSign' },
        { name: 'shipMMSI' },
        { name: 'shipTonnage' },
        { name: 'shipDWT' },
        { name: 'shipType' },
        { name: 'shipBuildYear' },
        { name: 'shipFlag' },
        { name: 'shipStatus' },
        { name: 'shipFormerNames' },
        { name: 'shipFormerFlags' },
        { name: 'shipCompanyRole' },
        { name: 'shipCompanyName' },
        { name: 'shipCompanyDate' }
    ]
}

export default { initialise, details }
