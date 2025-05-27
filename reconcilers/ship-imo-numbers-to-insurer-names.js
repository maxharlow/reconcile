import Axios from 'axios'
import Querystring from 'querystring'
import * as Cheerio from 'cheerio'
import * as HTMLEntities from 'html-entities'

function initialise(parameters, requestor, alert) {

    const request = requestor({
        errors: response => {
            if (response.status >= 400) return { message: `received code ${response.status}`, retry: true }
        }
    })

    async function locate(entry, key) {
        const shipIMONumber = entry.data[parameters.shipIMONumberField]
        if (!shipIMONumber) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no ship IMO number/name found',
                importance: 'error'
            })
            return
        }
        const tokenResponse = await Axios('https://www.igpandi.org/vessel-search/')
        const tokenDocument = Cheerio.load(tokenResponse.data)
        const token = tokenDocument('[name=csrfmiddlewaretoken]').attr('value')
        return {
            identifier: `Ship ${shipIMONumber}`,
            url: 'https://www.igpandi.org/vessel-search/',
            method: 'POST',
            dataQuery: {
                csrfmiddlewaretoken: token,
                q: shipIMONumber
            },
            headers: {
                referer: 'https://www.igpandi.org/vessel-search/',
                cookie: `csrftoken=${token}`
            },
            passthrough: {
                shipIMONumber
            },
            hashOmit: [
                'dataQuery.csrfmiddlewaretoken'
            ]
        }
    }

    function parse(response) {
        if (!response) return
        const document = Cheerio.load(response.data)
        if (document('.alert-info').text().trim().includes('search returned more than 20 results')) alert({
            identifier: `Ship ${response.passthrough.shipIMONumber}`,
            message: 'more than 20 results were found -- subsequent results are omitted',
            importance: 'warning'
        })
        const ships = document('.result-box').get()
        return ships.map(ship => {
            const element = Cheerio.load(ship)
            return {
                shipIMONumber: HTMLEntities.decode(element('dd:nth-of-type(1)').html().trim()),
                shipName: HTMLEntities.decode(element('h3 a').text().trim()),
                shipType: HTMLEntities.decode(element('dd:nth-of-type(2)').html().trim()),
                shipInsurerClub: HTMLEntities.decode(element('dd:nth-of-type(3)').html().trim()),
                shipInsurer: HTMLEntities.decode(element('dd:nth-of-type(4)').html().trim())
            }
        })
    }

    async function run(input) {
        const dataLocated = await locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataParsed = parse(dataLocatedRequested)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        {
            name: 'shipIMONumberField',
            description: 'Ship IMO number (or name) column.',
            required: true
        }
    ],
    columns: [
        { name: 'shipIMONumber' },
        { name: 'shipName' },
        { name: 'shipType' },
        { name: 'shipInsurerClub' },
        { name: 'shipInsurer' }
    ]
}

export default { initialise, details }
