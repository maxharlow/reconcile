import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    test.timeout(30 * 1000)
    const filename = './tests/data/uk-company-types.csv'
    const reconcillation = await Reconcile('uk-company-types-to-company-numbers', filename, {
        companyTypeField: 'companyType'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/uk-company-types-to-company-numbers.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/uk-company-types-to-company-numbers.json')
    test.deepEqual(results, resultsExpected)
})
