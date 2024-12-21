import * as Cheerio from 'cheerio'

function initialise(parameters, requestor, alert) {

    const request = requestor({
        limit: 10,
        errors: response => {
            if (response.status === 403) return { message: 'hit rate limit', retry: true }
            if (response.status >= 400) return { message: `received code ${response.status}`, retry: true }
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
                count: 100,
                ...(parameters.maximumDate ? { datea: parameters.maximumDate } : {})
            },
            headers: {
                'user-agent': 'xx@xx.xx'
            },
            passthrough: {
                cik
            }
        }
    }

    async function paginate(response, responses = []) {
        if (!response) return
        const maximumResults = parameters.maximumResults || Infinity
        const document = Cheerio.load(response.data)
        const hasMorePages = document('[value="Next 100"]').length
        const results = responses.length
        if (hasMorePages && results < maximumResults) {
            const query = {
                identifier: `CIK ${response.passthrough.cik}`,
                url: 'https://www.sec.gov/cgi-bin/browse-edgar',
                params: {
                    action: 'getcompany',
                    CIK: response.passthrough.cik,
                    type: parameters.filingType,
                    count: 100,
                    start: (responses.length + 1) * 100,
                    ...(parameters.maximumDate ? { datea: parameters.maximumDate } : {})
                },
                headers: {
                    'user-agent': 'xx@xx.xx'
                },
                passthrough: {
                    ...response.passthrough
                }
            }
            return paginate(await request(query), responses.concat(response))
        }
        return responses.concat(response)
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
        const results = document('.tableFile2 tr:not(:first-of-type)').get()
        if (results.length === 0) {
            const filings = parameters.filingType ? `${parameters.filingType} filings` : 'filings'
            const cik = response.passthrough.cik
            alert({
                identifier: `CIK ${cik}`,
                message: `no ${filings} found`,
                importance: 'error'
            })
            return []
        }
        return results.map(result => {
            const element = Cheerio.load(result)
            const url = 'https://www.sec.gov' + element('td:nth-of-type(2) a').attr('href')
            const description = element('td:nth-of-type(3)').text()
            return {
                identifier: `CIK ${response.passthrough.cik}`,
                url,
                headers: {
                    'user-agent': 'xx@xx.xx'
                },
                passthrough: {
                    cik: response.passthrough.cik,
                    filingDate: element('td:nth-of-type(4)').text(),
                    filingType: element('td:nth-of-type(1)').text(),
                    filingAccession: description.match(/Acc-no: ([0-9\-]+)/)[1],
                    filingDescription: description.split('Acc-no:')[0],
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
                filingAccession: response.passthrough.filingAccession,
                filingDescription: response.passthrough.filingDescription,
                filingDetail: response.passthrough.filingDetail,
                filingDocumentType: element('td:nth-of-type(4)').text(),
                filingDocumentDescription: element('td:nth-of-type(2)').text(),
                filingDocumentName: element('td:nth-of-type(3) a').text(),
                filingDocument: 'https://www.sec.gov' + element('td:nth-of-type(3) a').attr('href')
            }
        })
        return contents
            .filter(entry => entry.filingDocumentName !== '') // exclude documents with no name
            .map(entry => { // remove document name from entry
                const { filingDocumentName, ...rest } = entry
                return rest
            })
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        if (!dataLocatedRequested) return
        const dataLocatedPaginated = await paginate(dataLocatedRequested)
        const dataDetailed = await Promise.all(dataLocatedPaginated.flatMap(details))
        if (!dataDetailed) return
        const dataDetailedFiltered = dataDetailed.slice(0, parameters.maximumResults || Infinity)
        const dataDetailedFilteredRequested = await Promise.all(dataDetailedFiltered.map(request))
        if (!dataDetailedFilteredRequested) return
        const dataParsed = dataDetailedFilteredRequested.flatMap(parse)
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
            name: 'maximumResults',
            description: 'Maximum number of results to include for each entity.',
            defaults: 'all'
        },
        {
            name: 'maximumDate',
            description: 'Maximum announcement date for announcements from each entity, in ISO 8601 format.',
            defaults: 'no limit'
        }
    ],
    columns: [
        { name: 'filingDate' },
        { name: 'filingType' },
        { name: 'filingAccession' },
        { name: 'filingDescription' },
        { name: 'filingDetail' },
        { name: 'filingDocumentType' },
        { name: 'filingDocumentDescription' },
        { name: 'filingDocument' }
    ]
}

export default { initialise, details }
