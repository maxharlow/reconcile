import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    const filename = './tests/data/wikipedia-urls.csv'
    const reconcillation = await Reconcile('wikipedia-urls-to-wikidata-concepts', filename, {
        urlField: 'url'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/wikipedia-urls-to-wikidata-concepts.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/wikipedia-urls-to-wikidata-concepts.json')
    test.deepEqual(results, resultsExpected)
})
