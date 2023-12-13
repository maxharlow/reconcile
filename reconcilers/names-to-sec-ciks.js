import Cheerio from 'cheerio'

function initialise(parameters, requestor, alert) {

    const request = requestor({
        limit: 10,
        errors: response => {
            if (response.status === 403) throw new Error('the rate limit has been reached')
            if (response.status >= 400) return { message: `received code ${response.status}`, retry: true }
        }
    })

    function locate(entry) {
        const name = entry.data[parameters.nameField]
        if (!name) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no name found',
                importance: 'error'
            })
            return
        }
        return {
            identifier: `"${name}"`,
            url: 'https://www.sec.gov/cgi-bin/cik_lookup',
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'user-agent': 'Reconcile',
                referer: 'https://www.sec.gov/edgar/searchedgar/cik',
                cookie: 'x=x'
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
        if (!response) return
        const document = Cheerio.load(response.data)
        const results = document('table tr > td:nth-child(2) > pre:nth-child(5)').html()
        if (results === null) {
            const name = response.passthrough.name
            alert({
                identifier: `"${name}"`,
                message: 'could not find name',
                importance: 'error'
            })
            return
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
        {
            name: 'nameField',
            description: 'Name column.',
            required: true
        },
        {
            name: 'maximumResults',
            description: 'Maximum number of results to include for each name.',
            defaults: '1, maximum 100'
        }
    ],
    columns: [
        { name: 'name' },
        { name: 'cik' }
    ]
}

export default { initialise, details }
