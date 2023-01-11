import Cheerio from 'cheerio'

function initialise(parameters, requestor, alert) {

    const request = requestor({
        limit: 10,
        messages: e => {
            if (e.response.status === 429) throw new Error('the rate limit has been reached')
            if (e.response.status >= 400) return `received code ${e.response.status}`
        }
    })

    function locate(entry) {
        const cik = entry.data[parameters.cikField]
        if (!cik) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no CIK found',
                importance: 'error'
            })
            return
        }
        return {
            identifier: `CIK ${cik}`,
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
        if (!response) return
        const document = Cheerio.load(response.data)
        const table = document('.tableFile2').get()
        if (table.length === 0) {
            const cik = response.passthrough.cik
            alert({
                identifier: `CIK ${cik}`,
                message: 'could not find CIK',
                importance: 'error'
            })
            return
        }
        const results = document('.tableFile2 tr:not(:first-of-type)').get() // note this will only get the first 100 results!
        if (results.length === 0) {
            const filings = parameters.filingType ? `${parameters.filingType} filings` : 'filings'
            const cik = response.passthrough.cik
            alert({
                identifier: `CIK ${cik}`,
                message: `no ${filings} found`,
                importance: 'error'
            })
            return
        }
        return results.map(result => {
            const element = Cheerio.load(result)
            const url = 'https://www.sec.gov' + element('td:nth-of-type(2) a').attr('href')
            return {
                url,
                passthrough: {
                    filingDate: element('td:nth-of-type(4)').text(),
                    filingType: element('td:nth-of-type(1)').text(),
                    filingDetail: url
                }
            }
        })
    }

    function parse(response) {
        if (!response) return
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
            .filter(entry => entry.filingDocumentName !== '') // exclude documents with no name
            .map(entry => { // remove document name from entry
                const { filingDocumentName, ...rest } = entry
                return rest
            })
            .slice(0, limit)
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataDetailed = details(dataLocatedRequested)
        if (!dataDetailed) return
        const dataDetailedRequested = await Promise.all(dataDetailed.map(request))
        if (!dataDetailedRequested) return
        const dataParsed = dataDetailedRequested.flatMap(parse)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        {
            name: 'cikField',
            description: 'CIK or ticker column.',
            required: true
        },
        {
            name: 'filingType',
            description: 'Type of filings to include, eg. 10-K.',
            defaults: 'all'
        },
        {
            name: 'includeAll',
            description: 'Set true to include all filed documents, instead of just the first.',
            defaults: 'first only'
        }
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
