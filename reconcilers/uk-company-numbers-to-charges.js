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
        return {
            url: `https://api.company-information.service.gov.uk/company/${companyNumber.padStart(8, '0').toUpperCase()}/charges`,
            auth: {
                username: apiKeysRotated(),
                password: ''
            },
            params: {
                items_per_page: 100
            },
            validateStatus: status => status === 200 || status === 404, // as a 404 can just indicate no charges (as well as company not found)
            passthrough: {
                companyNumber
            }
        }
    }

    async function paginate(response) {
        if (response.data.total_results > 100) {
            const pageTotal = Math.ceil(response.data.total_results / 100)
            const pageNumbers = Array.from(Array(pageTotal).keys()).slice(1) // slice off first page as we already have that
            const pageRequests = pageNumbers.map(async page => {
                const query = {
                    url: response.url,
                    auth: {
                        username: apiKeysRotated(),
                        password: ''
                    },
                    params: {
                        items_per_page: 100,
                        start_index: page * 100
                    },
                    passthrough: {
                        companyNumber: response.passthrough.companyNumber
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
        const charges = response?.data.items || []
        return charges.map(charge => {
            const fields = {
                chargeCode: charge.charge_code || null,
                chargeNumber: charge.charge_number || null,
                chargeStatus: charge.status,
                chargePersonsEntitled: charge.persons_entitled?.map(person => person.name).join('; ') || null,
                chargeAcquiredDate: charge.acquired_on || null,
                chargeCreatedDate: charge.created_on || null,
                chargeDeliveredDate: charge.delivered_on || null,
                chargeResolvedDate: charge.resolved_on || null,
                chargeSatisfiedDate: charge.satisfied_on || null,
                chargeCoveringInstrumentDate: charge.covering_instrument_date || null,
                chargeTransactions: charge.transactions?.map((transaction, i) => {
                    return `#${i + 1}`
                        + (transaction.filing_type ? ` ${transaction.filing_type}` : '')
                        + (transaction.links && transaction.links.filing ? `: https://beta.companieshouse.gov.uk${transaction.links.filing}/document` : '')
                        + (transaction.delivered_on ? ` (${transaction.delivered_on})` : '')
                        + (transaction.transaction_id ? ` [transaction ${transaction.transaction_id}]` : '')
                        + (transaction.insolvency_case_number || (transaction.links && transaction.links.insolvency_case) ? ' [insolvency case' : '')
                        + (transaction.insolvency_case_number ? ` ${transaction.insolvency_case_number}` : '')
                        + (transaction.links && transaction.links.insolvency_case ? ` ${transaction.links.insolvency_case}` : '')
                        + (transaction.insolvency_case_number || (transaction.links && transaction.links.insolvency_case) ? ']' : '')
                }).join('; ') || null,
                chargeInsolvencyCases: charge.insolvency_cases?.map((insolvencyCase, i) => {
                    return `#${i + 1}`
                        + (insolvencyCase.links && insolvencyCase.links.case ? `: insolvencyCase.links.case` : '')
                        + (insolvencyCase.case_number ? ` [case ${insolvencyCase.case_number}]`: '')
                        + (insolvencyCase.transaction_id ? ` [transaction ${insolvencyCase.transaction_id}]` : '')
                }) || null,
                chargeParticulars: charge.particulars?.description || null,
                chargeContainsFixedCharge: charge.particulars?.contains_fixed_charge || false,
                chargeContainsFloatingCharge: charge.particulars?.contains_floating_charge || false,
                chargeContainsNegativePledge: charge.particulars?.contains_negative_pledge || false,
                chargeFloatingChargeCoversAll: charge.particulars?.floating_charge_covers_all || false,
                chargeChargorActingAsBareTrustee: charge.particulars?.chargor_acting_as_bare_trustee || false,
                chargeHasScottishAlterationsToOrder: charge.scottish_alterations?.has_alterations_to_order || false,
                chargeHasScottishAlterationsToProhibitions: charge.scottish_alterations?.has_alterations_to_prohibitions || false,
                chargeHasScottishAlterationsRestrictingProvisions: charge.scottish_alterations?.has_restricting_provisions || false,
                chargeAssetsCeasedReleased: charge.assets_ceased_released || null,
                chargeClassificationType: charge.classification?.type || null,
                chargeClassificationDescription: charge.classification?.description || null,
                chargeSecuredType: charge.secured_details?.type || null,
                chargeSecuredDescription: charge.secured_details?.description || null
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
        { name: 'companyNumberField', description: 'Company number column.' }
    ],
    columns: [
        { name: 'chargeCode' },
        { name: 'chargeNumber' },
        { name: 'chargeStatus' },
        { name: 'chargePersonsEntitled' },
        { name: 'chargeAcquiredDate' },
        { name: 'chargeCreatedDate' },
        { name: 'chargeDeliveredDate' },
        { name: 'chargeResolvedDate' },
        { name: 'chargeSatisfiedDate' },
        { name: 'chargeCoveringInstrumentDate' },
        { name: 'chargeTransactions' },
        { name: 'chargeInsolvencyCases' },
        { name: 'chargeParticulars' },
        { name: 'chargeContainsFixedCharge' },
        { name: 'chargeContainsFloatingCharge' },
        { name: 'chargeContainsNegativePledge' },
        { name: 'chargeFloatingChargeCoversAll' },
        { name: 'chargeChargorActingAsBareTrustee' },
        { name: 'chargeHasScottishAlterationsToOrder' },
        { name: 'chargeHasScottishAlterationsToProhibitions' },
        { name: 'chargeHasScottishAlterationsRestrictingProvisions' },
        { name: 'chargeAssetsCeasedReleased' },
        { name: 'chargeClassificationType' },
        { name: 'chargeClassificationDescription' },
        { name: 'chargeSecuredType' },
        { name: 'chargeSecuredDescription' }
    ]
}

export default { initialise, details }
