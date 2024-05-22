function initialise(parameters, requestor, alert) {

    const request = requestor({
        errors: response => {
            if (response.status >= 400) return { message: `received code ${response.status}`, retry: true }
        }
    })

    function locate(entry) {
        const companyNumber = entry.data[parameters.companyNumberField]
        if (!companyNumber) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no company number found',
                importance: 'error'
            })
            return
        }
        return {
            identifier: `Company ${companyNumber}`,
            url: 'https://bo.nalog.ru/advanced-search/organizations',
            params: {
                inn: companyNumber
            },
            passthrough: {
                companyNumber
            }
        }
    }

    function details(response) {
        if (!response) return
        if (response.data.content.length === 0) {
            alert({
                identifier: `Company ${response.passthrough.companyNumber}`,
                message: 'no accounting data found',
                importance: 'error'
            })
            return
        }
        const companyAccountingNumber = response.data.content[0].id
        return {
            identifier: `Company ${response.passthrough.companyNumber}`,
            url: `https://bo.nalog.ru/nbo/organizations/${companyAccountingNumber}/bfo`,
            passthrough: {
                companyNumber: response.passthrough.companyNumber,
                companyAccountingNumber
            }
        }
    }

    function parse(response) {
        if (!response || !response.data) return
        return response.data.flatMap(period => {
            const companyAccountingNumber = response.passthrough.companyAccountingNumber
            const companyAccountingPeriod = period.period
            const companyAccountingPeriodID = period.correction.id
            const sectionNames = ['balance', 'financialResult', 'capitalChange', 'fundsMovement']
            return sectionNames.filter(sectionName => sectionName in period.correction).flatMap(sectionName => {
                const section = period.correction[sectionName]
                const companyAccountingSection = sectionName.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
                const codes = Object.keys(section).filter(key => key.startsWith('current')).map(key => key.replace('current', ''))
                return codes.map(code => {
                    return {
                        companyAccountingNumber,
                        companyAccountingPeriodID,
                        companyAccountingPeriod,
                        companyAccountingSection,
                        companyAccountingIndicatorCode: code,
                        companyAccountingIndicatorValueCurrent: section[`current${code}`],
                        companyAccountingIndicatorValuePrevious: section[`previous${code}`] || null,
                        companyAccountingIndicatorValueBeforePrevious: section[`beforePrevious${code}`] || null
                    }
                })
            })
        })

    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataDetailed = details(dataLocatedRequested)
        const dataDetailedRequested = await request(dataDetailed)
        const dataParsed = parse(dataDetailedRequested)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        {
            name: 'companyNumberField',
            description: 'Company number (INN) column.',
            required: true
        }
    ],
    columns: [
        { name: 'companyAccountingNumber' },
        { name: 'companyAccountingPeriodID' },
        { name: 'companyAccountingPeriod' },
        { name: 'companyAccountingSection' },
        { name: 'companyAccountingIndicatorCode' },
        { name: 'companyAccountingIndicatorValueCurrent' },
        { name: 'companyAccountingIndicatorValuePrevious' },
        { name: 'companyAccountingIndicatorValueBeforePrevious' }
    ]
}

export default { initialise, details }
