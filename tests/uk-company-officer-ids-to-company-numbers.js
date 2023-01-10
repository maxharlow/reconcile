import Ava from 'ava'
import FSExtra from 'fs-extra'
import Process from 'process'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    test.truthy(Process.env.COMPANIES_HOUSE_API_KEY)
    const filename = './tests/data/uk-company-officer-ids.csv'
    const reconcillation = await Reconcile('uk-company-officer-ids-to-company-numbers', filename, {
        apiKey: Process.env.COMPANIES_HOUSE_API_KEY,
        officerIDField: 'officerID'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/uk-company-officer-ids-to-company-numbers.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/uk-company-officer-ids-to-company-numbers.json')
    test.deepEqual(results, resultsExpected)
})
