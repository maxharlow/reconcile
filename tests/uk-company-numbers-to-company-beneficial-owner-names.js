import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    const filename = './tests/data/uk-company-numbers.csv'
    const reconcillation = await Reconcile('uk-company-numbers-to-company-beneficial-owner-names', filename, {
        companyNumberField: 'companyNumber'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/uk-company-numbers-to-company-beneficial-owner-names.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/uk-company-numbers-to-company-beneficial-owner-names.json')
    test.deepEqual(results, resultsExpected)
})
