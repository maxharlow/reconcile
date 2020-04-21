const Cheerio = require('cheerio')

function initialise(parameters, requestor, die) {

    const request = requestor(Infinity, e => {
        if (e.response.status >= 400 && e.config.passthrough.titleNumber) return `Received code ${e.response.status} for title ${e.config.passthrough.titleNumber}`
    })

    function form(entry) {
        const titleNumber = entry[parameters.titleNumberField || 'titleNumber']
        if (!titleNumber) throw new Error('No title number found')
        return {
            url: 'https://eservices.landregistry.gov.uk/wps/portal/Property_Search',
            passthrough: {
                titleNumber
            }
        }
    }

    function locate(response) {
        const document = Cheerio.load(response.data)
        const action = document('form').attr('action')
        return {
            url: `https://eservices.landregistry.gov.uk${action}`,
            method: 'POST',
            qs: {
                titleNo: response.passthrough.titleNumber,
                enquiryType: 'detailed'
            },
            passthrough: {
                titleNumber: response.passthrough.titleNumber
            }
        }
    }

    function parse(response) {
        const document = Cheerio.load(response.data)
        const failure = document('.w80p').get().length === 0
        if (failure) throw new Error(`Could not find title ${response.passthrough.titleNumber}`)
        return {
            titleAddress: document('.w80p').eq(0).contents().get().filter(x => x.type === 'text').map(x => x.data.trim()).join(', '),
            titleTenure: document('.w80p').eq(1).text().trim()
        }
    }

    async function run(input) {
        const dataFormed = form(input)
        const dataFormedRequested = await request(dataFormed)
        const dataLocated = locate(dataFormedRequested)
        const dataLocatedRequested = await request(dataLocated)
        const dataParsed = parse(dataLocatedRequested)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        { name: 'titleNumberField', description: 'Title number field. [optional, default: "titleNumber"]' }
    ],
    columns: [
        { name: 'titleAddress' },
        { name: 'titleTenure', description: 'Leasehold or freehold.' }
    ]
}

module.exports = { initialise, details }
