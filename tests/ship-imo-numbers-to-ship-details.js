import Ava from 'ava'
import FSExtra from 'fs-extra'
import Process from 'process'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    test.truthy(Process.env.EQUASIS_CREDENTIALS)
    const filename = './tests/data/ship-imo-numbers.csv'
    const reconcillation = await Reconcile('ship-imo-numbers-to-ship-details', filename, {
        credentials: Process.env.EQUASIS_CREDENTIALS,
        shipIMONumberField: 'shipIMONumber'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/ship-imo-numbers-to-ship-details.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/ship-imo-numbers-to-ship-details.json')
    test.deepEqual(results, resultsExpected)
})
