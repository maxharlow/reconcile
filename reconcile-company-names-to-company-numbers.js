const Highland = require('highland')
const Request = require('request')

module.exports = parameters => {

    const http = Highland.wrapCallback((location, callback) => {
        Request(location, (error, response) => {
            const failureSource = location.query.companyName + (location.query.companyJurisdiction ? ' (' + location.query.companyJurisdiction + ')' : '')
            const failure = error ? error
                  : response.statusCode === 401 ? new Error('API token is invalid: ' + parameters.apiToken)
                  : response.statusCode >=  400 ? new Error('Error ' + response.statusCode + ': ' + failureSource)
                  : null
            callback(failure, response)
        })
    })

    function locate(entry) {
        const apiVersion = 'v0.4.5'
        if (!entry.companyName) throw new Error('No company name given!')
        const jurisdiction = parameters.jurisdiction || entry.companyJurisdiction
        const location = 'https://api.opencorporates.com/' + apiVersion + '/companies/search'
              + '?q=' + encodeURIComponent(entry.companyName.trim())
              + '&normalise_company_name=true'
              + (jurisdiction ? '&jurisdiction_code=' + jurisdiction.trim() : '')
              + (parameters.apiToken ? '&api_token=' + parameters.apiToken : '')
        return {
            uri: location,
            query: {
                companyName: entry.companyName,
                companyJurisdiction: jurisdiction
            }
        }
    }

    function parse(response) {
        const body = JSON.parse(response.body)
        if (body.results.companies.length === 0) {
            const jurisdiction = response.request.query.companyJurisdiction ? ' (' + response.request.query.companyJurisdiction + ')' : ''
            throw new Error('Company not found: ' + response.request.query.companyName + jurisdiction)
        }
        const company = body.results.companies[0].company
        return {
            companyJurisdiction: company.jurisdiction_code,
            companyNumber: company.company_number,
            companyName: company.name
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
