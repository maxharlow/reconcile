import Ava from 'ava'
import FSExtra from 'fs-extra'
import Process from 'process'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    test.truthy(Process.env.OPEN_SANCTIONS_API_KEY)
    const filename = './tests/data/entities.csv'
    const reconcillation = await Reconcile('entities-to-targets', filename, {
        apiKey: Process.env.OPEN_SANCTIONS_API_KEY,
        entityFields: {
            name: 'name'
        },
        entitySchemaField: 'schema'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/entities-to-targets.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/entities-to-targets.json')
    test.deepEqual(results, resultsExpected)
})
