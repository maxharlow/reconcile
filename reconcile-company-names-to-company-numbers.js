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
    return 'https://api.opencorporates.com/' + version + '/companies/search?q=' + encodeURIComponent(entry['companyName']) // + '?api_token=' + config.opencorporatesToken
}

function parse(response) {
    const company = response.results.companies[0].company
    return {
        companyJuristiction: company.jurisdiction_code,
        companyNumber: company.company_number,
        companyName: company.name
    }
}

Highland(Highland.wrapCallback(FS.readFile)('company-names.csv'))
    .through(CSVParser())
    .map(locate)
    .flatMap(http)
    .map(parse)
    .errors(e => console.error(e.stack))
    .through(CSVWriter())
    .pipe(FS.createWriteStream('company-numbers.csv'))
