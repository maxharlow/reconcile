import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    const filename = './tests/data/ship-imo-numbers.csv'
    const reconcillation = await Reconcile('ship-imo-numbers-to-insurer-names', filename, {
        shipIMONumberField: 'shipIMONumber'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/ship-imo-numbers-to-insurer-names.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/ship-imo-numbers-to-insurer-names.json')
    test.deepEqual(results, resultsExpected)
})
