import Cheerio from 'cheerio'

function initialise(parameters, requestor, alert, die) {

    const request = requestor({
        messages: e => {
            const ship = e.config.passthrough.shipMMSINumber
            if (e.response.status >= 400) return `Received code ${e.response.status} for ship ${ship}`
        }
    })

    function locate(entry) {
        const shipMMSINumber = entry.data[parameters.shipMMSINumberField]
        if (!shipMMSINumber) throw new Error(`No ship MMSI number found on line ${entry.line}`)
        return {
            url: 'https://www.itu.int/mmsapp/ShipStation/list',
            method: 'POST',
            dataQuery: {
                'Search.MaritimeMobileServiceIdentity': shipMMSINumber,
                viewCommand: 'Search'
            },
            passthrough: {
                shipMMSINumber
            }
        }
    }

    function details(response) {
        const document = Cheerio.load(response.data)
        return {
            url: 'https://www.itu.int/mmsapp/ShipStation/list',
            method: 'POST',
            dataQuery: {
                onview: document('[title="View Ship Station"]').attr('value')
            },
            passthrough: {
                shipMMSINumber: response.passthrough.shipMMSINumber
            }
        }
    }

    function parse(response) {
        const document = Cheerio.load(response.data)
        return {
            shipName: document('label').eq(0).text().trim(),
            shipCallSign: document('label').eq(1).text().trim(),
            shipIdentificationNumber: document('label').eq(22).text().trim(),
            shipOwner: document('label').eq(18).text().trim(),
            shipFormerName: document('label').eq(19).text().trim(),
            shipTonnage: document('label').eq(23).text().trim(),
            shipPersonCapacity: document('label').eq(24).text().trim()
        }
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataDetailed = details(dataLocatedRequested)
        const dataDetailedRequested = await request(dataDetailed)
        const dataParsed = parse(dataDetailedRequested)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        { name: 'shipMMSINumberField', description: 'Ship MMSI number column.' }
    ],
    columns: [
        { name: 'shipName' },
        { name: 'shipCallSign' },
        { name: 'shipIdentificationNumber' },
        { name: 'shipOwner' },
        { name: 'shipFormerName' },
        { name: 'shipTonnage' },
        { name: 'shipPersonCapacity' }
    ]
}

export default { initialise, details }
