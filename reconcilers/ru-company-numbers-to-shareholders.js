function initialise(parameters, requestor, alert) {

    const request = requestor({
        errors: response => {
            if (response.status === 404) return { message: `could not find company` }
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
            url: `https://egrul.itsoft.ru/${companyNumber.padStart(10, '0')}.json`,
            passthrough: {
                companyNumber
            }
        }
    }

    function parse(response) {
        if (!response.data) {
            alert({
                identifier: `Company ${response.passthrough.companyNumber}`,
                message: 'company information is missing',
                importance: 'error'
            })
            return null
        }
        if (!response.data.СвЮЛ.СвУчредит) return []
        const shareholdersRussianCompanies = [(response.data.СвЮЛ.СвУчредит.УчрЮЛРос || [])].flat().map(shareholder => {
            if (shareholder.СвНедДанУчр) throw new Error('СвНедДанУчр')
            const restricted = shareholder.ОгрДосСв?.['@attributes'].ОгрДосСв
            return {
                shareholderType: 'russian-company' + (restricted ? '-restricted' : ''),
                shareholderName: restricted ? null : shareholder.НаимИННЮЛ['@attributes'].НаимЮЛПолн,
                shareholderCompanyNumber: restricted ? null : shareholder.НаимИННЮЛ['@attributes'].ИНН,
                shareholderCompanyNumberOGRN: restricted ? null : shareholder.НаимИННЮЛ['@attributes'].ОГРН,
                shareholderCompanyNameLatin: null,
                shareholderCompanyJurisdiction: null,
                shareholderCompanyRegistrar: null,
                shareholderCompanyAddress: null,
                shareholderIndividualForename: null,
                shareholderIndividualPatronymic: null,
                shareholderIndividualSurname: null,
                shareholderIndividualTaxNumber: null,
                shareholderIndividualCitizenship: null,
                shareholderSinceDate: restricted ? null : shareholder.ГРНДатаПерв['@attributes'].ДатаЗаписи,
                shareholderShareNumber: restricted ? null : shareholder.ДоляУстКап?.['@attributes'].НоминСтоим || null,
                shareholderSharePercentage: restricted ? null : shareholder.ДоляУстКап?.РазмерДоли?.Процент || null,
                shareholderShareLastChangedDate: restricted ? null : shareholder.ДоляУстКап?.ГРНДата['@attributes'].ДатаЗаписи,
                shareholderRegistrationLastChangedDate: restricted ? null : shareholder.НаимИННЮЛ.ГРНДата['@attributes'].ДатаЗаписи,
                shareholderRestrictedSinceDate: shareholder.ОгрДосСв?.ГРНДата['@attributes'].ДатаЗаписи || null
            }
        })
        const shareholdersForeignCompanies = [(response.data.СвЮЛ.СвУчредит.УчрЮЛИн || [])].flat().map(shareholder => {
            if (shareholder.СвНедДанУчр) throw new Error('СвНедДанУчр')
            const restricted = shareholder.ОгрДосСв?.['@attributes'].ОгрДосСв
            return {
                shareholderType: 'foreign-company' + (restricted ? '-restricted' : ''),
                shareholderName: restricted ? null : shareholder.НаимИННЮЛ['@attributes'].НаимЮЛПолн,
                shareholderCompanyNumber: restricted ? null : shareholder.СвРегИн?.['@attributes'].РегНомер || null,
                shareholderCompanyNumberOGRN: null,
                shareholderCompanyNameLatin: restricted ? null : shareholder.СвНаимЮЛПолнИн?.['@attributes'].НаимПолн || null,
                shareholderCompanyJurisdiction: restricted ? null : shareholder.СвРегИн['@attributes'].НаимСтран,
                shareholderCompanyRegistrar: restricted ? null : shareholder.СвРегИн['@attributes'].НаимРегОрг || null,
                shareholderCompanyAddress: restricted ? null : shareholder.СвРегИн['@attributes'].АдрСтр || null,
                shareholderIndividualForename: null,
                shareholderIndividualPatronymic: null,
                shareholderIndividualSurname: null,
                shareholderIndividualTaxNumber: null,
                shareholderIndividualCitizenship: null,
                shareholderSinceDate: restricted ? null : shareholder.ГРНДатаПерв['@attributes'].ДатаЗаписи,
                shareholderShareNumber: restricted ? null : shareholder.ДоляУстКап?.['@attributes'].НоминСтоим || null,
                shareholderSharePercentage: restricted ? null : shareholder.ДоляУстКап?.РазмерДоли?.Процент || null,
                shareholderShareLastChangedDate: restricted ? null : shareholder.ДоляУстКап?.ГРНДата['@attributes'].ДатаЗаписи,
                shareholderRegistrationLastChangedDate: restricted ? null : shareholder.НаимИННЮЛ.ГРНДата['@attributes'].ДатаЗаписи,
                shareholderRestrictedSinceDate: shareholder.ОгрДосСв?.ГРНДата['@attributes'].ДатаЗаписи || null
            }
        })
        const shareholdersIndividuals = [(response.data.СвЮЛ.СвУчредит.УчрФЛ || [])].flat().map(shareholder => {
            if (shareholder.СвНедДанУчр) throw new Error('СвНедДанУчр')
            const restricted = shareholder.ОгрДосСв?.['@attributes'].ОгрДосСв
            return {
                shareholderType: 'individual' + (restricted ? '-restricted' : ''),
                shareholderName: restricted ? null : [shareholder.СвФЛ['@attributes'].Имя, shareholder.СвФЛ['@attributes'].Отчество, shareholder.СвФЛ['@attributes'].Фамилия].filter(x => x).join(' '),
                shareholderCompanyNumber: null,
                shareholderCompanyNumberOGRN: null,
                shareholderCompanyNameLatin: null,
                shareholderCompanyJurisdiction: null,
                shareholderCompanyRegistrar: null,
                shareholderCompanyAddress: null,
                shareholderIndividualForename: restricted ? null : shareholder.СвФЛ['@attributes'].Имя,
                shareholderIndividualPatronymic: restricted ? null : shareholder.СвФЛ['@attributes'].Отчество,
                shareholderIndividualSurname: restricted ? null : shareholder.СвФЛ['@attributes'].Фамилия,
                shareholderIndividualTaxNumber: restricted ? null : shareholder.СвФЛ['@attributes'].ИННФЛ,
                shareholderIndividualCitizenship: restricted ? null : shareholder.СвГраждФЛ?.['@attributes'].НаимСтран || null,
                shareholderSinceDate: restricted ? null : shareholder.ГРНДатаПерв['@attributes'].ДатаЗаписи,
                shareholderShareNumber: restricted ? null : shareholder.ДоляУстКап?.['@attributes'].НоминСтоим || null,
                shareholderSharePercentage: restricted ? null : shareholder.ДоляУстКап?.РазмерДоли?.Процент || null,
                shareholderShareLastChangedDate: restricted ? null : shareholder.ДоляУстКап?.ГРНДата['@attributes'].ДатаЗаписи,
                shareholderRegistrationLastChangedDate: restricted ? null : shareholder.СвФЛ.ГРНДата['@attributes'].ДатаЗаписи,
                shareholderRestrictedSinceDate: shareholder.ОгрДосСв?.ГРНДата['@attributes'].ДатаЗаписи || null
            }
        })
        const shareholdersPublicBodies = [(response.data.СвЮЛ.СвУчредит.УчрРФСубМО || [])].flat().map(shareholder => {
            const restricted = shareholder.ОгрДосСв?.['@attributes'].ОгрДосСв
            return {
                shareholderType: 'public-body' + (restricted ? '-restricted' : ''),
                shareholderName: restricted ? null : (shareholder.ВидНаимУчр['@attributes'].НаимМО || 'РОССИЙСКАЯ ФЕДЕРАЦИЯ'),
                shareholderCompanyNumber: null,
                shareholderCompanyNumberOGRN: null,
                shareholderCompanyNameLatin: null,
                shareholderCompanyJurisdiction: null,
                shareholderCompanyRegistrar: null,
                shareholderCompanyAddress: null,
                shareholderIndividualForename: null,
                shareholderIndividualPatronymic: null,
                shareholderIndividualSurname: null,
                shareholderIndividualTaxNumber: null,
                shareholderIndividualCitizenship: null,
                shareholderSinceDate: restricted ? null : shareholder.ГРНДатаПерв['@attributes'].ДатаЗаписи,
                shareholderShareNumber: restricted ? null : shareholder.ДоляУстКап?.['@attributes'].НоминСтоим || null,
                shareholderSharePercentage: restricted ? null : shareholder.ДоляУстКап?.РазмерДоли?.Процент || null,
                shareholderRegistrationLastChangedDate: restricted ? null : shareholder.ВидНаимУчр['@attributes'].ДатаЗаписи || null,
                shareholderRestrictedSinceDate: shareholder.ОгрДосСв?.ГРНДата['@attributes'].ДатаЗаписи || null
            }
        })
        const shareholdersMutualInvestmentFund = [(response.data.СвЮЛ.СвУчредит.УчрПИФ || [])].flat().map(shareholder => {
            const restricted = shareholder.ОгрДосСв?.['@attributes'].ОгрДосСв
            return {
                shareholderType: 'mutual-investment-fund' + (restricted ? '-restricted' : ''),
                shareholderName: restricted ? null : shareholder.СвНаимПИФ['@attributes'].НаимПИФ,
                shareholderCompanyNumber: null,
                shareholderCompanyNumberOGRN: null,
                shareholderCompanyNameLatin: null,
                shareholderCompanyJurisdiction: null,
                shareholderCompanyRegistrar: null,
                shareholderCompanyAddress: null,
                shareholderIndividualForename: null,
                shareholderIndividualPatronymic: null,
                shareholderIndividualSurname: null,
                shareholderIndividualTaxNumber: null,
                shareholderIndividualCitizenship: null,
                shareholderSinceDate: restricted ? null : shareholder.ГРНДатаПерв['@attributes'].ДатаЗаписи,
                shareholderShareNumber: restricted ? null : shareholder.ДоляУстКап?.['@attributes'].НоминСтоим || null,
                shareholderSharePercentage: restricted ? null : shareholder.ДоляУстКап?.РазмерДоли?.Процент || null,
                shareholderShareLastChangedDate: restricted ? null : shareholder.ДоляУстКап?.ГРНДата['@attributes'].ДатаЗаписи,
                shareholderRegistrationLastChangedDate: restricted ? null : shareholder.СвНаимПИФ.ГРНДата['@attributes'].ДатаЗаписи,
                shareholderRestrictedSinceDate: shareholder.ОгрДосСв?.ГРНДата['@attributes'].ДатаЗаписи || null
            }
        })
        const shareholdersInvestmentPartnershipAgreement = [(response.data.СвЮЛ.СвУчредит.УчрДогИнвТов || [])].flat().map(shareholder => {
            const restricted = shareholder.ОгрДосСв?.['@attributes'].ОгрДосСв
            return {
                shareholderType: 'investment-partnership-agreement' + (restricted ? '-restricted' : ''),
                shareholderName: restricted ? null : shareholder.ИнПрДогИнвТов['@attributes'].НаимДог,
                shareholderCompanyNumber: null,
                shareholderCompanyNumberOGRN: null,
                shareholderCompanyNameLatin: null,
                shareholderCompanyJurisdiction: null,
                shareholderCompanyRegistrar: null,
                shareholderCompanyAddress: null,
                shareholderIndividualForename: null,
                shareholderIndividualPatronymic: null,
                shareholderIndividualSurname: null,
                shareholderIndividualTaxNumber: null,
                shareholderIndividualCitizenship: null,
                shareholderSinceDate: restricted ? null : shareholder.ГРНДатаПерв['@attributes'].ДатаЗаписи,
                shareholderShareNumber: restricted ? null : shareholder.ДоляУстКап?.['@attributes'].НоминСтоим || null,
                shareholderSharePercentage: restricted ? null : shareholder.ДоляУстКап?.РазмерДоли?.Процент || null,
                shareholderShareLastChangedDate: restricted ? null : shareholder.ДоляУстКап?.ГРНДата['@attributes'].ДатаЗаписи,
                shareholderRegistrationLastChangedDate: restricted ? null : shareholder.ИнПрДогИнвТов.ГРНДата['@attributes'].ДатаЗаписи,
                shareholderRestrictedSinceDate: shareholder.ОгрДосСв?.ГРНДата['@attributes'].ДатаЗаписи || null
            }
        })
        return [
            ...shareholdersRussianCompanies,
            ...shareholdersForeignCompanies,
            ...shareholdersIndividuals,
            ...shareholdersPublicBodies,
            ...shareholdersMutualInvestmentFund,
            ...shareholdersInvestmentPartnershipAgreement
        ]
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
            name: 'companyNumberField',
            description: 'Company number column.',
            required: true
        }
    ],
    columns: [
        { name: 'shareholderType' },
        { name: 'shareholderName' },
        { name: 'shareholderCompanyNumber' },
        { name: 'shareholderCompanyNumberOGRN' },
        { name: 'shareholderCompanyName' },
        { name: 'shareholderCompanyNameLatin' },
        { name: 'shareholderCompanyJurisdiction' },
        { name: 'shareholderCompanyRegistrar' },
        { name: 'shareholderCompanyAddress' },
        { name: 'shareholderIndividualForename' },
        { name: 'shareholderIndividualPatronymic' },
        { name: 'shareholderIndividualSurname' },
        { name: 'shareholderIndividualTaxNumber' },
        { name: 'shareholderIndividualCitizenship' },
        { name: 'shareholderSinceDate' },
        { name: 'shareholderShareNumber' },
        { name: 'shareholderSharePercentage' },
        { name: 'shareholderShareLastChangedDate' },
        { name: 'shareholderRegistrationLastChangedDate' },
        { name: 'shareholderRestrictedSinceDate' }
    ]
}

export default { initialise, details }
