function initialise(parameters, requestor, alert) {

    const request = requestor({
        messages: e => {
            if (e.response.status >= 400) return `received code ${e.response.status}`
        }
    })

    function locate(entries) {
        if (!parameters.entitySchemaField && !parameters.schema) throw new Error(`no schema found`)
        const dataset = parameters.dataset || 'default'
        const maximumResults = parameters.maximumResults || 1
        const queries = entries.map((entry, i) => {
            const propertyEntries = Object.entries(parameters.entityFields).map(([property, field]) => {
                const propertyValue = entry.data[field]
                if (!propertyValue) {
                    alert({
                        identifier: `Line ${entry.line}`,
                        message: `no ${property} found at "${field}"`,
                        importance: 'error'
                    })
                    throw new Error('entity field mapping is invalid')
                }
                return [property, propertyValue]
            })
            const entitySchema = parameters.entitySchemaField ? entry.data[parameters.entitySchemaField] : parameters.schema
            return [`q${i}`, {
                schema: entitySchema,
                properties: Object.fromEntries(propertyEntries)
            }]
        })
        return {
            identifier: (JSON.stringify(queries[0][1].properties) + (queries.length > 1 ? ' to ' + JSON.stringify(queries[entries.length - 1][1].properties) : '')).replaceAll('"', ''),
            url: `https://api.opensanctions.org/match/${dataset}`,
            method: 'POST',
            headers: {
                authorization: `ApiKey ${parameters.apiKey}`
            },
            params: {
                limit: maximumResults,
                algorithm: 'best',
                fuzzy: 'false'
            },
            data: {
                queries: Object.fromEntries(queries)
            },
            passthrough: {
                entries
            }
        }
    }

    function parse(response) {
        if (!response) return
        return Object.entries(response.data.responses).map(([, entry]) => {
            const targets = entry.results
            return targets.map(target => {
                return {
                    targetID: target.id,
                    targetCaption: target.caption,
                    targetFirstSeen: target.first_seen,
                    targetLastSeen: target.last_seen
                }
            })
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
    batch: 50, // the maximum batch size appears to be undocumented
    parameters: [
        {
            name: 'apiKey',
            description: 'An OpenSanctions API key.',
            required: true
        },
        {
            name: 'entityFields',
            description: 'Mapping object from OpenSanctions schema properties to column names.',
            required: true
        },
        {
            name: 'entitySchemaField',
            description: 'Schema column, if any. It should be an OpenSanctions schema: https://www.opensanctions.org/reference/#schema. Required unless schema is specified.'
        },
        {
            name: 'schema',
            description: 'If all entities have the same schema type you can specify it here instead of in a column. Required unless schemaField is specified.'
        },
        {
            name: 'dataset',
            description: 'An OpenSanctions dataset to match within: https://www.opensanctions.org/datasets.',
            defaults: 'default'
        },
        {
            name: 'maximumResults',
            description: 'Maximum number of results to include for each entity, up to 10.',
            defaults: '1'
        }
    ],
    columns: [
        { name: 'targetID' },
        { name: 'targetCaption' },
        { name: 'targetFirstSeen' },
        { name: 'targetLastSeen' }
    ]
}

export default { initialise, details }
