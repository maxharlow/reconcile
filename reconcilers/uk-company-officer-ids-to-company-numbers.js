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
            const officerID = e.config.passthrough.officerID
            if (e.response.status === 404) return `Could not find officer ID ${officerID}`
            if (e.response.status === 429) throw new Error('The rate limit has been reached')
            if (e.response.status === 401) throw new Error(`API key ${e.config.auth.username} is invalid`)
            if (e.response.status >= 400) return `Received code ${e.response.status} for officer ID ${officerID}`
        }
    })

    function locate(entry) {
        const officerID = entry.data[parameters.officerIDField]
        if (!officerID) {
            alert({
                message: `No officer ID found on line ${entry.line}`,
                importance: 'error'
            })
            return
        }
        return {
            url: `https://api.company-information.service.gov.uk/officers/${officerID}/appointments`,
            auth: {
                username: apiKeysRotated(),
                password: ''
            },
            params: {
                items_per_page: 50
            },
            passthrough: {
                officerID
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
                        officerID: response.passthrough.officerID
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
        const appointments = response?.data.items
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
                officerAddress: [appointment.address.care_of, appointment.address.premises, appointment.address.po_box, appointment.address.address_line_1, appointment.address.address_line_2, appointment.address.locality, appointment.address.region, appointment.address.postal_code, appointment.address.country].filter(x => x).join(', '),
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
        { name: 'apiKey', description: 'A Companies House API key.' },
        { name: 'officerIDField', description: 'Officer ID column.' }
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
