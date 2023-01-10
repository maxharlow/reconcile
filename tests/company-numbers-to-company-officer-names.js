import Ava from 'ava'
import FSExtra from 'fs-extra'
import Process from 'process'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    test.truthy(Process.env.OPEN_CORPORATES_API_TOKEN)
    const filename = './tests/data/company-numbers.csv'
    const reconcillation = await Reconcile('company-numbers-to-company-officer-names', filename, {
        apiToken: Process.env.OPEN_CORPORATES_API_TOKEN,
        companyNumberField: 'companyNumber',
        companyJurisdictionField: 'companyJurisdiction'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/company-numbers-to-company-officer-names.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/company-numbers-to-company-officer-names.json')
    test.deepEqual(results, resultsExpected)
})
