import * as Cheerio from 'cheerio'
import * as Luxon from 'luxon'

function initialise(parameters, requestor, alert) {

    const request = requestor({
        limit: 10,
        errors: response => {
            if (response.status >= 400) return { message: `received code ${response.status}`, retry: true }
        }
    })

    function locate(entry) {
        const ticker = entry.data[parameters.tickerField]
        if (!ticker) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no ticker found',
                importance: 'error'
            })
            return
        }
        const categoryIDs = {
            'general': 0,
            'mergers-acquisitions-disposals': 1,
            'results-and-trading-reports': 2,
            'dividends': 4,
            'executive-changes': 8,
            'directors-dealings': 16,
            'advance-notice-of-results': 32
        }
        const category = categoryIDs[parameters.category]
        if (parameters.category && !Object.keys(categoryIDs).includes(parameters.category)) {
            alert({
                identifier: ticker,
                message: `invalid category: ${category}`,
                importance: 'error'
            })
            return
        }
        return {
            identifier: ticker,
            url: 'https://www.investegate.co.uk/advanced-search/draw',
            params: {
                search_for: 2, // via ticker
                search_word: ticker,
                ...(parameters.maximumDate ? { date_from: Luxon.DateTime.fromISO(parameters.maximumDate).toFormat('d MMMM yyyy') } : {}),
                ...(category ? { 'categories[]': [category] } : {}),
                exclude_navs: false
            },
            passthrough: {
                ticker,
                category,
                page: 1
            }
        }
    }

    async function paginate(response) {
        if (!response) return
        const maximumResults = parameters.maximumResults || Infinity
        const document = Cheerio.load(response.data)
        const hasMorePages = document('.text-muted span:last-of-type').text()
        const results = document('tbody tr').length
        const totalResults = hasMorePages ? Number(hasMorePages) : results
        if (hasMorePages && results < maximumResults) {
            const pageTotal = Math.ceil(Math.min(totalResults, maximumResults) / 100)
            const pageNumbers = Array.from(Array(pageTotal).keys()).map(i => i + 1).slice(1) // slice off first page as we already have that
            const pageRequests = pageNumbers.map(async page => {
                const query = {
                    identifier: response.passthrough.ticker,
                    url: 'https://www.investegate.co.uk/advanced-search/draw',
                    params: {
                        search_for: 2,
                        search_word: response.passthrough.ticker,
                        ...(parameters.maximumDate ? { date_from: Luxon.DateTime.fromISO(parameters.maximumDate).toFormat('d MMMM yyyy') } : {}),
                        ...(response.passthrough.category ? { 'categories[]': [response.passthrough.category] } : {}),
                        exclude_navs: false,
                        page
                    },
                    passthrough: {
                        ...response.passthrough,
                        page
                    }
                }
                return request(query)
            })
            const pageResponses = await Promise.all(pageRequests)
            return [response].concat(pageResponses)
        }
        else return [response]
    }

    function details(response) {
        if (!response) return null
        const document = Cheerio.load(response.data)
        const results = document('tbody tr').get()
        if (results.length === 0) {
            const ticker = response.passthrough.ticker
            alert({
                identifier: ticker,
                message: 'could not find ticker',
                importance: 'error'
            })
            return
        }
        const dateFor = i => {
            const row = Cheerio.load(results[i])
            const text = row('td:nth-of-type(1)').text().trim()
            if (!text) return dateFor(i - 1)
            return text
        }
        return results.map((element, i) => {
            const row = Cheerio.load(element)
            const fields = {
                announcementTime: row('td:nth-of-type(1)').text(),
                announcementSource: row('td:nth-of-type(3)').text().trim(),
                announcementCompany: row('td:nth-of-type(2) div div:last-of-type').text().trim(),
                announcementTitle: row('td:nth-of-type(4)').text().trim(),
                announcementURL: row('td:nth-of-type(4) a').attr('href')
            }
            return {
                identifier: response.passthrough.ticker,
                url: fields.announcementURL,
                passthrough: {
                    announcementDate: dateFor(i),
                    ...fields
                }
            }
        })
    }

    function parse(response) {
        if (!response) return null
        const document = Cheerio.load(response.data)
        return {
            ...response.passthrough,
            announcementBody: document('.news-window').html().replace(/[\r\n]/g, '').replace(/ +/g, ' ')
        }
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataLocatedPaginated = await paginate(dataLocatedRequested)
        const dataDetailed = dataLocatedPaginated.flatMap(details)
        const dataDetailedFiltered = dataDetailed.slice(0, parameters.maximumResults || Infinity)
        const dataDetailedFilteredRequested = await Promise.all(dataDetailedFiltered.map(request))
        const dataParsed = dataDetailedFilteredRequested.map(parse)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        {
            name: 'tickerField',
            description: 'Ticker column.',
            required: true
        },
        {
            name: 'category',
            description: 'Only include annoucements in this category.',
            defaults: 'all',
            choices: '"general", "mergers-acquisitions-disposals", "results-and-trading-reports", "dividends", "executive-changes", "directors-dealings", "advance-notice-of-results"'
        },
        {
            name: 'maximumResults',
            description: 'Maximum number of results to include for each ticker.',
            defaults: 'all'
        },
        {
            name: 'maximumDate',
            description: 'Maximum announcement date for announcements from each ticker, in ISO 8601 format.',
            defaults: 'no limit'
        }
    ],
    columns: [
        { name: 'announcementDate' },
        { name: 'announcementTime' },
        { name: 'announcementSource' },
        { name: 'announcementCompany' },
        { name: 'announcementTitle' },
        { name: 'announcementURL' },
        { name: 'announcementBody' }
    ]
}

export default { initialise, details }
