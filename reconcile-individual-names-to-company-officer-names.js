const Highland = require('highland')
const Request = require('request')

module.exports = (apiToken) => {

    const http = Highland.wrapCallback((location, callback) => {
        Request(location, (error, response) => {
            const jurisdiction = location.query.individualJuristiction ? ' (' + location.query.individualJuristiction + ')' : ''
            const failure = error ? error
                  : response.statusCode >=  400 ? new Error('Error ' + response.statusCode + ': ' + location.query.individualName + ' (' + juristiction + ')')
                  : null
            callback(failure, response)
        })
    })

    function locate(entry) {
        const apiVersion = 'v0.4.5'
        const location = 'https://api.opencorporates.com/' + apiVersion + '/officers/search'
              + '?q=' + entry.individualName.trim()
              + (entry.individualJuristiction ? '&jurisdiction_code=' + entry.individualJuristiction.trim() : '')
              + (apiToken ? '&api_token=' + apiToken : '')
        return {
            uri: location,
            query: {
                individualName: entry.individualName,
                individualJuristiction: entry.individualJuristiction
            }
        }
    }

    function parse(response) {
        const body = JSON.parse(response.body)
        if (body.results.officers.length === 0) {
            const jurisdiction = response.request.query.individualJuristiction ? ' (' + response.request.query.individualJuristiction + ')' : ''
            throw new Error('Individual not found: ' + response.request.query.individualName + jurisdiction)
        }
        return body.results.officers.map(officer => {
	        return {
	            officerName: officer.officer.name,
	            officerPosition: officer.officer.position,
	            companyName: officer.officer.company.name,
	            companyNumber: officer.officer.company.company_number,
	        }
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

}
