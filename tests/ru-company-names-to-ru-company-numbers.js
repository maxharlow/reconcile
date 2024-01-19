import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    test.timeout(30 * 1000)
    const filename = './tests/data/ru-company-names.csv'
    const reconcillation = await Reconcile('ru-company-names-to-ru-company-numbers', filename, {
        companyNameField: 'companyName',
        maximumResults: 1
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/ru-company-names-to-company-numbers.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/ru-company-names-to-ru-company-numbers.json')
    test.deepEqual(results, resultsExpected)
})
