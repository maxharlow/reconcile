import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    test.timeout(30 * 1000)
    const filename = './tests/data/company-names.csv'
    const reconcillation = await Reconcile('company-names-to-company-numbers', filename, {
        companyNameField: 'companyName',
        companyJurisdictionField: 'companyJurisdiction'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/company-names-to-company-numbers.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/company-names-to-company-numbers.json')
    test.deepEqual(results, resultsExpected)
})
