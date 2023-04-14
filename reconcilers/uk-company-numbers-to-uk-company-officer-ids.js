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
            if (e.response.status === 404) return 'no company officers or company not found'
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
            identifier: `Company ${companyNumber}`,
            url: `https://api.company-information.service.gov.uk/company/${companyNumber.padStart(8, '0').toUpperCase()}/officers`,
            auth: {
                username: apiKeysRotated(),
                password: ''
            },
            params: {
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
        if (response.data.total_results > 100) {
            const pageTotal = Math.ceil(response.data.total_results / 100)
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
        const officers = response.data.items || []
        return officers.map(officer => {
            const [lastName, firstName] = officer.name.split(', ')
            const fields = {
                officerID: officer.links.officer.appointments.split('/')[2],
                officerName: firstName ? `${firstName} ${lastName}` : officer.name,
                officerDateOfBirth: officer.date_of_birth ? [officer.date_of_birth.year, officer.date_of_birth.month, officer.date_of_birth.day].filter(x => x).join('-') : null,
                officerNationality: officer.nationality || null,
                officerRole: officer.officer_role,
                officerAppointedDate: officer.appointed_on || null,
                officerResignedDate: officer.resigned_on || null,
                officerOccupation: officer.occupation || null,
                officerPostcode: officer.address.postal_code,
                officerAddress: officer.address ? [officer.address.care_of, officer.address.premises, officer.address.po_box, officer.address.address_line_1, officer.address.address_line_2, officer.address.locality, officer.address.region, officer.address.postal_code, officer.address.country].map(x => x?.trim()).filter(x => x).join(', ') : null,
                officerCountryOfResidence: officer.country_of_residence || null,
                officerFormerNames: officer.former_names ? officer.former_names.map(name => [name.surname, name.forenames].filter(name => !['NONE', 'NONE NONE', 'N/A', 'N/A N/A', undefined].includes(name)).join(', ')).filter(x => x.length).join('; ') : null,
                officerIdentificationType: officer.identification && officer.identification.identification_type ? officer.identification.identification_type : null,
                officerIdentificationLegalAuthority: officer.identification && officer.identification.legal_authority ? officer.identification.legal_authority : null,
                officerIdentificationLegalForm: officer.identification && officer.identification.legal_form ? officer.identification.legal_form : null,
                officerIdentificationRegisteredPlace: officer.identification && officer.identification.place_registered ? officer.identification.place_registered : null,
                officerIdentificationNumber: officer.identification && officer.identification.registration_number ? officer.identification.registration_number : null
            }
            return fields
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
        {
            name: 'apiKey',
            description: 'A Companies House API key.',
            required: true
        },
        {
            name: 'companyNumberField',
            description: 'Company number column.',
            required: true
        }
    ],
    columns: [
        { name: 'officerID' },
        { name: 'officerName' },
        { name: 'officerDateOfBirth' },
        { name: 'officerNationality' },
        { name: 'officerRole' },
        { name: 'officerAppointedDate' },
        { name: 'officerResignedDate' },
        { name: 'officerOccupation' },
        { name: 'officerPostcode' },
        { name: 'officerAddress' },
        { name: 'officerCountryOfResidence' },
        { name: 'officerFormerNames' },
        { name: 'officerIdentificationType' },
        { name: 'officerIdentificationLegalAuthority' },
        { name: 'officerIdentificationLegalForm' },
        { name: 'officerIdentificationRegisteredPlace' },
        { name: 'officerIdentificationNumber' }
    ]
}

export default { initialise, details }
