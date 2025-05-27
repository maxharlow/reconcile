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
            if (response.status === 429) return { message: 'the rate limit has been reached', retry: true } // don't throw as this happens from time to time
            if (response.status >= 400) return { message: `received code ${response.status}`, retry: true }
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
        return { // note a 404 can just indicate no insolvency cases (as well as company not found)
            identifier: `Company ${companyNumber}`,
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
                companyInsolvencyCaseWoundUpDate: getDate(insolvencyCase, 'wound-up-on') || null,
                companyInsolvencyCasePetitionedDate: getDate(insolvencyCase, 'petitioned-on') || null,
                companyInsolvencyCaseConcludedWindingUpDate: getDate(insolvencyCase, 'concluded-winding-up-on') || null,
                companyInsolvencyCaseDueToBeDissolvedDate: getDate(insolvencyCase, 'due-to-be-dissolved-on') || null,
                companyInsolvencyCaseDissolvedDate: getDate(insolvencyCase, 'dissolved-on') || null,
                companyInsolvencyCaseAdministrationStartedDate: getDate(insolvencyCase, 'administration-started-on') || null,
                companyInsolvencyCaseAdministrationEndedDate: getDate(insolvencyCase, 'administration-ended-on') || null,
                companyInsolvencyCaseAdministrationDischargedDate: getDate(insolvencyCase, 'administration-discharged-on') || null,
                companyInsolvencyCaseVoluntaryArrangementStartedDate: getDate(insolvencyCase, 'voluntary-arrangement-started-on') || null,
                companyInsolvencyCaseVoluntaryArrangementEndedDate: getDate(insolvencyCase, 'voluntary-arrangement-ended-on') || null,
                companyInsolvencyCaseMoratoriumStartedDate: getDate(insolvencyCase, 'moratorium-started-on') || null,
                companyInsolvencyCaseInstrumentedDate: getDate(insolvencyCase, 'instrumented-on') || null,
                companyInsolvencyCasePractitioners: insolvencyCase.practitioners.map(practitioner => {
                    const dateFrom = practitioner.appointed_on ? ` from ${practitioner.appointed_on}` : ''
                    const dateTo = practitioner.ceased_to_act_on ? ` to ${practitioner.ceased_to_act_on}` : ''
                    const date = dateFrom + dateTo
                    const address = [practitioner.address.address_line_1, practitioner.address.address_line_2, practitioner.address.locality, practitioner.address.region, practitioner.address.postal_code, practitioner.address.country].map(x => x?.trim()).filter(x => x).join(', ')
                    return `${practitioner.name}, ${practitioner.role}${date} (${address})`
                }).join('; '),
                companyInsolvencyCaseNotes: insolvencyCase.notes || null
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
