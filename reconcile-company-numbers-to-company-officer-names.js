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
    return 'https://api.opencorporates.com/' + apiVersion + '/companies'
        + '/' + entry.companyJuristiction
        + '/' + entry.companyNumber
        + (entry.apiToken ? '?api_token=' + entry.apiToken : '')
}

function parse(response) {
    return response.results.company.officers.map(officer => {
	    return {
            companyJuristiction: response.results.company.jurisdiction_code,
	        companyNumber: response.results.company.company_number,
	        companyName: response.results.company.name,
	        officerName: officer.officer.name,
	        officerPosition: officer.officer.position,
	        officerStartDate: officer.officer.start_date,
	        officerEndDate: officer.officer.end_date
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
