function initialise(parameters, requestor, die) {

    const request = requestor(2, e => {
        const individual = e.config.passthrough.individualName
        if (e.response.status === 429) die('The rate limit has been reached')
        if (e.response.status === 401) die(`API key ${e.config.auth.username} is invalid`)
        if (e.response.status >= 400) return `Received code ${e.response.status} for individual ${individual}`
    })

    function locate(entry) {
        const individualName = entry[parameters.individualNameField]
        if (!individualName) throw new Error('No individual name found')
        return {
            url: 'https://api.companieshouse.gov.uk/search/officers',
            auth: {
                username: parameters.apiKey,
                password: ''
            },
            params: {
                q: individualName.trim(),
                items_per_page: 100
            },
            passthrough: {
                individualName
            }
        }
    }

    async function paginate(response) {
        if (response.data.total_results > 100) {
            const pageTotal = Math.ceil(response.data.total_results / 100)
            const pageNumbers = Array.from(Array(pageTotal).keys()).slice(1, 10) // slice off first page as we already have that, and pages over 10 as the API responds with a HTTP 416
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
                        individualName: response.passthrough.individualName
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
        const individuals = response.data.items
        return individuals.map(individual => {
            const fields = {
                officerID: individual.links.self.split('/')[2],
                officerName: individual.title,
                officerBirthMonth: individual.date_of_birth ? individual.date_of_birth.month : null,
                officerBirthYear: individual.date_of_birth ? individual.date_of_birth.year : null,
                officerAppointments: individual.appointments,
                officerAddress: individual.address_snippet
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
        { name: 'individualNameField', description: 'Individual name column.' }
    ],
    columns: [
        { name: 'officerID' },
        { name: 'officerName' },
        { name: 'officerBirthMonth' },
        { name: 'officerBirthYear' },
        { name: 'officerAppointments' },
        { name: 'officerAddress' }
    ]
}

export default { initialise, details }
