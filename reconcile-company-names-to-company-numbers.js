const Stream = require('stream')
const Highland = require('highland')
const Request = require('request')

const http = Highland.wrapCallback((location, callback) => {
    Request(location, (error, response) => {
        const failure = error ? error : (response.statusCode >= 400) ? new Error(response.statusCode) : null
        callback(failure, JSON.parse(response.body))
    })
})

function locate(entry) {
    const apiVersion = 'v0.4.5'
    return 'https://api.opencorporates.com/' + apiVersion + '/companies/search'
        + '?q=' + encodeURIComponent(entry.companyName)
        + '&normalise_company_name=true'
        + (entry.companyJuristiction ? '&jurisdiction_code=' + entry.companyJuristiction : '')
        + (entry.apiToken ? '&api_token=' + entry.apiToken : '')
}

function parse(response) {
    const company = response.results.companies[0].company
    return {
        companyJuristiction: company.jurisdiction_code,
        companyNumber: company.company_number,
        companyName: company.name
    }
}

function execute(input, output) {
    Highland([input])
        .map(locate)
        .flatMap(http)
        .map(parse)
        .each(output)
}

const run = new Stream.Transform({ objectMode: true })
run._transform = (chunk, _, done) => {
    execute(chunk, data => {
        run.push(data)
        done()
    })
}

module.exports = run
