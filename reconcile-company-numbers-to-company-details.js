const Highland = require('highland')
const Request = require('request')

module.exports = parameters => {

    const http = Highland.wrapCallback((location, callback) => {
        Request(location, (error, response) => {
            const failureSource = location.query.companyNumber + ' (' + location.query.companyJurisdiction + ')'
            const failure = error ? error
                  : response.statusCode === 403 ? new Error('You have reached the rate limit.' + (parameters.apiToken ? '' : ' Try using an API token.'))
                  : response.statusCode === 401 ? new Error('API token is invalid: ' + parameters.apiToken)
                  : response.statusCode === 404 ? new Error('Company not found: ' + failureSource)
                  : response.statusCode >=  400 ? new Error('Error ' + response.statusCode + ': ' + failureSource)
                  : null
            callback(failure, response)
        })
    })

    function locate(entry) {
        const apiVersion = 'v0.4.6'
        const companyNumber = entry[parameters.companyNumberField || 'companyNumber']
        const companyJurisdiction = parameters.jurisdiction || entry[parameters.companyJurisdictionField || 'companyJurisdiction']
        if (!companyNumber) throw new Error('No company number given!')
        if (!companyJurisdiction) throw new Error('No jurisdiction given: ' + companyNumber)
        const location = 'https://api.opencorporates.com/' + apiVersion + '/companies'
              + '/' + companyJurisdiction.trim()
              + '/' + companyNumber.trim()
              + (parameters.apiToken ? '?api_token=' + parameters.apiToken : '')
        return {
            uri: location,
            query: {
                companyNumber,
                companyJurisdiction
            }
        }
    }

    function parse(response) {
        const body = JSON.parse(response.body)
        const company = body.results.company
        return {
            companyJurisdiction: company.jurisdiction_code,
            companyName: company.name,
            companyIncorporationDate: company.incorporation_date,
            companyDissolutionDate: company.dissolution_date,
            companyType: company.company_type,
            companyStatus: company.current_status,
            companyAddress: company.registered_address_in_full.replace(/\n/g, ', '),
            companyPreviousNames: company.previous_names.map(name => name.company_name).join(', '),
            companyAlternativeNames: company.alternative_names.join(', '),
            companyBeneficialOwners: company.ultimate_beneficial_owners.map(owner => owner.ultimate_beneficial_owner.name).join(', '),
            companyAgentName: company.agent_name,
            companyAgentAddress: company.agent_address
        }
    }

    function toArray(item) {
      return [item]
    }

    function run(input) {
        return new Promise((resolve, reject) => {
            Highland([input])
                .map(locate)
                .flatMap(http)
                .map(parse)
                .map(toArray)
                .errors(reject)
                .each(resolve)
        })
    }

    return run

}
