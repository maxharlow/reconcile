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
            const company = e.config.passthrough.companyName
            if (e.response.status === 404) return `Could not find company ${company}`
            if (e.response.status === 429) die('The rate limit has been reached')
            if (e.response.status === 401) die(`API key ${e.config.auth.username} is invalid`)
            if (e.response.status >= 400) return `Received code ${e.response.status} for company ${company}`
        }
    })

    function locate(entry) {
        const companyName = entry.data[parameters.companyNameField]
        if (!companyName) throw new Error(`No company name found on line ${entry.line}`)
        return {
            url: 'https://api.company-information.service.gov.uk/search/companies',
            auth: {
                username: apiKeysRotated(),
                password: ''
            },
            params: {
                q: companyName,
                items_per_page: 100 // as there's a bug in their API where giving 1 produces zero results when there is only one match
            },
            passthrough: {
                companyName
            }
        }
    }

    function parse(response, entry) {
        const maximumResults = parameters.maximumResults || 1
        const companies = response?.data.items
        const byPostcode = company => {
            if (!parameters.postcodeField || !entry[parameters.postcodeField]) return true // field not specified or field for this row is blank
            if (!company.address?.postal_code) return false // postcode specified in source, but no postcode listed in this search result
            return company.address.postal_code.replace(/ /g, '').toLowerCase() === entry[parameters.postcodeField].replace(/ /g, '').toLowerCase()
        }
        const normalised = name => {
            return name?.toLowerCase()
                .replace(/^the /, '')
                .replace(/&/g, 'and')
                .replace(/[^a-z0-9]/g, '')
                .replace(/(limited|ltd|publiclimitedcompany|plc|llp|limitedliabilitypartnership)(the)?$/, '')
        }
        const byPreciseMatch = company => {
            if (!parameters.preciseMatch) return true
            const entryCompanyName = normalised(entry[parameters.companyNameField])
            return normalised(company.title) === entryCompanyName || normalised(company.snippet) === entryCompanyName
        }
        return companies.filter(byPostcode).filter(byPreciseMatch).slice(0, maximumResults).map(company => {
            const fields = {
                companyNumber: company.company_number,
                companyName: company.title,
                companyCreationDate: company.date_of_creation,
                companyCessationDate: company.date_of_cessation,
                companyPostcode: company.address?.postal_code,
                companyAddress: [company.address?.care_of, company.address?.premises, company.address?.po_box, company.address?.address?.line_1, company.address?.address?.line_2, company.address?.locality, company.address?.region, company.address?.postal_code, company.address?.country].filter(x => x).join(', ')
            }
            return fields
        })
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataParsed = parse(dataLocatedRequested, input)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        { name: 'apiKey', description: 'A Companies House API key.' },
        { name: 'companyNameField', description: 'Company name column.' },
        { name: 'postcodeField', description: 'Postcode column. If given will use it to filter results. Only looks at the current company postcode. [optional]' },
        { name: 'preciseMatch', description: 'Match company name precisely. Ignores non-alphanumeric differences. [optional]' },
        { name: 'maximumResults', description: 'Maximum number of results to include for each name. [optional, default: 1, maximum 100]' }
    ],
    columns: [
        { name: 'companyNumber' },
        { name: 'companyName' },
        { name: 'companyCreationDate' },
        { name: 'companyCessationDate' },
        { name: 'companyPostcode' },
        { name: 'companyAddress' }
    ]
}

export default { initialise, details }
