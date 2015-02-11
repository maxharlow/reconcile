var highland = require('highland')
var request = require('request')
var moment = require('moment')
var fs = require('fs')
var csvParser = require('csv-parser')
var csvWriter = require('csv-write-stream')
var config = require('./config.json')

var http = highland.wrapCallback(function (location, callback) {
    request(location, function (error, response, body) {
	var errorStatus = (response.statusCode >= 400) ? new Error(response.statusCode) : null
	callback(error || errorStatus, JSON.parse(response.body))
    })
})

var read = highland.wrapCallback(fs.readFile)

function locate(entry) {
    return 'https://api.opencorporates.com/companies/gb/' + entry['companyNumber'] + '?api_token=' + config.opencorporatesToken
}

function parse(response) {
    if (response.results.length === 0) throw new Error('No results')
    var officers = response.results.company.officers.map(function (officer) {
	return {
	    companyName: response.results.company.name,
	    companyNumber: response.results.company.company_number,
	    officerName: officer.officer.name,
	    officerPosition: officer.officer.position,
	    officerStartDate: officer.officer.start_date,
	    officerEndDate: officer.officer.end_date
	}
    })
    return officers.filter(function (officer) {
	var fromDate = moment(config.fromDate, 'YYYY-MM-DD')
	var toDate = moment(config.toDate, 'YYYY-MM-DD')
	var officerStartDate = moment(officer.officerStartDate, 'YYYY-MM-DD')
	var officerEndDate = officer.officerEndDate !== undefined ? moment(officer.officerEndDate, 'YYYY-MM-DD') : null
	if (officerStartDate.isAfter(toDate)) return false
	else if (officerEndDate !== null && officerEndDate.isBefore(fromDate)) return false
	else return true
    })
}

highland(read('companies.csv'))
    .through(csvParser())
    .map(locate)
    .flatMap(http)
    .flatMap(parse)
    .through(csvWriter())
    .pipe(fs.createWriteStream('find-company-officers.csv'))
