function initialise(parameters, requestor, alert) {

    const request = requestor({
        limit: 0.24,
        errors: response => {
            if (response.status === 429) throw new Error('the rate limit has been reached')
            if (response.status >= 400) return { message: `received code ${response.status}`, retry: true }
        }
    })

    function locate(entries) {
        const queries = entries.map(entry => {
            return entry.data[parameters.ipAddressField]
        })
        return {
            identifier: queries.join(', '),
            url: 'http://ip-api.com/batch',
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded'
            },
            dataRaw: JSON.stringify(queries),
            passthrough: {
                entries
            }
        }
    }

    function parse(response) {
        if (!response) return
        return response.data.map(entry => {
            if (entry.status === 'fail') return
            return {
                country: entry.countryCode,
                region: entry.regionName,
                city: entry.city,
                latitude: entry.lat,
                longitude: entry.lon,
                isp: entry.isp,
                organisation: entry.org
            }
        })
    }

    async function run(inputs) {
        const dataLocated = locate(inputs)
        const dataLocatedRequested = await request(dataLocated)
        const dataParsed = parse(dataLocatedRequested)
        return dataParsed
    }

    return run

}

const details = {
    batch: 100,
    parameters: [
        {
            name: 'ipAddressField',
            description: 'IP address column.',
            required: true
        }
    ],
    columns: [
        { name: 'country' },
        { name: 'region' },
        { name: 'city' },
        { name: 'latitude' },
        { name: 'longitude' },
        { name: 'isp' },
        { name: 'organisation' }
    ]
}

export default { initialise, details }
