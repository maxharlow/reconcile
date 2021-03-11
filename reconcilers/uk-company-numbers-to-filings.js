function initialise(parameters, requestor, die) {

    const request = requestor(2, e => {
        const company = e.config.passthrough.companyNumber
        if (e.response.status === 429) die('The rate limit has been reached')
        if (e.response.status === 401) die(`API key ${e.config.auth.username} is invalid`)
        if (e.response.status >= 400) return `Received code ${e.response.status} for company ${company}`
    })

    function locate(entry) {
        const companyNumber = entry[parameters.companyNumberField]
        if (!companyNumber) throw new Error('No company number found')
        return {
            url: `https://api.company-information.service.gov.uk/company/${companyNumber.padStart(8, '0').toUpperCase()}/filing-history`,
            auth: {
                username: parameters.apiKey,
                password: ''
            },
            params: {
                category: parameters.filingCategory,
                items_per_page: 100
            },
            validateStatus: status => status === 200 || status === 404, // as a 404 can just indicate no filings (as well as company not found)
            passthrough: {
                companyNumber
            }
        }
    }

    async function paginate(response) {
        if (response.data.total_count > 100) {
            const pageTotal = Math.ceil(response.data.total_count / 100)
            const pageNumbers = Array.from(Array(pageTotal).keys()).slice(1) // slice off first page as we already have that
            const pageRequests = pageNumbers.map(async page => {
                const query = {
                    url: response.url,
                    auth: {
                        username: parameters.apiKey,
                        password: ''
                    },
                    params: {
                        category: parameters.filingCategory,
                        items_per_page: 100,
                        start_index: page * 100
                    },
                    passthrough: {
                        companyNumber: response.passthrough.companyNumber
                    }
                }
                return request(query)
            })
            const pageResponses = await Promise.all(pageRequests)
            return [response].concat(pageResponses)
        }
        else return [response]
    }

    function parse(response) {
        const filings = response.data.items || []
        const limit = parameters.includeAll ? Infinity : 1
        return filings.map(filing => {
            const fields = {
                filingDate: filing.date,
                filingCategory: filing.category,
                filingSubcategory: filing.subcategory || null,
                filingType: filing.type,
                filingDescription: filing.description,
                filingActionDate: filing.action_date,
                filingPaperFiled: filing.paper_filed,
                filingURL: `https://find-and-update.company-information.service.gov.uk${filing.links.self}/document`
            }
            return fields
        }).slice(0, limit)
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataLocatedPaginated = await paginate(dataLocatedRequested)
        const dataParsed = dataLocatedPaginated.flatMap(parse)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        { name: 'apiKey', description: 'A Companies House API key.' },
        { name: 'companyNumberField', description: 'Company number column.' },
        { name: 'filingCategory', description: 'Category of filings to include, eg. "accounts" [optional, default is all filings, can be: accounts, address, annual-return, capital, change-of-name, incorporation, liquidation, miscellaneous, mortgage, officers, resolution]' },
        { name: 'includeAll', description: 'Set true to include all filed documents, instead of just the first [optional, default is first only]' }
    ],
    columns: [
        { name: 'filingDate' },
        { name: 'filingCategory' },
        { name: 'filingSubcategory' },
        { name: 'filingType' },
        { name: 'filingDescription' },
        { name: 'filingActionDate' },
        { name: 'filingPaperFiled' },
        { name: 'filingURL' }
    ]
}

export default { initialise, details }
