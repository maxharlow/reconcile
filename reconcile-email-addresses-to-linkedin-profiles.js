const Axios = require('axios')
const Querystring = require('querystring')
const Cheerio = require('cheerio')

function initialise(parameters, requestor) {

    const request = requestor(Infinity, e => {
        const emailAddress = e.config.passthrough.emailAddress
        if (e.response.status >= 400) return `Received code ${e.response.status} for email ${emailAddress}`
    })

    async function login() {
        try {
            const preresponse = await Axios('https://www.linkedin.com/login')
            const token = preresponse.headers['set-cookie'].find(c => c.startsWith('bcookie')).split(/["&]/)[2]
            const response = await Axios({
                url: 'https://www.linkedin.com/checkpoint/lg/login-submit',
                method: 'POST',
                maxRedirects: 0,
                validateStatus: status => status < 400,
                headers: {
                    cookie: `bcookie=${token}; lidc=`
                },
                data: Querystring.stringify({
                    loginCsrfParam: token,
                    session_key: parameters.email,
                    session_password: parameters.password
                })
            })
            if (response.data.includes('not the right password')) throw new Error('Credentials are incorrect')
            const value = response.headers['set-cookie'].find(c => c.startsWith('li_at')).split(';')[0]
            login = () => value // memoise
            return value
        }
        catch (e) {
            throw new Error(`Could not log in! ${e.message}`)
        }
    }

    function locate(entry, key) {
        const emailAddress = entry[parameters.emailAddressField || 'emailAddress']
        if (!emailAddress) throw new Error('No email address found')
        return {
            url: `https://www.linkedin.com/sales/gmail/profile/viewByEmail/${emailAddress}`,
            headers: {
                cookie: key
            },
            passthrough: {
                emailAddress
            }
        }
    }

    function parse(response) {
        const document = Cheerio.load(response.data)
        const failure = document('.li-user-title-no-match').length > 0
        if (failure) return []
        return {
            individualName: document('#li-profile-name').text(),
            individualLinkedinProfile: decodeURIComponent(document('#profile-link').attr('href').split('=')[1]),
            individualLocation: document('.li-user-location').text(),
            company: document('.li-user-title-company').text(),
            companyLinkedinProfile: document('[data-tracking-control="anchor_company_profile"]').attr('href'),
            companyRole: document('.li-user-title').text().split(' at ')[0]
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
        { name: 'email', description: 'The email address for a registered LinkedIn account.' },
        { name: 'password', description: 'The password for a registered LinkedIn account.' },
        { name: 'emailAddressField', description: 'Email address field. [optional, default: "emailAddress"]' }
    ],
    columns: [
        { name: 'individualName' },
        { name: 'individualLinkedinProfile' },
        { name: 'individualLocation' },
        { name: 'company' },
        { name: 'companyLinkedinProfile' },
        { name: 'companyRole' }
    ]
}

module.exports = { initialise, details }
