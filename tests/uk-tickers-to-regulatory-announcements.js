import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    const filename = './tests/data/uk-tickers.csv'
    const reconcillation = await Reconcile('uk-tickers-to-regulatory-announcements', filename, {
        tickerField: 'ticker',
        category: 'results',
        maximumDate: '2022-01-01'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/uk-tickers-to-regulatory-announcements.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/uk-tickers-to-regulatory-announcements.json')
    test.deepEqual(results, resultsExpected)
})
