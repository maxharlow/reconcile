import Ava from 'ava'
import FSExtra from 'fs-extra'
import Process from 'process'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    test.timeout(30 * 1000)
    test.truthy(Process.env.COMPANIES_HOUSE_API_KEY)
    const filename = './tests/data/individual-names.csv'
    const reconcillation = await Reconcile('individual-names-to-uk-company-officer-ids', filename, {
        apiKey: Process.env.COMPANIES_HOUSE_API_KEY,
        individualNameField: 'individualName'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/individual-names-to-uk-company-officer-ids.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/individual-names-to-uk-company-officer-ids.json')
    test.deepEqual(results, resultsExpected)
})
