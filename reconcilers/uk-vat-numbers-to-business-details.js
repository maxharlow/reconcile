import Axios from 'axios'
import * as Cheerio from 'cheerio'

function initialise(parameters, requestor, alert) {

    const request = requestor({
        errors: response => {
            if (response.status >= 400) return { message: `received code ${response.status}`, retry: true }
        }
    })

    async function locate(entry) {
        const vatNumber = entry.data[parameters.vatNumberField]
        if (!vatNumber) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no VAT number found',
                importance: 'error'
            })
            return
        }
        const initialResponse = await Axios({
            url: 'https://www.tax.service.gov.uk/check-vat-number/enter-vat-details',
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded'
            },
            data: `target=${vatNumber}`,
            validateStatus: status => status === 303,
            maxRedirects: 0 // don't follow redirect
        })
        const cookie = initialResponse.headers['set-cookie'].find(cookie => cookie.startsWith('mdtp=')).split(';')[0]
        return {
            identifier: vatNumber,
            url: `https://www.tax.service.gov.uk${initialResponse.headers.location}`,
            headers: {
                cookie
            },
            passthrough: {
                vatNumber
            },
            hashOmit: [
                'headers.cookie'
            ]
        }
    }

    function parse(response) {
        if (!response) return
        const document = Cheerio.load(response.data)
        if (document('h1').text().trim() === 'Invalid UK VAT number') {
            alert({
                identifier: response.passthrough.vatNumber,
                message: 'no business found',
                importance: 'error'
            })
            return
        }
        return {
            businessName: document('h3 + p:nth-of-type(1)').text(),
            businessAddress: document('h3 + p:nth-of-type(2)').text().split('\n').map(line => line.trim()).filter(x => x).join(', ')
        }
    }

    async function run(input) {
        const dataLocated = await locate(input)
        const dataLocatedRequested = await request(dataLocated)
        if (!dataLocatedRequested) return
        const dataParsed = parse(dataLocatedRequested)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        {
            name: 'vatNumberField',
            description: 'VAT number column.',
            required: true
        }
    ],
    columns: [
        { name: 'businessName' },
        { name: 'businessAddress' }
    ]
}

export default { initialise, details }
