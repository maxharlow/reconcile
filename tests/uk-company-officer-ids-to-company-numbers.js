import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    const filename = './tests/data/uk-company-officer-ids.csv'
    const reconcillation = await Reconcile('uk-company-officer-ids-to-company-numbers', filename, {
        officerIDField: 'officerID'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/uk-company-officer-ids-to-company-numbers.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/uk-company-officer-ids-to-company-numbers.json')
    test.deepEqual(results, resultsExpected)
})
