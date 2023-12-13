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
        errors: response => {
            if (response.status === 404) return { message: 'could not find company' }
            if (response.status === 429) throw new Error('the rate limit has been reached')
            if (response.status === 401) throw new Error(`API key ${response.config.auth.username} is invalid`)
            if (response.status >= 400) return { message: `received code ${response.status}`, retry: true }
        }
    })

    function locate(entry) {
        const companyName = entry.data[parameters.companyNameField]
        if (!companyName) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no company name found',
                importance: 'error'
            })
            return
        }
        return {
            identifier: `"${companyName}"`,
            url: 'https://api.company-information.service.gov.uk/search/companies',
            auth: {
                username: apiKeysRotated(),
                password: ''
            },
            params: {
                q: companyName.replace(/[^A-Za-z0-9\-\.,& ]/g, ''), // special characters can mean no matches are returned
                items_per_page: 100 // as there's a bug in their API where giving 1 produces zero results when there is only one match
            },
            passthrough: {
                companyName
            }
        }
    }

    function parse(response, entry) {
        if (!response) return
        const maximumResults = parameters.maximumResults || 1
        const companies = response.data.items
        const byPostcode = company => {
            if (!entry.data[parameters.postcodeField]) return true // column for this row is blank
            if (!company.address?.postal_code) return false // postcode specified in source, but no postcode listed in this search result
            return company.address.postal_code.replace(/ /g, '').toLowerCase() === entry.data[parameters.postcodeField].replace(/ /g, '').toLowerCase()
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
            const entryCompanyName = normalised(entry.data[parameters.companyNameField])
            return normalised(company.title) === entryCompanyName || normalised(company.snippet) === entryCompanyName
        }
        return companies.filter(byPostcode).filter(byPreciseMatch).slice(0, maximumResults).map(company => {
            const fields = {
                companyNumber: company.company_number,
                companyName: company.title,
                companyCreationDate: company.date_of_creation,
                companyCessationDate: company.date_of_cessation || null,
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
        {
            name: 'apiKey',
            description: 'A Companies House API key.',
            required: true
        },
        {
            name: 'companyNameField',
            description: 'Company name column.',
            required: true
        },
        {
            name: 'postcodeField',
            description: 'Postcode column. If given will use it to filter results. Only looks at the current company postcode.'
        },
        {
            name: 'preciseMatch',
            description: 'Match company name precisely. Ignores non-alphanumeric differences.'
        },
        {
            name: 'maximumResults',
            description: 'Maximum number of results to include for each name.',
            defaults: '1, maximum 100'
        }
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
