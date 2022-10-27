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
            const company = e.config.passthrough.companyNumber
            if (e.response.status === 429) die('The rate limit has been reached')
            if (e.response.status === 401) die(`API key ${e.config.auth.username} is invalid`)
            if (e.response.status >= 400) return `Received code ${e.response.status} for company ${company}`
        }
    })

    function locate(entry) {
        const companyNumber = entry.data[parameters.companyNumberField]
        if (!companyNumber || companyNumber.match(/^0+$/)) throw new Error(`No company number found on line ${entry.line}`)
        return { // note a 404 can just indicate no insolvency cases (as well as company not found)
            url: `https://api.company-information.service.gov.uk/company/${companyNumber.padStart(8, '0').toUpperCase()}/insolvency`,
            auth: {
                username: apiKeysRotated(),
                password: ''
            },
            passthrough: {
                companyNumber
            }
        }
    }

    function parse(response) {
        if (!response || !response.data) return []
        const getDate = (insolvencyCase, type) => {
            const elements = insolvencyCase.dates.filter(date => date.type === type)
            return elements ? elements.map(element => element.date).join('; ') : null
        }
        const companyInsolvencyStatus = response.data.status?.join('; ') || null
        const cases = response.data.cases
        if (!cases) return null
        return cases.map(insolvencyCase => {
            return {
                companyInsolvencyStatus,
                companyInsolvencyCaseNumber: insolvencyCase.number,
                companyInsolvencyCaseType: insolvencyCase.type,
                companyInsolvencyCaseWoundUpDate: getDate(insolvencyCase, 'wound-up-on'),
                companyInsolvencyCasePetitionedDate: getDate(insolvencyCase, 'petitioned-on'),
                companyInsolvencyCaseConcludedWindingUpDate: getDate(insolvencyCase, 'concluded-winding-up-on'),
                companyInsolvencyCaseDueToBeDissolvedDate: getDate(insolvencyCase, 'due-to-be-dissolved-on'),
                companyInsolvencyCaseDissolvedDate: getDate(insolvencyCase, 'dissolved-on'),
                companyInsolvencyCaseAdministrationStartedDate: getDate(insolvencyCase, 'administration-started-on'),
                companyInsolvencyCaseAdministrationEndedDate: getDate(insolvencyCase, 'administration-ended-on'),
                companyInsolvencyCaseAdministrationDischargedDate: getDate(insolvencyCase, 'administration-discharged-on'),
                companyInsolvencyCaseVoluntaryArrangementStartedDate: getDate(insolvencyCase, 'voluntary-arrangement-started-on'),
                companyInsolvencyCaseVoluntaryArrangementEndedDate: getDate(insolvencyCase, 'voluntary-arrangement-ended-on'),
                companyInsolvencyCaseMoratoriumStartedDate: getDate(insolvencyCase, 'moratorium-started-on'),
                companyInsolvencyCaseInstrumentedDate: getDate(insolvencyCase, 'instrumented-on'),
                companyInsolvencyCasePractitioners: insolvencyCase.practitioners.map(practitioner => {
                    const dateFrom = practitioner.appointed_on ? ` from ${practitioner.appointed_on}` : ''
                    const dateTo = practitioner.ceased_to_act_on ? ` to ${practitioner.ceased_to_act_on}` : ''
                    const date = dateFrom + dateTo
                    const address = [practitioner.address.address_line_1, practitioner.address.address_line_2, practitioner.address.locality, practitioner.address.region, practitioner.address.postal_code, practitioner.address.country].filter(x => x).join(', ')
                    return `${practitioner.name}, ${practitioner.role}${date} (${address})`
                }).join('; '),
                companyInsolvencyCaseNotes: insolvencyCase.notes
            }
        })
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataParsed = parse(dataLocatedRequested)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        { name: 'apiKey', description: 'A Companies House API key.' },
        { name: 'companyNumberField', description: 'Company number column.' }
    ],
    columns: [
        { name: 'companyInsolvencyStatus' },
        { name: 'companyInsolvencyCaseNumber' },
        { name: 'companyInsolvencyCaseType' },
        { name: 'companyInsolvencyCaseWoundUpDate' },
        { name: 'companyInsolvencyCasePetitionedDate' },
        { name: 'companyInsolvencyCaseConcludedWindingUpDate' },
        { name: 'companyInsolvencyCaseDueToBeDissolvedDate' },
        { name: 'companyInsolvencyCaseDissolvedDate' },
        { name: 'companyInsolvencyCaseAdministrationStartedDate' },
        { name: 'companyInsolvencyCaseAdministrationEndedDate' },
        { name: 'companyInsolvencyCaseAdministrationDischargedDate' },
        { name: 'companyInsolvencyCaseVoluntaryArrangementStartedDate' },
        { name: 'companyInsolvencyCaseVoluntaryArrangementEndedDate' },
        { name: 'companyInsolvencyCaseMoratoriumStartedDate' },
        { name: 'companyInsolvencyCaseInstrumentedDate' },
        { name: 'companyInsolvencyCasePractitioners' },
        { name: 'companyInsolvencyCaseNotes' }
    ]
}

export default { initialise, details }
