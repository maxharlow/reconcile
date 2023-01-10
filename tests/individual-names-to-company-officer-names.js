import Ava from 'ava'
import FSExtra from 'fs-extra'
import Process from 'process'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    test.truthy(Process.env.OPEN_CORPORATES_API_TOKEN)
    const filename = './tests/data/individual-names.csv'
    const reconcillation = await Reconcile('individual-names-to-company-officer-names', filename, {
        apiToken: Process.env.OPEN_CORPORATES_API_TOKEN,
        individualNameField: 'individualName'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/individual-names-to-company-officer-names.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/individual-names-to-company-officer-names.json')
    test.deepEqual(results, resultsExpected)
})
