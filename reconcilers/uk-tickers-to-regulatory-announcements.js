import Cheerio from 'cheerio'

function initialise(parameters, requestor, die) {

    const request = requestor(10, e => {
        const ticker = e.config.passthrough.ticker
        if (e.response.status >= 400) return `Received code ${e.response.status} for ticker ${ticker}`
    })

    function locate(entry) {
        const ticker = entry[parameters.tickerField]
        if (!ticker) throw new Error('No ticker found')
        return {
            url: 'https://www.investegate.co.uk/',
            params: {
                searchtype: 3,
                words: ticker
            },
            passthrough: {
                ticker
            }
        }
    }

    async function paginate(response, responses = [], results = 0) {
        const maximumResults = parameters.maximumResults || Infinity
        const document = Cheerio.load(response.data)
        const totalResults = results + document('#announcementList > tr:not(:first-of-type)').length
        const hasMorePages = document('.navBottom').length
        if (hasMorePages && totalResults < maximumResults) {
            const query = {
                url: response.url,
                params: {
                    searchtype: 3,
                    words: response.passthrough.ticker,
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
            throw new Error(`Could not find ticker ${ticker}`)
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
                announcementTitle: row('td:nth-of-type(7) a').text(),
                accouncementURL: 'https://www.investegate.co.uk' + row('td:nth-of-type(7) a').attr('href')
            }
            return {
                url: fields.accouncementURL,
                passthrough: {
                    announcementDate: dateFor(i),
                    ...fields
                }
            }
        })
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
        const dataDetailed = dataLocatedPaginated.flatMap(details).slice(0, parameters.maximumResults || Infinity)
        const dataDetailedRequested = await Promise.all(dataDetailed.map(request))
        const dataParsed = dataDetailedRequested.map(parse)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        { name: 'tickerField', description: 'Ticker column.' },
        { name: 'maximumResults', description: 'Maximum number of results to include for each ticker. [optional, default: all]' }
    ],
    columns: [
        { name: 'announcementDate' },
        { name: 'announcementTime' },
        { name: 'announcementSource' },
        { name: 'announcementTitle' },
        { name: 'accouncementURL' },
        { name: 'announcementBody' }
    ]
}

export default { initialise, details }
