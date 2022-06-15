import Cheerio from 'cheerio'

function initialise(parameters, requestor, die) {

    const request = requestor({
        limit: 10,
        messages: e => {
            const name = e.config.passthrough.name
            if (e.response.status === 429) die('The rate limit has been reached')
            if (e.response.status >= 400) return `Received code ${e.response.status} for name ${name}`
        }
    })

    function locate(entry) {
        const name = entry[parameters.nameField]
        if (!name) throw new Error('No name found')
        return {
            url: 'https://www.sec.gov/cgi-bin/cik_lookup',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            dataQuery: {
                company: name
            },
            passthrough: {
                name
            }
        }
    }

    function parse(response) {
        const document = Cheerio.load(response.data)
        const results = document('table tr > td:nth-child(2) > pre:nth-child(5)').html()
        if (results === null) {
            const name = response.passthrough.name
            throw new Error(`Could not find name ${name}`)
        }
        const maximumResults = parameters.maximumResults || 1
        return results.split('\n').slice(0, maximumResults).map(name => {
            const element = Cheerio(name)
            return {
                name: element.eq(1).text().trim(),
                cik: element.eq(0).text()
            }
        })
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataParsed = parse(dataLocatedRequested)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        { name: 'nameField', description: 'Name column.' },
        { name: 'maximumResults', description: 'Maximum number of results to include for each name. [optional, default: 1, maximum 100]' }
    ],
    columns: [
        { name: 'name' },
        { name: 'cik' }
    ]
}

export default { initialise, details }
