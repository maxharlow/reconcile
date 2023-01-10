import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    const filename = './tests/data/urls.csv'
    const reconcillation = await Reconcile('urls-to-data', filename, {
        urlField: 'url',
        elements: [
            { key: 'pageTitle', selector: 'title' }
        ]
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/urls-to-data.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/urls-to-data.json')
    test.deepEqual(results, resultsExpected)
})
