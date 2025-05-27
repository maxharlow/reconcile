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
            if (response.status === 404) return { message: 'could not find officer' }
            if (response.status === 429) return { message: 'the rate limit has been reached', retry: true } // don't throw as this happens from time to time
            if (response.status >= 400) return { message: `received code ${response.status} on page ${response.config.passthrough.page}`, retry: true }
        }
    })

    function locate(entry) {
        const officerID = entry.data[parameters.officerIDField]
        if (!officerID) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no officer ID found',
                importance: 'error'
            })
            return
        }
        return {
            identifier: officerID,
            url: `https://api.company-information.service.gov.uk/officers/${officerID}/appointments`,
            auth: {
                username: apiKeysRotated(),
                password: ''
            },
            params: {
                items_per_page: 50
            },
            passthrough: {
                officerID,
                page: 1
            }
        }
    }

    async function paginate(response) {
        if (!response) return
        if (response.data.total_results > 50) {
            const pageTotal = Math.ceil(response.data.total_results / 50)
            const pageNumbers = Array.from(Array(pageTotal).keys()).slice(1) // slice off first page as we already have that
            const pageRequests = pageNumbers.map(async page => {
                const query = {
                    identifier: response.passthrough.officerID,
                    url: response.url,
                    auth: {
                        username: apiKeysRotated(),
                        password: ''
                    },
                    params: {
                        items_per_page: 50,
                        start_index: page * 50
                    },
                    passthrough: {
                        officerID: response.passthrough.officerID,
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
        const appointments = response.data.items
        return appointments.map(appointment => {
            const fields = {
                companyNumber: appointment.appointed_to.company_number,
                companyName: appointment.appointed_to.company_name,
                companyStatus: appointment.appointed_to.company_status,
                officerID: response.passthrough.officerID,
                officerName: appointment.name,
                officerRole: appointment.officer_role,
                officerAppointedDate: appointment.appointed_on || null,
                officerResignedDate: appointment.resigned_on || null,
                officerNationality: appointment.nationality || null,
                officerOccupation: appointment.occupation || null,
                officerAddress: [appointment.address.care_of, appointment.address.premises, appointment.address.po_box, appointment.address.address_line_1, appointment.address.address_line_2, appointment.address.locality, appointment.address.region, appointment.address.postal_code, appointment.address.country].map(x => x?.trim()).filter(x => x).join(', '),
                officerCountryOfResidence: appointment.country_of_residence || null
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
            name: 'officerIDField',
            description: 'Officer ID column.',
            required: true
        }
    ],
    columns: [
        { name: 'companyNumber' },
        { name: 'companyName' },
        { name: 'companyStatus' },
        { name: 'officerID' },
        { name: 'officerName' },
        { name: 'officerNationality' },
        { name: 'officerRole' },
        { name: 'officerAppointedDate' },
        { name: 'officerResignedDate' },
        { name: 'officerOccupation' },
        { name: 'officerAddress' },
        { name: 'officerCountryOfResidence' }
    ]
}

export default { initialise, details }
