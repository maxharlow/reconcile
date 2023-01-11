import Cheerio from 'cheerio'

function initialise(parameters, requestor, alert) {

    const request = requestor({
        messages: e => {
            if (e.response.status >= 400) return `received code ${e.response.status}`
        }
    })

    function locate(entry) {
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
        if (!response) return
        const document = Cheerio.load(response.data)
        if (document('.label-danger').text().trim() === 'No record found!') {
            alert({
                identifier: `MMSI ${shipMMSINumber}`,
                message: 'no record found',
                importance: 'error'
            })
            return
        }
        return {
            identifier: `MMSI ${response.passthrough.shipMMSINumber}`,
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
        if (!response) return
        const document = Cheerio.load(response.data)
        return {
            shipName: document('label').eq(0).text().trim(),
            shipCallSign: document('label').eq(1).text().trim(),
            shipIdentificationNumber: document('label').eq(22).text().trim(),
            shipOwner: document('label').eq(18).text().trim(),
            shipFormerName: document('label').eq(19).text().trim() || null,
            shipTonnage: document('label').eq(23).text().trim() || null,
            shipPersonCapacity: document('label').eq(24).text().trim() || null
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
        {
            name: 'shipMMSINumberField',
            description: 'Ship MMSI number column.',
            required: true
        }
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
