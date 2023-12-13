function initialise(parameters, requestor, alert) {

    const request = requestor({
        errors: response => {
            if (response.status === 404) return { message: 'could not find company' }
            if (response.status === 403) throw new Error('the rate limit has been reached')
            if (response.status === 401) throw new Error(`API token ${response.config.params.api_token} is invalid`)
            if (response.status >= 400) return { message: `received code ${response.status}`, retry: true }
        }
    })

    function locate(entry) {
        const apiVersion = 'v0.4.8'
        const companyNumber = entry.data[parameters.companyNumberField]
        const companyJurisdiction = parameters.jurisdiction || entry.data[parameters.companyJurisdictionField]
        if (!companyNumber || companyNumber.match(/^0+$/)) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no company number found',
                importance: 'error'
            })
            return
        }
        if (!companyJurisdiction) {
            alert({
                identifier: `Company ${companyNumber}`,
                message: `No jurisdiction found for company ${companyNumber}`,
                importance: 'error'
            })
            return
        }
        return {
            identifier: `Company ${companyNumber} (${companyJurisdiction})`,
            url: `https://api.opencorporates.com/${apiVersion}/companies/${companyJurisdiction}/${companyNumber}`,
            params: {
                api_token: parameters.apiToken
            },
            passthrough: {
                companyNumber,
                companyJurisdiction
            }
        }
    }

    function parse(response) {
        if (!response) return
        const officers = response.data.results.company.officers
        return officers.map(officer => {
            return {
                companyName: response.data.results.company.name,
                officerName: officer.officer.name,
                officerPosition: officer.officer.position,
                officerStartDate: officer.officer.start_date,
                officerEndDate: officer.officer.end_date,
                officerNationality: officer.officer.nationality,
                officerOccupation: officer.officer.occupation,
                officerAddress: officer.officer.address.replace(/\n/g, ', '),
                officerDateOfBirth: officer.officer.date_of_birth
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
            name: 'apiToken',
            description: 'An OpenCorporates API token.',
            required: true
        },
        {
            name: 'companyNumberField',
            description: 'Company number column.',
            required: true
        },
        {
            name: 'companyJurisdictionField',
            description: 'Jurisdiction code column, if any. It should use ISO 3166-2 format. Required unless jurisdiction is specified.'
        },
        {
            name: 'jurisdiction',
            description: 'If all companies have the same jurisdiction you can specify it here instead of in a column. Required unless companyJurisdictionField is specified.'
        }
    ],
    columns: [
        { name: 'companyName' },
        { name: 'officerName' },
        { name: 'officerPosition' },
        { name: 'officerStartDate' },
        { name: 'officerEndDate' },
        { name: 'officerNationality' },
        { name: 'officerOccupation' },
        { name: 'officerAddress' },
        { name: 'officerDateOfBirth' }
    ]
}

export default { initialise, details }
