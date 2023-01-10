import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    test.timeout(60 * 1000, 'as this reconciler requires manual validation')
    const filename = './tests/data/uk-inspire-ids.csv'
    const reconcillation = await Reconcile('uk-inspire-ids-to-addresses', filename, {
        inspireIDField: 'inspireID',
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/uk-inspire-ids-to-addresses.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/uk-inspire-ids-to-addresses.json')
    test.deepEqual(results, resultsExpected)
})
