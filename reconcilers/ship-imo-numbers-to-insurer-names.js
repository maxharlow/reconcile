import Axios from 'axios'
import Querystring from 'querystring'
import Cheerio from 'cheerio'
import HTMLEntities from 'html-entities'

function initialise(parameters, requestor, alert) {

    const request = requestor({
        messages: e => {
            const ship = e.config.passthrough.shipIMONumber
            if (e.response.status >= 400) return `Received code ${e.response.status} for ship ${ship}`
        }
    })

    async function locate(entry, key) {
        const shipIMONumber = entry.data[parameters.shipIMONumberField]
        if (!shipIMONumber) {
            alert({
                message: `No ship IMO number/name found on line ${entry.line}`,
                importance: 'error'
            })
            return
        }
        const tokenResponse = await Axios('https://www.igpandi.org/ship-search/')
        const tokenDocument = Cheerio.load(tokenResponse.data)
        const token = tokenDocument('[name=csrfmiddlewaretoken]').attr('value')
        return {
            url: 'https://www.igpandi.org/ship-search/',
            method: 'POST',
            dataQuery: {
                csrfmiddlewaretoken: token,
                q: shipIMONumber
            },
            headers: {
                referer: 'https://www.igpandi.org/ship-search/',
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
            message: `More than 20 results were found for "${response.passthrough.shipIMONumber}" -- subsequent results are omitted`,
            importance: 'warning'
        })
        const ships = document('.result-box').get()
        return ships.map(ship => {
            const element = Cheerio.load(ship)
            return {
                shipIMONumber: HTMLEntities.decode(element('dt:nth-of-type(1) dd').html().trim()),
                shipName: HTMLEntities.decode(element('h3 a').text().trim()),
                shipType: HTMLEntities.decode(element('dt:nth-of-type(2) dd').html().trim()),
                shipInsurerClub: HTMLEntities.decode(element('dt:nth-of-type(2) dt dd').html().trim()),
                shipInsurer: HTMLEntities.decode(element('dt:nth-of-type(2) dt dt dd').html().trim())
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
        { name: 'shipIMONumberField', description: 'Ship IMO number (or name) column.' }
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
