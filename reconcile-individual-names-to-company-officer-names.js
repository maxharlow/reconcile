const Highland = require('highland')
const Request = require('request')

module.exports = parameters => {

    const http = Highland.wrapCallback((location, callback) => {
        Request(location, (error, response) => {
            const failureSource = location.query.individualName + (location.query.individualJurisdiction ? ' (' + location.query.individualJurisdiction + ')' : '')
            const failure = error ? error
                  : response.statusCode === 403 ? new Error('You have reached the rate limit.' + (parameters.apiToken ? '' : ' Try using an API token.'))
                  : response.statusCode === 401 ? new Error('API token is invalid: ' + parameters.apiToken)
                  : response.statusCode >=  400 ? new Error('Error ' + response.statusCode + ': ' + failureSource)
                  : null
            callback(failure, response)
        })
    })

    function locate(entry) {
        const apiVersion = 'v0.4.6'
        const individualName = entry[parameters.individualNameField || 'individualName']
        const individualDateOfBirth = entry[parameters.individualDateOfBirthField || 'individualDateOfBirth']
        const individualJurisdiction = parameters.jurisdiction || entry[parameters.individualJurisdictionField || 'individualJurisdiction']
        if (!individualName) throw new Error('No individual name given!')
        return {
            uri: 'https://api.opencorporates.com/' + apiVersion + '/officers/search',
            qs: {
                q: individualName.trim(),
                date_of_birth: individualDateOfBirth ? individualDateOfBirth : undefined,
                jurisdiction_code: individualJurisdiction ? individualJurisdiction.trim() : undefined,
                api_token: parameters.apiToken
            },
            query: { // only used for later reference
                individualName,
                individualJurisdiction
            }
        }
    }

    function parse(response) {
        const body = JSON.parse(response.body)
        if (body.results.officers.length === 0) {
            const jurisdiction = response.request.query.individualJurisdiction ? ' (' + response.request.query.individualJurisdiction + ')' : ''
            throw new Error('Individual not found: ' + response.request.query.individualName + jurisdiction)
        }
        return body.results.officers.map(officer => {
            const fields = {
                officerName: officer.officer.name,
                officerPosition: officer.officer.position,
                officerStartDate: officer.officer.start_date,
                officerEndDate: officer.officer.end_date,
                officerNationality: officer.officer.nationality,
                officerOccupation: officer.officer.occupation,
                companyName: officer.officer.company.name,
                companyNumber: officer.officer.company.company_number,
                companyJurisdiction: officer.officer.company.jurisdiction_code
            }
            if (officer.officer.address !== undefined) fields.officerAddress = officer.officer.address.replace(/\n/g,', ') // only if API key sent
            if (officer.officer.date_of_birth !== undefined) fields.officerDateOfBirth = officer.officer.date_of_birth // only if API key sent
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
