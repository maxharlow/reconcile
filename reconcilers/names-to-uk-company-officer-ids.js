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
            if (e.response.status === 401) throw new Error(`API key ${e.config.auth.username} is invalid`)
            if (e.response.status >= 400) return `received code ${e.response.status} on page ${e.config.passthrough.page}`
        }
    })

    function locate(entry) {
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
            url: 'https://api.company-information.service.gov.uk/search/officers',
            auth: {
                username: apiKeysRotated(),
                password: ''
            },
            params: {
                q: name.trim(),
                items_per_page: 100
            },
            passthrough: {
                name,
                page: 1
            }
        }
    }

    async function paginate(response) {
        if (!response) return
        if (response.data.total_results > 100) {
            const pageTotal = Math.ceil(response.data.total_results / 100)
            const pageNumbers = Array.from(Array(pageTotal).keys()).slice(1, 10) // slice off first page as we already have that, and pages over 10 as the API responds with a HTTP 416
            const pageRequests = pageNumbers.map(async page => {
                const query = {
                    identifier: `"${response.passthrough.name}"`,
                    url: response.url,
                    auth: {
                        username: apiKeysRotated(),
                        password: ''
                    },
                    params: {
                        q: response.passthrough.name.trim(),
                        items_per_page: 100,
                        start_index: page * 100
                    },
                    passthrough: {
                        name: response.passthrough.name,
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

    function parse(response, entry) {
        if (!response) return
        const officers = response.data.items
        const byDateOfBirth = officer => {
            if (!entry.data[parameters.dateOfBirthField]) return true // column for this row is blank
            if (!officer.date_of_birth?.year || !officer.date_of_birth?.month) return false // date of birth specified in source, but no date of birth listed in this search result
            return officer.date_of_birth.year.toString() === entry.data[parameters.dateOfBirthField].slice(0, 4)
                && officer.date_of_birth.month.toString().padStart(2, '0') === entry.data[parameters.dateOfBirthField].slice(5, 7)
        }
        const normalised = name => {
            return name?.toLowerCase()
                .replace(/[^a-z ]/g, '')
                .replace(/^(mr|ms|mrs|miss|dr|sir)\.? /, '')
                .replace(/,? (qc|cbe|obe|mbe|bem|rvo)$/, '')
        }
        const byPreciseMatch = officer => {
            if (!parameters.preciseMatch) return true
            return normalised(officer.title) === normalised(entry.data[parameters.nameField])
        }
        const byNonMiddleNameMatch = officer => {
            if (!parameters.nonMiddleNameMatch) return true
            const entryName = normalised(entry.data[parameters.nameField])
            const resultName = normalised(officer.title)
            return resultName.split(' ')[0] === entryName.split(' ')[0]
                && resultName.split(' ').pop() === entryName.split(' ').pop()
        }
        return officers.filter(byDateOfBirth).filter(byPreciseMatch).filter(byNonMiddleNameMatch).map(officer => {
            const fields = {
                officerID: officer.links.self.split('/')[2],
                officerName: officer.title,
                officerDateOfBirth: [officer.date_of_birth?.year, officer.date_of_birth?.month, officer.date_of_birth?.day].filter(x => x).join('-') || null,
                officerAddress: officer.address_snippet
            }
            return fields
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
            name: 'apiKey',
            description: 'A Companies House API key.',
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
            name: 'nonMiddleNameMatch',
            description: 'Match name only based on the first and last names. Ignores non-alphabetical differences and titles.'
        },
        {
            name: 'preciseMatch',
            description: 'Match name precisely. Ignores non-alphabetical differences and titles.'
        }
    ],
    columns: [
        { name: 'officerID' },
        { name: 'officerName' },
        { name: 'officerDateOfBirth' },
        { name: 'officerAddress' }
    ]
}

export default { initialise, details }
