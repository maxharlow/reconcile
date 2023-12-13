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
            if (response.status === 404) return { message: `could not find company` }
            if (response.status === 429) throw new Error('the rate limit has been reached')
            if (response.status === 401) throw new Error(`API key ${response.config.auth.username} is invalid`)
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
        return {
            identifier: `Company ${companyNumber}`,
            url: `https://api.company-information.service.gov.uk/company/${companyNumber.padStart(8, '0').toUpperCase()}`,
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
        const company = response.data
        return {
            companyNumber: company.company_number,
            companyName: company.company_name,
            companyUKJurisdiction: company.jurisdiction,
            companyCreationDate: company.date_of_creation,
            companyCessationDate: company.date_of_cessation | null,
            companyType: company.type,
            companySubtype: company.subtype || null,
            companyStatus: company.company_status,
            companyStatusDetail: company.company_status_detail || null,
            companyPostcode: company.registered_office_address.postal_code,
            companyAddress: [company.registered_office_address.care_of, company.registered_office_address.premises, company.registered_office_address.po_box, company.registered_office_address.address_line_1, company.registered_office_address.address_line_2, company.registered_office_address.locality, company.registered_office_address.region, company.registered_office_address.postal_code, company.registered_office_address.country].map(x => x?.trim()).filter(x => x).join(', '),
            companyAddressIsInDispute: company.registered_office_is_in_dispute,
            companyAddressIsUndeliverable: company.undeliverable_registered_office_address,
            companyPreviousNames: company.previous_company_names?.map(name => `${name.name} (${name.effective_from} to ${name.ceased_on})`).join('; ') || null,
            companySICCodes: company.sic_codes?.join('; ') || null,
            companyCanFile: company.can_file,
            companyHasInsolvencyHistory: company.has_insolvency_history || false,
            companyHasCharges: company.has_charges || false,
            companyHasBeenLiquidated: company.has_been_liquidated || false,
            companyAccountsOverdue: company.accounts?.overdue || false,
            companyAnnualReturnOverdue: company.annual_return?.overdue || false,
            companyPartialDataAvailable: company.partial_data_available || null,
            companyExternalRegistrationNumber: company.external_registration_number || null,
            companyLastFullMembersListDate: company.last_full_members_list_date || null
        }
    }

    async function run(input) {
        const dataLocated = locate(input)
        const dataLocatedRequested = await request(dataLocated)
        if (!dataLocatedRequested) return null
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
        { name: 'companyNumber' },
        { name: 'companyName' },
        { name: 'companyUKJurisdiction' },
        { name: 'companyCreationDate' },
        { name: 'companyCessationDate' },
        { name: 'companyType' },
        { name: 'companySubtype' },
        { name: 'companyStatus' },
        { name: 'companyStatusDetail' },
        { name: 'companyPostcode' },
        { name: 'companyAddress' },
        { name: 'companyAddressIsInDispute' },
        { name: 'companyAddressIsUndeliverable' },
        { name: 'companyPreviousNames' },
        { name: 'companySICCodes' },
        { name: 'companyCanFile' },
        { name: 'companyHasInsolvencyHistory' },
        { name: 'companyHasCharges' },
        { name: 'companyHasBeenLiquidated' },
        { name: 'companyAccountsOverdue' },
        { name: 'companyAnnualReturnOverdue' },
        { name: 'companyPartialDataAvailable' },
        { name: 'companyExternalRegistrationNumber' },
        { name: 'companyLastFullMembersListDate' }
    ]
}

export default { initialise, details }
