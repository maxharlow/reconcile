function initialise(parameters, requestor, alert) {

    const request = requestor({
        messages: e => {
            if (e.response.status === 403) throw new Error('the rate limit has been reached')
            if (e.response.status === 401) throw new Error(`API token ${e.config.params.api_token} is invalid`)
            if (e.response.status >= 400) return `received code ${e.response.status} on page ${e.config.passthrough.page}`
        }
    })

    function locate(entry) {
        const apiVersion = 'v0.4.8'
        const name = entry.data[parameters.nameField]
        if (!name) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no name found',
                importance: 'error'
            })
            return
        }
        return {
            identifier: `"${name}"`,
            url: `https://api.opencorporates.com/${apiVersion}/statements/control_statements/search`,
            params: {
                controlling_entities_name: name,
                api_token: parameters.apiToken,
                per_page: 100
            },
            passthrough: {
                name,
                page: 1
            }
        }
    }

    async function paginate(response) {
        if (!response) return
        if (response.data.results.total_count > 100) {
            const pageTotal = response.data.results.total_pages
            const pageNumbers = Array.from(Array(pageTotal).keys()).slice(1) // slice off first page as we already have that
            const pageRequests = pageNumbers.map(async page => {
                const query = {
                    identifier: `"${response.passthrough.name}"`,
                    url: response.url,
                    params: {
                        controlling_entities_name: response.passthrough.name.trim(),
                        api_token: parameters.apiToken,
                        per_page: 100,
                        page
                    },
                    passthrough: {
                        name: response.passthrough.name,
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

    function parse(response, entry) {
        if (!response) return
        if (response.data.results.statements.length === 0) {
            alert({
                identifier: `"${response.passthrough.name}"`,
                message: 'could not find name',
                importance: 'error'
            })
            return
        }
        const statements = response.data.results.statements
        const byDateOfBirth = owner => {
            if (!entry.data[parameters.dateOfBirthField]) return true // column for this row is blank
            if (!owner.person) return false // companies won't have a date of birth
            if (!owner.person.date_of_birth?.year || !owner.person?.date_of_birth?.month) return false // date of birth specified in source, but no date of birth listed in this search result
            return owner.person?.date_of_birth.year.toString() === entry.data[parameters.dateOfBirthField].slice(0, 4)
                && owner.person?.date_of_birth.month.toString().padStart(2, '0') === entry.data[parameters.dateOfBirthField].slice(5, 7)
        }
        const normalised = name => {
            return name?.toLowerCase()
                .replace(/[^a-z ]/g, '')
                .replace(/^(mr|ms|mrs|miss|dr|sir)\.? /, '')
                .replace(/,? (qc|cbe|obe|mbe|bem|rvo)$/, '')
        }
        const byPreciseMatch = owner => {
            if (!parameters.preciseMatch) return true
            return normalised(owner.person?.name || owner.company.name) === normalised(entry.data[parameters.nameField])
        }
        const byNonMiddleNameMatch = owner => {
            if (!parameters.nonMiddleNameMatch) return true
            if (!owner.person) return true
            const entryName = normalised(entry.data[parameters.nameField])
            const resultName = normalised(owner.person.name)
            return resultName.split(' ')[0] === entryName.split(' ')[0]
                && resultName.split(' ').pop() === entryName.split(' ').pop()
        }
        return statements.flatMap(company => {
            return company.statement.controlling_entities.filter(byDateOfBirth).filter(byPreciseMatch).filter(byNonMiddleNameMatch).map(owner => {
                return {
                    beneficialOwnerName: owner.person?.name || owner.company?.name,
                    beneficialOwnerTitle: owner.person?.other_attributes?.name_parts?.title || null,
                    beneficialOwnerFirstName: owner.person?.other_attributes?.name_parts?.given_name || null,
                    beneficialOwnerMiddleNames: owner.person?.other_attributes?.name_parts?.middle_name || null,
                    beneficialOwnerLastName: owner.person?.other_attributes?.name_parts?.family_name || null,
                    beneficialOwnerKind: Object.keys(owner)[0],
                    beneficialOwnerControlMechanisms: company.statement.control_mechanisms.map(mechanism => mechanism.source_description).join('; '),
                    beneficialOwnerNotifiedDate: company.statement.other_attributes?.notified_on,
                    beneficialOwnerCeasedDate: company.statement.other_attributes?.ceased_on || null,
                    beneficialOwnerNationality: owner.person?.nationality || null,
                    beneficialOwnerAddress: [owner.person?.registered_address.street_address, owner.person?.registered_address.locality, owner.person?.registered_address.region, owner.person?.registered_address.postal_code].filter(x => x).join(', ').replace(/\n/g, ', ') || null,
                    beneficialOwnerDateOfBirth: [owner.person?.date_of_birth.month && owner.person?.date_of_birth.month.toString().padStart(2, '0'), owner.person?.date_of_birth.year].filter(x => x).join('-') || null,
                    beneficialOwnerCountryOfResidence: owner.person?.country_of_residence || null,
                    beneficialOwnerCompanyNumber: owner.company?.company_number || null,
                    beneficialOwnerCompanyJurisdiction: owner.company?.jurisdiction_code || null,
                    companyName: company.statement.controlled_entity.company.name || null,
                    companyNumber: company.statement.controlled_entity.company.company_number,
                    companyJurisdiction: company.statement.controlled_entity.company.jurisdiction_code || null
                }
            })
        })
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataLocatedPaginated = await paginate(dataLocatedRequested)
        if (!dataLocatedPaginated) return
        const dataParsed = dataLocatedPaginated.flatMap(response => parse(response, input))
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        {
            name: 'apiToken',
            description: 'An OpenCorporates API token.',
            required: true
        },
        {
            name: 'nameField',
            description: 'Name column.',
            required: true
        },
        {
            name: 'dateOfBirthField',
            description: 'Date of birth column, in ISO 8601 format. If given will use the month and year to filter results.'
        },
        {
            description: 'Match owner name only based on the first and last names. Ignores non-alphabetical differences and titles.',
            name: 'nonMiddleNameMatch'
        },
        {
            name: 'preciseMatch',
            description: 'Match owner name precisely. Ignores non-alphabetical differences and titles.'
        }
    ],
    columns: [
        { name: 'beneficialOwnerName' },
        { name: 'beneficialOwnerTitle' },
        { name: 'beneficialOwnerFirstName' },
        { name: 'beneficialOwnerMiddleNames' },
        { name: 'beneficialOwnerLastName' },
        { name: 'beneficialOwnerKind' },
        { name: 'beneficialOwnerControlMechanisms' },
        { name: 'beneficialOwnerNotifiedDate' },
        { name: 'beneficialOwnerCeasedDate' },
        { name: 'beneficialOwnerNationality' },
        { name: 'beneficialOwnerAddress' },
        { name: 'beneficialOwnerDateOfBirth' },
        { name: 'beneficialOwnerCountryOfResidence' },
        { name: 'beneficialOwnerCompanyNumber' },
        { name: 'beneficialOwnerCompanyJurisdiction' },
        { name: 'companyName' },
        { name: 'companyNumber' },
        { name: 'companyJurisdiction'}
    ]
}

export default { initialise, details }
