import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    const filename = './tests/data/sec-ciks.csv'
    const reconcillation = await Reconcile('sec-ciks-to-sec-filings', filename, {
        cikField: 'cik',
        filingType: '10-K'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/sec-ciks-to-sec-filings.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/sec-ciks-to-sec-filings.json')
    test.deepEqual(results, resultsExpected)
})
