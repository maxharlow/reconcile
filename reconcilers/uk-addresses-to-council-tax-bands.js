import Cheerio from 'cheerio'

function initialise(parameters, requestor, alert) {

    const request = requestor({
        errors: response => {
            if (response.status === 403) throw new Error('the rate limit has been reached')
            if (response.status >= 400) return { message: `received code ${response.status}`, retry: true }
        }
    })

    function locate(entry) {
        const addressNumber = entry.data[parameters.addressNumberField]
        const addressStreet = entry.data[parameters.addressStreetField]
        const addressCity = entry.data[parameters.addressCityField]
        const addressPostcode = entry.data[parameters.addressPostcodeField]
        const address = [addressNumber, addressStreet, addressCity, addressPostcode].filter(x => x).join(', ')
        return {
            identifier: address || 'all',
            url: 'https://www.tax.service.gov.uk/check-council-tax-band/search-council-tax-advanced',
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded'
            },
            dataQuery: {
                propertyName: addressNumber,
                street: addressStreet,
                town: addressCity,
                postcode: addressPostcode,
                page: 0
            },
            passthrough: {
                addressNumber,
                addressStreet,
                addressCity,
                addressPostcode
            }
        }
    }

    async function paginate(response) {
        const address = [response.passthrough.addressNumber, response.passthrough.addressStreet, response.passthrough.addressCity, response.passthrough.addressPostcode].filter(x => x).join(', ')
        const document = Cheerio.load(response.data)
        const hasMorePages = document('.voa-pagination__item').length
        if (hasMorePages) {
            const pageTotal = Number(document('.voa-pagination__item:nth-last-child(2) a').attr('href').split('page=')[1]) + 1
            const pageNumbers = Array.from(Array(pageTotal).keys()).slice(1) // slice off first page as we already have that
            const pageRequests = pageNumbers.map(async page => {
                const query = {
                    identifier: response.passthrough.address || 'all',
                    url: response.url,
                    method: 'POST',
                    headers: {
                        'content-type': 'application/x-www-form-urlencoded'
                    },
                    dataQuery: {
                        propertyName: response.passthrough.addressNumber,
                        street: response.passthrough.addressStreet,
                        town: response.passthrough.addressCity,
                        postcode: response.passthrough.addressPostcode,
                        page
                    },
                    passthrough: {
                        ...response.passthrough
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
        const document = Cheerio.load(response.data)
        const results = document('#search-results-table tbody tr').get()
        const address = [response.passthrough.addressNumber, response.passthrough.addressStreet, response.passthrough.addressCity, response.passthrough.addressPostcode].filter(x => x).join(', ')
        if (results.length === 0) {
            alert({
                identifier: address || 'all',
                message: 'could not find any council tax registrations',
                importance: 'error'
            })
            return []
        }
        return results.map(element => {
            const row = Cheerio.load(element)
            return {
                identifier: address || 'all',
                url: 'https://www.tax.service.gov.uk' + row('td:first-of-type a').attr('href'),
                passthrough: {
                    ...response.passthrough,
                    address: row('td:first-of-type a').text().trim()
                }
            }
        })
    }

    function parse(response) {
        if (!response) return
        const document = Cheerio.load(response.data)
        return {
            address: response.passthrough.address,
            localAuthority: document('.govuk-summary-list__row:nth-of-type(1) dd a').text().trim(),
            localAuthorityReference: document('.govuk-summary-list__row:nth-of-type(2) dd').text().trim(),
            councilTaxBand: document('.govuk-summary-list__row:nth-of-type(3) dd').text().trim(),
            improvementIndicator: document('.govuk-summary-list__row:nth-of-type(4) dd').text().trim(),
            effectFromDate: document('.govuk-summary-list__row:nth-of-type(5) dd').text().trim(),
            isMixedUseProperty: document('.govuk-summary-list__row:nth-of-type(6) dd').text().trim(),
            courtCode: document('.govuk-summary-list__row:nth-of-type(7) dd').text().trim()
        }
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataLocatedPaginated = await paginate(dataLocatedRequested)
        const dataDetailed = dataLocatedPaginated.flatMap(details)
        const dataDetailedRequested = await Promise.all(dataDetailed.map(request))
        const dataParsed = dataDetailedRequested.map(parse)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        {
            name: 'addressNumberField',
            description: 'Property number (or name) column.'
        },
        {
            name: 'addressStreetField',
            description: 'Property street column.'
        },
        {
            name: 'addressCityField',
            description: 'Property city column.'
        },
        {
            name: 'addressPostcodeField',
            description: 'Property postcode column.'
        }
    ],
    columns: [
        { name: 'address' },
        { name: 'localAuthority' },
        { name: 'localAuthorityReference' },
        { name: 'councilTaxBand' },
        { name: 'improvementIndicator' },
        { name: 'effectFromDate' },
        { name: 'isMixedUseProperty' },
        { name: 'courtCode' }
    ]
}

export default { initialise, details }
