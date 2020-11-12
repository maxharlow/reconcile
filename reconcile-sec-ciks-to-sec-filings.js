import Cheerio from 'cheerio'

function initialise(parameters, requestor, die) {

    const request = requestor(10, e => {
        const cik = e.config.passthrough.cik
        if (e.response.status === 429) die('The rate limit has been reached')
        if (e.response.status >= 400) return `Received code ${e.response.status} for CIK ${cik}`
    })

    function locate(entry) {
        const cik = entry[parameters.cikField || 'cik']
        if (!cik) throw new Error('No CIK found')
        return {
            url: 'https://www.sec.gov/cgi-bin/browse-edgar',
            params: {
                action: 'getcompany',
                CIK: cik,
                type: parameters.filingType,
                count: 100
            },
            passthrough: {
                cik
            }
        }
    }

    function details(response) {
        const document = Cheerio.load(response.data)
        const table = document('.tableFile2').get()
        if (table.length === 0) {
            const cik = response.passthrough.cik
            throw new Error(`Could not find CIK ${cik}`)
        }
        const results = document('.tableFile2 tr:not(:first-of-type)').get() // note this will only get the first 100 results!
        if (results.length === 0) {
            const filings = parameters.filingType ? `${parameters.filingType} filings` : 'filings'
            const cik = response.passthrough.cik
            throw new Error(`No ${filings} found for CIK ${cik}`)
        }
        return results.map(result => {
            const element = Cheerio.load(result)
            return {
                url: 'https://www.sec.gov' + element('td:nth-of-type(2) a').attr('href'),
                passthrough: {
                    filingDate: element('td:nth-of-type(4)').text(),
                    filingType: element('td:nth-of-type(1)').text(),
                    filingDetail: url
                }
            }
        })
    }

    function parse(response) {
        const document = Cheerio.load(response.data)
        const files = document('table tr:not(:first-of-type)').get()
        const contents = files.map(file => {
            const element = Cheerio.load(file)
            return {
                filingDate: response.passthrough.filingDate,
                filingType: response.passthrough.filingType,
                filingDetail: response.passthrough.filingDetail,
                filingDocumentType: element('td:nth-of-type(4)').text(),
                filingDocumentDescription: element('td:nth-of-type(2)').text(),
                filingDocumentName: element('td:nth-of-type(3) a').text(),
                filingDocument: 'https://www.sec.gov' + element('td:nth-of-type(3) a').attr('href')
            }
        })
        const limit = parameters.includeAll ? Infinity : 1
        return contents
            .filter(document => document.filingDocumentName !== '') // exclude documents with no name
            .map(document => ({ filingDocumentName, ...rest } = document) && rest) // remove document name from data
            .slice(0, limit)
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataDetailed = details(dataLocatedRequested)
        const dataDetailedRequested = await Promise.all(dataDetailed.map(request))
        const dataParsed = dataDetailedRequested.flatMap(parse)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        { name: 'cikField', description: 'CIK or ticker column. [optional, default: "cik"]' },
        { name: 'filingType', description: 'Type of filings to include, eg. 10-K [optional, default is all filings]' },
        { name: 'includeAll', description: 'Set true to include all filed documents, instead of just the first [optional, default is first only]' }
    ],
    columns: [
        { name: 'filingDate' },
        { name: 'filingType' },
        { name: 'filingDetail' },
        { name: 'filingDocumentType' },
        { name: 'filingDocumentDescription' },
        { name: 'filingDocument' }
    ]
}

export default { initialise, details }
