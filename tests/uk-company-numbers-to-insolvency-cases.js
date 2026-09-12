import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    test.timeout(120 * 1000)
    const filename = './tests/data/uk-company-numbers.csv'
    const reconcillation = await Reconcile('uk-company-numbers-to-insolvency-cases', filename, {
        companyNumberField: 'companyNumber'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/uk-company-numbers-to-insolvency-cases.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/uk-company-numbers-to-insolvency-cases.json')
    test.deepEqual(results, resultsExpected)
})
