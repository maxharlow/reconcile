const Highland = require('highland')
const Request = require('request')

module.exports = parameters => {

    const http = Highland.wrapCallback((location, callback) => {
        Request(location, (error, response) => {
            const failureSource = '(' + location.query.locationCoordinates + ')'
            const failure = error ? error
                  : response.statusCode === 403 ? new Error('You have reached the rate limit.' + (parameters.apiKey ? '' : ' Try using an API key.'))
                  : response.statusCode >=  400 ? new Error('Error ' + response.statusCode + ': ' + failureSource)
                  : null
            callback(failure, response)
        })
    })

    function locate(entry) {
        const locationCoordinates = entry[parameters.locationCoordinatesField || 'locationCoordinates']
        const locationLatitude = entry[parameters.locationLatitudeField || 'locationLatitude']
        const locationLongitude = entry[parameters.locationLongitudeField || 'locationLongitude']
        if (!locationCoordinates && !locationLatitude && !locationLongitude) throw new Error('No location coordinates given!')
        if (!locationCoordinates && !locationLatitude) throw new Error('No location latitude given!')
        if (!locationCoordinates && !locationLongitude) throw new Error('No location longitude given!')
        if (locationCoordinates && locationCoordinates.indexOf(',') < 0) throw new Error('Location coordinates are invalid: (' + locationCoordinates + ')')
        const coordinates = locationCoordinates ? locationCoordinates : locationLatitude + ',' + locationLongitude
        return {
            uri: 'https://maps.googleapis.com/maps/api/geocode/json',
            qs: {
                latlng: coordinates,
                apiKey: parameters.apiKey
            },
            query: { // only used for later reference
                locationCoordinates: coordinates
            }
        }
    }

    function parse(response) {
        const body = JSON.parse(response.body)
        if (body.results.length === 0) {
            throw new Error('Location not found: (' + response.request.query.locationCoordinates + ')')
        }
        const location = body.results[0]
        return {
            locationAddress: location.formatted_address
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
