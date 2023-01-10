import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    const filename = './tests/data/ip-addresses.csv'
    const reconcillation = await Reconcile('ip-addresses-to-details', filename, {
        ipAddressField: 'ipAddress'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/ip-addresses-to-details.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/ip-addresses-to-details.json')
    test.deepEqual(results, resultsExpected)
})
