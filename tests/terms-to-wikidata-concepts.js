import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    const filename = './tests/data/terms.csv'
    const reconcillation = await Reconcile('terms-to-wikidata-concepts', filename, {
        termField: 'term'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/terms-to-wikidata-concepts.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/terms-to-wikidata-concepts.json')
    test.deepEqual(results, resultsExpected)
})
