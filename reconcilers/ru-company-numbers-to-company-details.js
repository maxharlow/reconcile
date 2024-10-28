function initialise(parameters, requestor, alert) {

    const request = requestor({
        errors: response => {
            if (response.status === 404) return { message: 'could not find company' }
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
        const company = response.data
        if (!company) {
            alert({
                identifier: `Company ${response.passthrough.companyNumber}`,
                message: 'company information is missing',
                importance: 'error'
            })
            return null
        }
        return {
            companyNumberOGRN: company.СвЮЛ['@attributes'].ОГРН,
            companyName: company.СвЮЛ.СвНаимЮЛ['@attributes'].НаимЮЛПолн,
            companyNameShort: company.СвЮЛ.СвНаимЮЛ.СвНаимЮЛСокр?.['@attributes'].НаимСокр || null,
            companyCreationDate: company.СвЮЛ.СвОбрЮЛ['@attributes'].ДатаРег || company.СвЮЛ.СвОбрЮЛ['@attributes'].ДатаОГРН,
            companyCessationDate: company.СвЮЛ.СвПрекрЮЛ?.['@attributes'].ДатаПрекрЮЛ || null,
            companyType: company.СвЮЛ['@attributes'].ПолнНаимОПФ,
            companyAddress: (company.СвЮЛ.СвАдресЮЛ.АдресРФ ? [
                company.СвЮЛ.СвАдресЮЛ.АдресРФ['@attributes'].Индекс,
                company.СвЮЛ.СвАдресЮЛ.АдресРФ.Регион['@attributes'].НаимРегион,
                company.СвЮЛ.СвАдресЮЛ.АдресРФ.Улица?.['@attributes'].ТипУлица,
                company.СвЮЛ.СвАдресЮЛ.АдресРФ.Улица?.['@attributes'].НаимУлица,
                company.СвЮЛ.СвАдресЮЛ.АдресРФ['@attributes'].Дом,
                company.СвЮЛ.СвАдресЮЛ.АдресРФ['@attributes'].Кварт,
            ] : [
                company.СвЮЛ.СвАдресЮЛ.СвАдрЮЛФИАС?.['@attributes'].Индекс,
                company.СвЮЛ.СвАдресЮЛ.СвАдрЮЛФИАС?.НаимРегион,
                company.СвЮЛ.СвАдресЮЛ.СвАдрЮЛФИАС?.МуниципРайон['@attributes'].Наим,
                company.СвЮЛ.СвАдресЮЛ.СвАдрЮЛФИАС?.НаселенПункт?.['@attributes'].Наим,
                company.СвЮЛ.СвАдресЮЛ.СвАдрЮЛФИАС?.ЭлПланСтруктур?.['@attributes'].Тип,
                company.СвЮЛ.СвАдресЮЛ.СвАдрЮЛФИАС?.ЭлПланСтруктур?.['@attributes'].Наим,
                company.СвЮЛ.СвАдресЮЛ.СвАдрЮЛФИАС?.ЭлУлДорСети?.['@attributes'].Тип,
                company.СвЮЛ.СвАдресЮЛ.СвАдрЮЛФИАС?.ЭлУлДорСети?.['@attributes'].Наим
            ]).filter(x => x).join(', '),
            companyManagementCompanyName: company.СвЮЛ.СвУпрОрг?.НаимИННЮЛ?.['@attributes'].НаимЮЛПолн || null,
            companyManagementCompanyNumber: company.СвЮЛ.СвУпрОрг?.НаимИННЮЛ?.['@attributes'].ИНН || null,
            companyManagementCompanyNumberOGRN: company.СвЮЛ.СвУпрОрг?.НаимИННЮЛ?.['@attributes'].ОГРН || null,
            companyActivityCodeMain: company.СвЮЛ.СвОКВЭД?.СвОКВЭДОсн['@attributes'].КодОКВЭД || null,
            companyActivityCodesAdditional: [(company.СвЮЛ.СвОКВЭД?.СвОКВЭДДоп || [])].flat().map(activity => activity['@attributes'].КодОКВЭД).join('; ') || null
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
            name: 'companyNumberField',
            description: 'Company number column.',
            required: true
        }
    ],
    columns: [
        { name: 'companyNumberOGRN' },
        { name: 'companyName' },
        { name: 'companyNameShort' },
        { name: 'companyCreationDate' },
        { name: 'companyCessationDate' },
        { name: 'companyType' },
        { name: 'companyAddress' },
        { name: 'companyManagementCompanyName' },
        { name: 'companyManagementCompanyNumber' },
        { name: 'companyManagementCompanyNumberOGRN' },
        { name: 'companyActivityCodeMain' },
        { name: 'companyActivityCodesAdditional' }
    ]
}

export default { initialise, details }
