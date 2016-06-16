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
        const apiVersion = 'v0.4.5'
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
        return body.results.company.officers.map(officer => {
            const fields = {
                companyName: body.results.company.name,
                officerName: officer.officer.name,
                officerPosition: officer.officer.position,
                officerStartDate: officer.officer.start_date,
                officerEndDate: officer.officer.end_date,
                officerNationality: officer.officer.nationality,
                officerOccupation: officer.officer.occupation
            }
            if (officer.officer.address) fields.officerAddress = officer.officer.address.replace(/\n/g,', ') // only if API token sent
            if (officer.officer.date_of_birth) fields.officerDateOfBirth = officer.officer.date_of_birth // only if API token sent
            return fields
        })
    }

    function run(input) {
        return new Promise((resolve, reject) => {
            Highland([input])
                .map(locate)
                .flatMap(http)
                .flatMap(parse)
                .collect()
                .errors(reject)
                .each(resolve)
        })
    }

    return run

}