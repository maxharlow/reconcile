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
            const individual = e.config.passthrough.individualName
            if (e.response.status === 429) die('The rate limit has been reached')
            if (e.response.status === 401) die(`API key ${e.config.auth.username} is invalid`)
            if (e.response.status >= 400) return `Received code ${e.response.status} for individual ${individual}`
        }
    })

    function locate(entry) {
        const individualName = entry[parameters.individualNameField]
        if (!individualName) throw new Error('No individual name found')
        return {
            url: 'https://api.company-information.service.gov.uk/search/officers',
            auth: {
                username: apiKeysRotated(),
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
                        username: apiKeysRotated(),
                        password: ''
                    },
                    params: {
                        q: response.passthrough.individualName.trim(),
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

    function parse(response, entry) {
        const individuals = response?.data.items
        const byDateOfBirth = individual => {
            if (!parameters.dateOfBirthField || !entry[parameters.dateOfBirthField]) return true // field not specified or field for this row is blank
            if (!individual.date_of_birth?.year || !individual.date_of_birth?.month) return false // date of birth specified in source, but no date of birth listed in this search result
            return individual.date_of_birth.year.toString() === entry[parameters.dateOfBirthField].slice(0, 4)
                && individual.date_of_birth.month.toString().padStart(2, '0') === entry[parameters.dateOfBirthField].slice(5, 7)
        }
        const normalised = name => {
            return name?.toLowerCase()
                .replace(/[^a-z ]/g, '')
                .replace(/^(mr|ms|mrs|miss|dr|sir)\.? /, '')
        }
        const byPreciseMatch = individual => {
            if (!parameters.preciseMatch) return true
            return normalised(individual.title) === normalised(entry[parameters.individualNameField])
        }
        const byNonMiddleNameMatch = individual => {
            if (!parameters.nonMiddleNameMatch) return true
            const entryIndividualName = normalised(entry[parameters.individualNameField])
            const resultIndividualName = normalised(individual.title)
            return resultIndividualName.split(' ')[0] === entryIndividualName.split(' ')[0]
                && resultIndividualName.split(' ').pop() === entryIndividualName.split(' ').pop()
        }
        return individuals.filter(byDateOfBirth).filter(byPreciseMatch).filter(byNonMiddleNameMatch).map(individual => {
            const fields = {
                officerID: individual.links.self.split('/')[2],
                officerName: individual.title,
                officerDateOfBirth: individual.date_of_birth ? [individual.date_of_birth.year, individual.date_of_birth.month, individual.date_of_birth.day].filter(x => x).join('-') : null,
                officerAddress: individual.address_snippet
            }
            return fields
        })
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataLocatedPaginated = await paginate(dataLocatedRequested)
        const dataParsed = dataLocatedPaginated.flatMap(response => parse(response, input))
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        { name: 'apiKey', description: 'A Companies House API key.' },
        { name: 'individualNameField', description: 'Individual name column.' },
        { name: 'dateOfBirthField', description: 'Date of birth column, in ISO 8601 format. If given will use the month and year to filter results. [optional]' },
        { name: 'nonMiddleNameMatch', description: 'Match individual name only based on the first and last names. Ignores non-alphabetical differences and titles. [optional]' },
        { name: 'preciseMatch', description: 'Match individual name precisely. Ignores non-alphabetical differences and titles. [optional]' }
    ],
    columns: [
        { name: 'officerID' },
        { name: 'officerName' },
        { name: 'officerDateOfBirth' },
        { name: 'officerAddress' }
    ]
}

export default { initialise, details }
