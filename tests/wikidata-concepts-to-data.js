import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    const filename = './tests/data/wikidata-concepts.csv'
    const reconcillation = await Reconcile('wikidata-concepts-to-data', filename, {
        wikidataConceptIDField: 'wikidataConceptID',
        wikidataProperty: 'P569'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/wikidata-concepts-to-data.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/wikidata-concepts-to-data.json')
    test.deepEqual(results, resultsExpected)
})
