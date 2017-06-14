const Highland = require('highland')
const Request = require('request')
const Cheerio = require('cheerio')

module.exports = parameters => {

    const http = Highland.wrapCallback((location, callback) => {
        Request(location, (error, response) => {
            const failureSource = location.form ? location.form.titleNo : 'preliminary'
            const failure = error ? error
                  : response.statusCode >= 400 ? new Error('Error ' + response.statusCode + ': ' + failureSource)
                  : null
            callback(failure, response)
        })
    })

    function form(entry) {
        const titleNumber = entry[parameters.titleNumberField || 'titleNumber']
        if (!titleNumber) throw new Error('No title number given!')
        return {
            method: 'GET',
            uri: 'https://eservices.landregistry.gov.uk/wps/portal/Property_Search',
            headers: { 'User-Agent': '' },
            query: { // only used for later reference
                titleNumber
            }
        }
    }

    function locate(response) {
        const document = Cheerio.load(response.body)
        return {
            method: 'POST',
            uri: 'https://eservices.landregistry.gov.uk' + document('form').attr('action'),
            headers: { 'User-Agent': '' },
            form: {
                titleNo: response.request.query.titleNumber,
                enquiryType: 'detailed'
            },
            query: response.request.query
        }
    }

    function parse(response) {
        const document = Cheerio.load(response.body)
        const failure = document('.w80p').get().length === 0
        if (failure) throw new Error('Title not found: ' + response.request.query.titleNumber)
        return {
            titleAddress: document('.w80p').eq(0).contents().get().filter(e => e.type === 'text').map(e => e.data.trim()).join(', '),
            titleTenure: document('.w80p').eq(1).text().trim()
        }
    }

    function toArray(item) {
      return [item]
    }

    function run(input) {
        return new Promise((resolve, reject) => {
            Highland([input])
                .map(form)
                .flatMap(http)
                .map(locate)
                .flatMap(http)
                .map(parse)
                .map(toArray)
                .errors(reject)
                .each(resolve)
        })
    }

    return run

}
