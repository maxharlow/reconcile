const Highland = require('highland')
const Request = require('request')

const http = Highland.wrapCallback((location, callback) => {
    Request(location, (error, response) => {
        const jurisdiction = location.query.companyJuristiction ? ' (' + location.query.companyJuristiction + ')' : ''
        const failure = error ? error
              : response.statusCode >= 400 ? new Error('Error ' + response.statusCode + ': ' + location.query.companyNumber + ' (' + juristiction + ')')
              : null
        callback(failure, response)
    })
})

function locate(entry) {
    const apiVersion = 'v0.4.5'
    const location = 'https://api.opencorporates.com/' + apiVersion + '/companies/search'
        + '?q=' + encodeURIComponent(entry.companyName)
        + '&normalise_company_name=true'
        + (entry.companyJuristiction ? '&jurisdiction_code=' + entry.companyJuristiction : '')
        + (entry.apiToken ? '&api_token=' + entry.apiToken : '')
    return {
        uri: location,
        query: {
            companyName: entry.companyName,
            companyJuristiction: entry.companyJuristiction
        }
    }
}

function parse(response) {
    const body = JSON.parse(response.body)
    if (body.results.companies.length === 0) {
        const jurisdiction = response.request.query.companyJuristiction ? ' (' + response.request.query.companyJuristiction + ')' : ''
        throw new Error('Company not found: ' + response.request.query.companyName + jurisdiction)
    }
    const company = body.results.companies[0].company
    return {
        companyJuristiction: company.jurisdiction_code,
        companyNumber: company.company_number,
        companyName: company.name
    }
}

function run(input) {
    return new Promise((resolve, reject) => {
        Highland([input])
            .map(locate)
            .flatMap(http)
            .map(parse)
            .errors(reject)
            .each(resolve)
    })
}

module.exports = run
