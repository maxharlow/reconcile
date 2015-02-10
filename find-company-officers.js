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

function companies(callback) {
    fs.readFile('companies.csv', callback)
}

function locateCompany(entry) {
    return "https://api.opencorporates.com/companies/gb/" + entry['companyNumber'] + "?api_token=" + config.opencorporatesToken
}

function parseCompany(response) {
    if (response.results.length === 0) throw new Error("No results")
    var officers = response.results.company.officers.map(function (officer) {
	return {
	    name: officer.officer.name,
	    position: officer.officer.postion,
	    startDate: officer.officer.start_date,
	    endDate: officer.officer.end_date
	}
    })
    var officersInDate = officers.filter(function (officer) {
	var fromDate = moment(config.fromDate, 'YYYY-MM-DD')
	var toDate = moment(config.toDate, 'YYYY-MM-DD')
	var officerStartDate = moment(officer.startDate, 'YYYY-MM-DD')
	var officerEndDate = officer.endDate !== undefined ? moment(officer.endDate, 'YYYY-MM-DD') : null
	if (officerStartDate.isAfter(toDate)) return false
	else if (officerEndDate !== null && officerEndDate.isBefore(fromDate)) return false
	else return true
    })
    return {
	name: response.results.company.name,
	number: response.results.company.company_number,
	officers: officersInDate.map(function (o) { return o.name }).join('; ')
    }
}

highland(highland.wrapCallback(companies)())
    .through(csvParser())
    .map(locateCompany)
    .flatMap(http)
    .map(parseCompany)
    .through(csvWriter())
    .pipe(fs.createWriteStream('find-company-officers.csv'))
