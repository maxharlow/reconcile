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
