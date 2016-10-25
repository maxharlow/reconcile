const Highland = require('highland')
const Request = require('request')
const Cheerio = require('cheerio')

module.exports = parameters => {

    const http = Highland.wrapCallback((location, callback) => {
        Request(location, (error, response) => {
            const failureSource = location.form.titleNo
            const failure = error ? error
                  : response.statusCode >= 400 ? new Error('Error ' + response.statusCode + ': ' + failureSource)
                  : null
            callback(failure, response)
        })
    })

    function locate(entry) {
        const titleNumber = entry[parameters.titleNumberField || 'titleNumber']
        if (!titleNumber) throw new Error('No title number given!')
        const location = 'https://eservices.landregistry.gov.uk/www/wps/portal/!ut/p/b1/hc7BCoJAEAbgZ-kJZnZn17ajFamkWVqmewkhico0QpJ8-rRbRTm3ge__Z0BDwkiglCMiCTHoIr0fD2l1LIs073Zt7IgrwZjgtiJjiI6cWcTWklBQC5I_wGJ9-S3EKHbhSV29RxW7zeS-PjUrvrhltTfdNp7r1F7lLvdRsBmbE79ieQRhVrQ5_VHtz0x0aOzPLVpxROMLvN9WvAd0v78A_hgTYWGXlwySlg1_9ahIwEXnrjgHdn0YDJ6Wz1R4/dl4/d5/L0lDU0lKSmdwcGlRb0tVUW9LVVEhL29Gb2dBRUlRaGpFQ1VJZ0FJQUl5RkFNaHdVaFM0SldsYTRvIS80RzNhRDJnanZ5aERVd3BNaFFqVW81Q2pHcHhBL1o3XzMyODQxMTQySDgzNjcwSTVGRzMxVDUzOFY0LzAvMzM3ODg1Njk0MDc5L3NwZl9BY3Rpb25OYW1lL3NwZl9BY3Rpb25MaXN0ZW5lci9zcGZfc3RydXRzQWN0aW9uLyEyZlFEU2VhcmNoLmRv'
        return {
            uri: location,
            method: 'POST',
            form: {
                titleNo: titleNumber,
                enquiryType: 'detailed'
            },
            query: { // only used for later reference
                titleNumber
            }
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
