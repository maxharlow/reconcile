import Cheerio from 'cheerio'
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
        const categories = {
            'm-and-a': 1,
            'results': 2,
            'dividends': 4,
            'exec-changes': 8,
            'director-dealings': 16,
            'advance-results': 32
        }
        const category = categories[parameters.category]
        if (parameters.category && !Object.keys(categories).includes(parameters.category)) {
            alert({
                identifier: ticker,
                message: `invalid category: ${category}`,
                importance: 'error'
            })
            return
        }
        return {
            identifier: ticker,
            url: 'https://www.investegate.co.uk/AdvancedSearch.aspx',
            params: {
                qsArticleType: 'ann', // search announcements
                qsSearchFor: 'S2', // via ticker
                qsContains: ticker,
                qsSpan: '120', // all time
                ...(category ? { qsCategory: category } : {})
            },
            passthrough: {
                ticker,
                category
            }
        }
    }

    async function paginate(response, responses = [], results = 0) {
        const maximumResults = parameters.maximumResults || Infinity
        const maximumDate = Luxon.DateTime.fromISO(parameters.maximumDate || '0000-01-01')
        const document = Cheerio.load(response.data)
        const totalResults = results + document('#announcementList > tr:not(:first-of-type)').length
        const lastDate = Luxon.DateTime.fromFormat(document('#announcementList > tr:last-of-type td:first-of-type').text(), 'dd MMM yyyy')
        const hasMorePages = document('.navBottom').length
        if (hasMorePages && totalResults < maximumResults && lastDate >= maximumDate) {
            const query = {
                identifier: response.passthrough.ticker,
                url: response.url,
                params: {
                    qsArticleType: 'ann',
                    qsSearchFor: 'S2',
                    qsContains: response.passthrough.ticker,
                    qsSpan: '120', // all time
                    ...(response.passthrough.category ? { qsCategory: response.passthrough.category } : {}),
                    pno: document('.navBottom').attr('href').split('pno=')[1]
                },
                passthrough: {
                    ...response.passthrough
                }
            }
            return paginate(await request(query), responses.concat(response), totalResults)
        }
        return responses.concat(response)
    }

    function details(response) {
        const document = Cheerio.load(response.data)
        const results = document('#announcementList > tr:not(:first-of-type)').get()
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
                announcementTime: row('td:nth-of-type(2)').text(),
                announcementSource: row('td:nth-of-type(3) a').text(),
                announcementCompany: row('td:nth-of-type(6) strong').text(),
                announcementTitle: row('td:nth-of-type(7) a').text(),
                announcementURL: 'https://www.investegate.co.uk' + row('td:nth-of-type(7) a').attr('href')
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

    function filter(entry) {
        if (!parameters.maximumDate) return true
        const maximumDate = Luxon.DateTime.fromISO(parameters.maximumDate)
        const thisDate = Luxon.DateTime.fromFormat(entry.passthrough.announcementDate, 'dd MMM yyyy')
        return thisDate >= maximumDate
    }

    function parse(response) {
        const document = Cheerio.load(response.data)
        return {
            ...response.passthrough,
            announcementBody: document('#ArticleContent').html().replace(/\r|\n/g, '').replace(/ +/g, ' ').replace(/> /g, '>').replace(/ </g, '<')
        }
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataLocatedPaginated = await paginate(dataLocatedRequested)
        const dataDetailed = dataLocatedPaginated.flatMap(details)
        const dataDetailedFiltered = dataDetailed.filter(filter).slice(0, parameters.maximumResults || Infinity)
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
            choices: '"m-and-a", "results", "dividends", "exec-changes", "director-dealings", "advance-results"'
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
