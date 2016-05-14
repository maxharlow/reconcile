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
    return 'https://api.opencorporates.com/' + apiVersion + '/officers/search'
        + '?q=' + entry.individualName
        + (entry.individualJuristiction ? '&jurisdiction_code=' + entry.individualJuristiction : '')
        + (entry.apiToken ? '&api_token=' + entry.apiToken : '')
}

function parse(response) {
    return response.results.officers.map(officer => {
	    return {
	        officerName: officer.officer.name,
	        officerPosition: officer.officer.position,
	        companyName: officer.officer.company.name,
	        companyNumber: officer.officer.company.company_number,
	    }
    })
}

function execute(input, output) {
    Highland([input])
        .map(locate)
        .flatMap(http)
        .flatMap(parse)
        .collect()
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
