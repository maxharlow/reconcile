import Ava from 'ava'
import FSExtra from 'fs-extra'
import Process from 'process'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    test.truthy(Process.env.EQUASIS_CREDENTIALS)
    const filename = './tests/data/ship-names.csv'
    const reconcillation = await Reconcile('ship-names-to-ship-imo-numbers', filename, {
        credentials: Process.env.EQUASIS_CREDENTIALS,
        shipNameField: 'shipName'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/ship-names-to-ship-imo-numbers.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/ship-names-to-ship-imo-numbers.json')
    test.deepEqual(results, resultsExpected)
})
