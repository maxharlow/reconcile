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
    return 'https://api.opencorporates.com/' + version + '/officers/search?q=' + entry['individualName'] + '?jurisdiction_code=' + entry['companyJurisdiction'] // + '&api_token=' + config.opencorporatesToken
}

function parse(response) {
    if (response.results.length === 0) throw new Error('No results')
    return response.results.officers.map(officer => {
	    return {
	        officerName: officer.officer.name,
	        officerPosition: officer.officer.position,
	        companyName: officer.officer.company.name,
	        companyNumber: officer.officer.company.company_number,
	    }
    })
}

highland(Highland.wrapCallback(FS.readFile)('individual-names.csv'))
    .through(CSVParser())
    .map(locate)
    .flatMap(http)
    .flatMap(parse)
    .through(CSVWriter())
    .pipe(FS.createWriteStream('company-officer-names.csv'))
