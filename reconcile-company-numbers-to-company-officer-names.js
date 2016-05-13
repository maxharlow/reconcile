const Highland = require('highland')
const Request = require('request')
const FS = require('fs')
const CSVParser = require('csv-parser')
const CSVWriter = require('csv-write-stream')

const version = 'v0.4.5'

const http = Highland.wrapCallback((location, callback) => {
    Request(location, (error, response, body) => {
	    const errorStatus = (response.statusCode >= 400) ? new Error(response.statusCode + ' for ' + location) : null
	    callback(error || errorStatus, JSON.parse(response.body))
    })
})

function locate(entry) {
    return 'https://api.opencorporates.com/' + version + '/companies/' + entry['companyJuristiction'] + '/' + entry['companyNumber'] // + '?api_token=' + config.opencorporatesToken
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

Highland(Highland.wrapCallback(FS.readFile)('company-numbers.csv'))
    .through(CSVParser())
    .map(locate)
    .flatMap(http)
    .flatMap(parse)
    .errors(e => console.error(e.stack))
    .through(CSVWriter())
    .pipe(FS.createWriteStream('company-officer-names.csv'))
