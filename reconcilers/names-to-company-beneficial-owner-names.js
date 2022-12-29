function initialise(parameters, requestor, alert) {

    const request = requestor({
        messages: e => {
            const name = e.config.passthrough.name
            if (e.response.status === 403) throw new Error('The rate limit has been reached')
            if (e.response.status === 401) throw new Error(`Invalid API token ${e.config.params.api_token}`)
            if (e.response.status >= 400) return `Received code ${e.response.status} for name ${name} [page ${e.config.passthrough.page}]`
        }
    })

    function locate(entry) {
        if (!parameters.apiToken) throw new Error('No API token found')
        const apiVersion = 'v0.4.8'
        const name = entry.data[parameters.nameField]
        if (!name) {
            alert({
                message: `No name found on line ${entry.line}`,
                importance: 'error'
            })
            return
        }
        return {
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

    function parse(response) {
        if (!response) return
        if (response.data.results.statements.length === 0) {
            const name = response.passthrough.name
            alert({
                message: `Could not find name ${name}`,
                importance: 'error'
            })
            return
        }
        const companies = response.data.results.statements
        return companies.flatMap(company => {
            return company.statement.controlling_entities.map(owner => {
                return {
                    beneficialOwnerName: (owner.person && owner.person.name) || (owner.company && owner.company.name),
                    beneficialOwnerCompanyNumber: owner.company && owner.company.company_number,
                    beneficialOwnerCompanyJurisdiction: owner.company && owner.company.jurisdiction_code,
                    beneficialOwnerBirthDate: owner.person && [owner.person.date_of_birth.month && owner.person.date_of_birth.month.toString().padStart(2, '0'), owner.person.date_of_birth.year].join('-'),
                    beneficialOwnerNationality: owner.person && owner.person.nationality,
                    beneficialOwnerCountryOfResidence: owner.person && owner.person.country_of_residence,
                    beneficialOwnerAddress: owner.person && [owner.person.registered_address.street_address, owner.person.registered_address.locality, owner.person.registered_address.region, owner.person.registered_address.postal_code].filter(x => x).join(', ').replace(/\n/g, ', '),
                    beneficialOwnerControlMechanisms: company.statement.control_mechanisms.map(mechanism => mechanism.source_description).join('; '),
                    companyName: company.statement.controlled_entity.company.name,
                    companyNumber: company.statement.controlled_entity.company.company_number,
                    companyJurisdiction: company.statement.controlled_entity.company.jurisdiction_code
                }
            })
        })
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataLocatedPaginated = await paginate(dataLocatedRequested)
        if (!dataLocatedPaginated) return
        const dataParsed = dataLocatedPaginated.flatMap(parse)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        { name: 'apiToken', description: 'An OpenCorporates API token.' },
        { name: 'nameField', description: 'Name column.' }
    ],
    columns: [
        { name: 'beneficialOwnerName' },
        { name: 'beneficialOwnerCompanyNumber' },
        { name: 'beneficialOwnerCompanyJurisdiction' },
        { name: 'beneficialOwnerBirthDate' },
        { name: 'beneficialOwnerNationality' },
        { name: 'beneficialOwnerCountryOfResidence' },
        { name: 'beneficialOwnerAddress' },
        { name: 'beneficialOwnerControlMechanisms' },
        { name: 'companyName' },
        { name: 'companyNumber' },
        { name: 'companyJurisdiction' }
    ]
}

export default { initialise, details }
