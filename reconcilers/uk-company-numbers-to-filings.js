function initialise(parameters, requestor, alert) {

    const apiKeys = [parameters.apiKey].flat()

    const apiKeysRotated = (() => {
        let next = 0
        return () => {
            const key = apiKeys[next]
            next = (next + 1) % apiKeys.length
            return key
        }
    })()

    const request = requestor({
        limit: apiKeys.length * 2,
        messages: e => {
            if (e.response.status === 429) throw new Error('the rate limit has been reached')
            if (e.response.status === 401) throw new Error(`API key ${e.config.auth.username} is invalid`)
            if (e.response.status >= 400) return `received code ${e.response.status} on page ${e.config.passthrough.page}`
        }
    })

    function locate(entry) {
        const companyNumber = entry.data[parameters.companyNumberField]
        if (!companyNumber || companyNumber.match(/^0+$/)) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no company number found',
                importance: 'error'
            })
            return
        }
        return {
            url: `https://api.company-information.service.gov.uk/company/${companyNumber.padStart(8, '0').toUpperCase()}/filing-history`,
            auth: {
                username: apiKeysRotated(),
                password: ''
            },
            params: {
                category: parameters.filingCategory,
                items_per_page: 100
            },
            passthrough: {
                companyNumber,
                page: 1
            }
        }
    }

    async function paginate(response) {
        if (!response) return
        const didDescriptionMatchRemoveAll = parameters.filingDescriptionMatch
            && response.data.items
            && response.data.items.length > 0
            && response.data.total_count > 100
            && (parameters.filingDescriptionMatch && response.data.items.filter(filing => filing.description?.match(parameters.filingDescriptionMatch)).length === 0)
        if (response.data.total_count > 100 && parameters.includeAll || didDescriptionMatchRemoveAll) {
            const pageTotal = Math.ceil(response.data.total_count / 100)
            const pageNumbers = Array.from(Array(pageTotal).keys()).slice(1) // slice off first page as we already have that
            const pageRequests = pageNumbers.map(async page => {
                const query = {
                    identifier: `Company ${response.passthrough.companyNumber}`,
                    url: response.url,
                    auth: {
                        username: apiKeysRotated(),
                        password: ''
                    },
                    params: {
                        category: parameters.filingCategory,
                        items_per_page: 100,
                        start_index: page * 100
                    },
                    passthrough: {
                        companyNumber: response.passthrough.companyNumber,
                        page: page + 1
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
        if (!response) return
        if (response.data.filing_history_status === 'filing-history-not-available-invalid-format') {
            alert({
                identifier: `Company ${response.passthrough.companyNumber}`,
                message: `filings not available, perhaps company number is invalid?`,
                importance: 'error'
            })
            return
        }
        const filings = response.data.items || []
        const filingsFiltered = parameters.filingDescriptionMatch ? filings.filter(filing => filing.description?.match(parameters.filingDescriptionMatch)) : filings
        return filingsFiltered.map(filing => {
            const filingID = filing.links?.document_metadata?.split('document/')[1] || null
            const fields = {
                filingDate: filing.date,
                filingCategory: filing.category,
                filingSubcategory: filing.subcategory || null,
                filingType: filing.type,
                filingDescription: filing.description,
                filingDescriptionData: filing.description_values ? JSON.stringify(filing.description_values) : null,
                filingResolutionTypes: filing.resolutions?.map(resolution => resolution.type).join('; ') || null,
                filingActionDate: filing.action_date || null,
                filingPaperFiled: filing.paper_filed || null,
                filingID,
                filingURL: filing.links?.self ? `https://find-and-update.company-information.service.gov.uk${filing.links.self}/document` : null,
                filingAPIURL: filingID ? `https://document-api.company-information.service.gov.uk/document/${filingID}/content` : null
            }
            return fields
        })
    }

    async function run(input) {
        const limit = parameters.includeAll ? Infinity : 1
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataLocatedPaginated = await paginate(dataLocatedRequested)
        if (!dataLocatedPaginated) return
        const dataParsed = dataLocatedPaginated.flatMap(parse)
        return dataParsed.slice(0, limit)
    }

    return run

}

const details = {
    parameters: [
        {
            name: 'apiKey',
            description: 'A Companies House API key.',
            required: true
        },
        {
            name: 'companyNumberField',
            description: 'Company number column.',
            required: true
        },
        {
            name: 'filingCategory',
            description: 'Category of filings to include, eg. "accounts".',
            defaults: 'all',
            choices: '"accounts", "address", "annual-return", "capital", "change-of-name", "incorporation", "liquidation", "miscellaneous", "mortgage", "officers", "resolution", "confirmation-statement"'
        },
        {
            name: 'filingDescriptionMatch',
            description: 'Filter filing descriptions to only those matching.'
        },
        {
            name: 'includeAll',
            description: 'Set true to include all filed documents, instead of just the first.',
            defaults: 'first only'
        }
    ],
    columns: [
        { name: 'filingDate' },
        { name: 'filingCategory' },
        { name: 'filingSubcategory' },
        { name: 'filingType' },
        { name: 'filingDescription' },
        { name: 'filingDescriptionData' },
        { name: 'filingResolutionTypes' },
        { name: 'filingActionDate' },
        { name: 'filingPaperFiled' },
        { name: 'filingID' },
        { name: 'filingURL' },
        { name: 'filingAPIURL' }
    ]
}

export default { initialise, details }
