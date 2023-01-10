import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    const filename = './tests/data/urls.csv'
    const reconcillation = await Reconcile('urls-to-domain-records', filename, {
        urlField: 'url'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/urls-to-domain-records.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/urls-to-domain-records.json')
    test.deepEqual(results, resultsExpected)
})
