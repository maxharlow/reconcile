import Ava from 'ava'
import FSExtra from 'fs-extra'
import Process from 'process'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    test.truthy(Process.env.OPEN_CORPORATES_API_TOKEN)
    const filename = './tests/data/names.csv'
    const reconcillation = await Reconcile('names-to-company-beneficial-owner-names', filename, {
        apiToken: Process.env.OPEN_CORPORATES_API_TOKEN,
        nameField: 'name'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/names-to-company-beneficial-owner-names.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/names-to-company-beneficial-owner-names.json')
    test.deepEqual(results, resultsExpected)
})
