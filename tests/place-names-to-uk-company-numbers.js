import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    const filename = './tests/data/place-names.csv'
    const reconcillation = await Reconcile('place-names-to-uk-company-numbers', filename, {
        placeNameField: 'placeName'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/place-names-to-uk-company-numbers.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/place-names-to-uk-company-numbers.json')
    test.deepEqual(results, resultsExpected)
})
