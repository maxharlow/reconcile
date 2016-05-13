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
    const company = response.results.company
    return {
        companyJuristiction: company.jurisdiction_code,
        companyNumber: company.company_number,
        companyName: company.name,
        companyIncorporationDate: company.incorporation_date,
        companyDissolutionDate: company.dissolution_date,
        companyType: company.company_type,
        companyStatus: company.current_status,
        companyAddress: company.registered_address_in_full.replace(/\n/g, ', '),
        companyPreviousNames: company.previous_names.map(name => name.company_name).join(', '),
        companyAlternativeNames: company.alternative_names.join(', '),
        companyAgentName: company.agent_name,
        companyAgentAddress: company.agent_address
    }
}

Highland(Highland.wrapCallback(FS.readFile)('company-numbers.csv'))
    .through(CSVParser())
    .map(locate)
    .flatMap(http)
    .map(parse)
    .errors(e => console.error(e.stack))
    .through(CSVWriter())
    .pipe(FS.createWriteStream('company-details.csv'))
