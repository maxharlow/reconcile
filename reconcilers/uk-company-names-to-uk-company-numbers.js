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
            if (response.status === 401) throw new Error(`API key ${response.config.auth.username} is invalid`)
            if (response.status === 404) return { message: 'could not find company' }
            if (response.status === 429) return { message: 'the rate limit has been reached', retry: true } // don't throw as this happens from time to time
            if (response.status >= 400) return { message: `received code ${response.status}`, retry: true }
        }
    })

    function companyNameNormalised(companyName) {
        if (!companyName) return null
        return companyName
            .toLowerCase()
            .replace(/^the /, '')
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9 ]/g, '')
            .replace(/  +/g, ' ')
            .replace(/ limited$/, ' ltd')
            .replace(/ public limited company$/, ' plc')
            .replace(/ (unlimited|unlimited company)$/, ' uc')
            .replace(/ limited liability partnership$/, ' llp')
            .replace(/ limited partnership$/, ' lp')
    }

    function companyNameUnsuffixed(companyName) {
        if (!companyName) return null
        return companyNameNormalised(companyName)
            .replace(/ ltd$/, '')
            .replace(/ plc$/, '')
            .replace(/ uc$/, '')
            .replace(/ llp$/, '')
            .replace(/ lp$/, '')
    }

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
                q: companyName.toLowerCase().replace(/[^a-z0-9\-\.,& ]/g, ''),
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
        const withMatchType = company => {
            const entryNameNormalised = companyNameNormalised(entry.data[parameters.companyNameField])
            const sourceNameNormalised = companyNameNormalised(company.title)
            const sourcePreviousNameNormalised = companyNameNormalised(company.snippet)
            if (entryNameNormalised === sourceNameNormalised || entryNameNormalised === sourcePreviousNameNormalised) return {
                matchType: 'normal',
                company
            }
            const entryNameUnsuffixed = companyNameUnsuffixed(entry.data[parameters.companyNameField])
            const sourceNameUnsuffixed = companyNameUnsuffixed(company.title)
            const sourcePreviousNameUnsuffixed = companyNameUnsuffixed(company.snippet)
            if (entryNameUnsuffixed === sourceNameUnsuffixed || entryNameUnsuffixed === sourcePreviousNameUnsuffixed) return {
                matchType: 'stem-only',
                company
            }
            return {
                matchType: 'other',
                company
            }
        }
        const byPreciseMatch = match => {
            if (!parameters.preciseMatch) return true
            return match.matchType !== 'other'
        }
        const companiesFiltered = companies
            .filter(byPostcode)
            .map(withMatchType)
            .filter(byPreciseMatch)
        if (companiesFiltered.length > maximumResults) alert({
            identifier: `"${response.passthrough.companyName}"`,
            message: `${companiesFiltered.length} matches, but only returning ${maximumResults}`,
            importance: 'warning'
        })
        const byMatchType = (a, b) => {
            if (a.matchType === 'normal' && b.matchType === 'normal') return 0
            if (a.matchType === 'normal' && b.matchType !== 'normal') return -1
            if (a.matchType !== 'normal' && b.matchType === 'normal') return +1
            if (a.matchType === 'stem-only' && b.matchType === 'stem-only') return 0
            if (a.matchType === 'stem-only' && b.matchType !== 'stem-only') return -1
            if (a.matchType !== 'stem-only' && b.matchType === 'stem-only') return +1
            return 0
        }
        const companiesOutput = companiesFiltered
            .slice(0, maximumResults)
            .sort(byMatchType)
        return companiesOutput.map(match => {
            const company = match.company
            const fields = {
                matchType: match.matchType,
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
        { name: 'matchType' },
        { name: 'companyNumber' },
        { name: 'companyName' },
        { name: 'companyCreationDate' },
        { name: 'companyCessationDate' },
        { name: 'companyPostcode' },
        { name: 'companyAddress' }
    ]
}

export default { initialise, details }
