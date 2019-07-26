const Querystring = require('querystring')
const Cheerio = require('cheerio')

function initialise(parameters, requestor) {

    const request = requestor(Infinity, e => {
        const company = e.config.passthrough.companyName
        if (e.response.status >= 400) return `Received code ${e.response.status} for company ${company}`
    })

    function locate(entry) {
        const companyName = entry[parameters.companyNameField || 'companyName']
        if (!companyName) throw new Error('No company name found')
        return {
            url: 'https://www.sec.gov/cgi-bin/cik_lookup',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: Querystring.stringify({
                company: companyName.trim()
            }),
            passthrough: {
                companyName
            }
        }
    }

    function parse(response) {
        const document = Cheerio.load(response.data)
        const companies = document('table tr > td:nth-child(2) > pre:nth-child(5)').html()
        if (companies === null) {
            const company = response.passthrough.companyName
            throw new Error(`Could not find company ${company}`)
        }
        const maximumResults = parameters.maximumResults || 1
        return companies.split('\n').slice(0, maximumResults).map(company => {
            const element = Cheerio(company)
            return {
                companyName: element.eq(1).text().trim(),
                companyCIK: element.eq(0).text()
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
        { name: 'companyNameField', description: 'Company name column. [optional, default: "companyName"]' },
        { name: 'maximumResults', description: 'Maximum number of results to include for each name. [optional, default: 1, maximum 100]' }
    ],
    columns: [
        { name: 'companyName' },
        { name: 'companyCIK' }
    ]
}

module.exports = { initialise, details }
