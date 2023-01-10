import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    const filename = './tests/data/terms.csv'
    const reconcillation = await Reconcile('terms-to-urls', filename, {
        termField: 'term'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/terms-to-urls.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/terms-to-urls.json')
    test.deepEqual(results, resultsExpected)
})
