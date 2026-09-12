import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    test.timeout(30 * 1000)
    const filename = './tests/data/names.csv'
    const reconcillation = await Reconcile('names-to-company-beneficial-owner-names', filename, {
        nameField: 'name'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/names-to-company-beneficial-owner-names.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/names-to-company-beneficial-owner-names.json')
    test.deepEqual(results, resultsExpected)
})
