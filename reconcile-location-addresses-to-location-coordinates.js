const Highland = require('highland')
const Request = require('request')

module.exports = parameters => {

    const http = Highland.wrapCallback((location, callback) => {
        Request(location, (error, response) => {
            const failureSource = location.query.locationAddress
            const failure = error ? error
                  : response.statusCode === 403 ? new Error('You have reached the rate limit.' + (parameters.apiKey ? '' : ' Try using an API key.'))
                  : response.statusCode >=  400 ? new Error('Error ' + response.statusCode + ': ' + failureSource)
                  : null
            callback(failure, response)
        })
    })

    function locate(entry) {
        const locationAddress = entry[parameters.locationAddressField || 'locationAddress']
        if (!locationAddress) throw new Error('No location address given!')
        return {
            uri: 'https://maps.googleapis.com/maps/api/geocode/json',
            qs: {
                address: locationAddress,
                apiKey: parameters.apiKey
            },
            query: { // only used for later reference
                locationAddress
            }
        }
    }

    function parse(response) {
        const body = JSON.parse(response.body)
        if (body.results.length === 0) {
            throw new Error('Location not found: ' + response.request.query.locationAddress)
        }
        const location = body.results[0]
        return {
            locationLatitude: location.geometry.location.lat,
            locationLongitude: location.geometry.location.lng,
            locationAccuracy: location.geometry.location_type
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
