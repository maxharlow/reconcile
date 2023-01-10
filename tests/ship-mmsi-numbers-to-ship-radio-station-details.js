import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    const filename = './tests/data/ship-mmsi-numbers.csv'
    const reconcillation = await Reconcile('ship-mmsi-numbers-to-ship-radio-station-details', filename, {
        shipMMSINumberField: 'shipMMSINumber'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/ship-mmsi-numbers-to-ship-radio-station-details.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/ship-mmsi-numbers-to-ship-radio-station-details.json')
    test.deepEqual(results, resultsExpected)
})
