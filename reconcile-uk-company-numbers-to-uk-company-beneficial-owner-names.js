function initialise(parameters, requestor) {

    const request = requestor(2, e => {
        const company = e.config.passthrough.companyNumber
        if (e.response.status === 404) return `Could not find company ${company}`
        if (e.response.status === 429) return 'The rate limit has been reached'
        if (e.response.status === 401) return `API key ${e.config.auth.username} is invalid`
        if (e.response.status >= 400) return `Received code ${e.response.status} for company ${company}`
    })

    function locate(entry) {
        const companyNumber = entry[parameters.companyNumberField || 'companyNumber']
        if (!companyNumber) throw new Error('No company number found')
        const url = `https://api.companieshouse.gov.uk/company`
            + '/' + companyNumber.trim()
            + '/persons-with-significant-control'
        return {
            url,
            auth: {
                username: parameters.apiKey,
                password: ''
            },
            params: {
                items_per_page: 100
            },
            passthrough: {
                companyNumber
            }
        }
    }

    async function paginate(response) {
        if (response.data.total_results > 100) {
            const pageTotal = Math.ceil(response.data.total_results / 100)
            const pageNumbers = Array.from(Array(pageTotal).keys()).slice(1) // slice off first page as we already have that
            const pageRequests = pageNumbers.map(async page => {
                const query = {
                    url: response.url,
                    auth: {
                        username: parameters.apiKey,
                        password: ''
                    },
                    params: {
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
        const persons = response.data.items
        return persons.map(person => {
            const fields = {
                beneficialOwnerName: person.name,
                beneficialOwnerTitle: person.name_elements ? person.name_elements.title : null,
                beneficialOwnerFirstName: person.name_elements ? person.name_elements.forename : null,
                beneficialOwnerOtherFirstNames: person.name_elements ? person.name_elements.other_forenames : null,
                beneficialOwnerMiddleNames: person.name_elements ? person.name_elements.middle_name : null,
                beneficialOwnerLastName: person.name_elements ? person.name_elements.surname : null,
                beneficialOwnerKind: person.kind,
                beneficialOwnerNaturesOfControl: person.natures_of_control.join('; '),
                beneficialOwnerNotifiedOn: person.notified_on,
                beneficialOwnerCeasedOn: person.ceased_on ? person.ceased_on : null,
                beneficialOwnerNationality: person.nationality ? person.nationality : null,
                beneficialOwnerAddress: [person.address.care_of, person.address.premises, person.address.address_line_1, person.address.address_line_2, person.address.locality, person.address.region, person.address.country, person.address.po_box, person.address.postal_code].filter(x => x).join(', '),
                beneficialOwnerDateOfBirth: person.date_of_birth ? [person.date_of_birth.year, person.date_of_birth.month, person.date_of_birth.day].filter(x => x).join('-') : null,
                beneficialOwnerCountryOfResidence: person.country_of_residence ? person.country_of_residence : null,
                beneficialOwnerIDLegalAuthority: person.identification && person.identification.legal_authority ? person.identification.legal_authority : null,
                beneficialOwnerIDLegalForm: person.identification && person.identification.legal_form ? person.identification.legal_form : null,
                beneficialOwnerIDRegisteredPlace: person.identification && person.identification.place_registered ? person.identification.place_registered : null,
                beneficialOwnerIDRegisteredCountry: person.identification && person.identification.country_registered ? person.identification.country_registered : null,
                beneficialOwnerIDNumber: person.identification && person.identification.registration_number ? person.identification.registration_number : null
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
        { name: 'companyNumberField', description: 'Company number column. [optional, default: "companyNumber"]' }
    ],
    columns: [
        { name: 'beneficialOwnerName' },
        { name: 'beneficialOwnerKind' },
        { name: 'beneficialOwnerNaturesOfControl' },
        { name: 'beneficialOwnerName' },
        { name: 'beneficialOwnerTitle' },
        { name: 'beneficialOwnerFirstName' },
        { name: 'beneficialOwnerMiddleNames' },
        { name: 'beneficialOwnerLastName' },
        { name: 'beneficialOwnerKind' },
        { name: 'beneficialOwnerNaturesOfControl' },
        { name: 'beneficialOwnerNotifiedOn' },
        { name: 'beneficialOwnerCeasedOn' },
        { name: 'beneficialOwnerNationality' },
        { name: 'beneficialOwnerAddress' },
        { name: 'beneficialOwnerDateOfBirth' },
        { name: 'beneficialOwnerCountryOfResidence' },
        { name: 'beneficialOwnerIDLegalAuthority' },
        { name: 'beneficialOwnerIDLegalForm' },
        { name: 'beneficialOwnerIDRegisteredPlace' },
        { name: 'beneficialOwnerIDRegisteredCountry' },
        { name: 'beneficialOwnerIDNumber' }
    ]
}

module.exports = { initialise, details }
