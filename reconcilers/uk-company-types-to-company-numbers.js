function initialise(parameters, requestor, die) {

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
            const type = e.config.passthrough.companyType
            if (e.response.status === 404) return `Could not find any companies of type "${type}"`
            if (e.response.status === 429) die('The rate limit has been reached')
            if (e.response.status === 401) die(`API key ${e.config.auth.username} is invalid`)
            if (e.response.status >= 400) return `Received code ${e.response.status} for "${type}"`
        }
    })

    function locate(entry) {
        const companyType = entry.data[parameters.companyTypeField]
        if (!companyType) throw new Error(`No company name found on line ${entry.line}`)
        return {
            url: 'https://api.company-information.service.gov.uk/advanced-search/companies',
            auth: {
                username: apiKeysRotated(),
                password: ''
            },
            params: {
                company_type: companyType,
                size: 5000
            },
            passthrough: {
                companyType
            }
        }
    }

    async function paginate(response) {
        if (response.data.hits > 5000) { // also if there are over 10,000 we can't get them because of the two-page limit
            const pageTotal = Math.ceil(response.data.hits / 5000)
            const pageNumbers = Array.from(Array(pageTotal).keys()).slice(1, 2) // slice off first page as we already have that, also you get an error beyond two pages
            const pageRequests = pageNumbers.map(async page => {
                const query = {
                    url: response.url,
                    auth: {
                        username: apiKeysRotated(),
                        password: ''
                    },
                    params: {
                        company_type: response.passthrough.companyType,
                        size: 5000,
                        start_index: page * 5000
                    },
                    passthrough: {
                        companyType: response.passthrough.companyType
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
        const companies = response?.data.items
        return companies.map(company => {
            const fields = {
                companyNumber: company.company_number,
                companyName: company.company_name,
                companyStatus: company.company_status,
                companyType: company.company_type,
                companyCreationDate: company.date_of_creation,
                companyCessationDate: company.date_of_cessation,
                companyPostcode: company.registered_office_address?.postal_code,
                companyAddress: [company.registered_office_address?.care_of, company.registered_office_address?.premises, company.registered_office_address?.po_box, company.registered_office_address?.address_line_1, company.registered_office_address?.address_line_2, company.registered_office_address?.locality, company.registered_office_address?.region, company.registered_office_address?.postal_code, company.registered_office_address?.country].filter(x => x).join(', ')
            }
            return fields
        })
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
        { name: 'companyTypeField', description: 'Company type column.' }
    ],
    columns: [
        { name: 'companyNumber' },
        { name: 'companyName' },
        { name: 'companyStatus' },
        { name: 'companyType' },
        { name: 'companyCreationDate' },
        { name: 'companyCessationDate' },
        { name: 'companyPostcode' },
        { name: 'companyAddress' }
    ]
}

export default { initialise, details }
