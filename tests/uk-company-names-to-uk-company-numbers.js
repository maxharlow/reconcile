import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    const filename = './tests/data/uk-company-names.csv'
    const reconcillation = await Reconcile('uk-company-names-to-uk-company-numbers', filename, {
        companyNameField: 'companyName'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/uk-company-names-to-uk-company-numbers.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/uk-company-names-to-uk-company-numbers.json')
    test.deepEqual(results, resultsExpected)
})
