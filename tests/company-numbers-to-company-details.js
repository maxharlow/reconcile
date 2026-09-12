import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    const filename = './tests/data/company-numbers.csv'
    const reconcillation = await Reconcile('company-numbers-to-company-details', filename, {
        companyNumberField: 'companyNumber',
        companyJurisdictionField: 'companyJurisdiction'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/company-numbers-to-company-details.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/company-numbers-to-company-details.json')
    test.deepEqual(results, resultsExpected)
})
