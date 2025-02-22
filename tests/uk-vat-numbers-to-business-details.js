import Ava from 'ava'
import FSExtra from 'fs-extra'
import Process from 'process'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    const filename = './tests/data/uk-vat-numbers.csv'
    const reconcillation = await Reconcile('uk-vat-numbers-to-business-details', filename, {
        vatNumberField: 'vatNumber'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/uk-vat-numbers-to-business-details.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/uk-vat-numbers-to-business-details.json')
    test.deepEqual(results, resultsExpected)
})
