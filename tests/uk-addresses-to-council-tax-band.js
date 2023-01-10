import Ava from 'ava'
import FSExtra from 'fs-extra'
import Reconcile from '../reconcile.js'

Ava('standard', async test => {
    const filename = './tests/data/uk-addresses.csv'
    const reconcillation = await Reconcile('uk-addresses-to-council-tax-bands', filename, {
        addressNumberField: 'addressNumber',
        addressStreetField: 'addressStreet',
        addressCityField: 'addressCity',
        addressPostcodeField: 'addressPostcode'
    })
    const processing = await reconcillation.run()
    const results = await processing.flatten().toArray()
    // await FSExtra.writeJson('./tests/expectations/uk-addresses-to-council-tax-bands.json', results) // for updates!
    const resultsExpected = await FSExtra.readJson('./tests/expectations/uk-addresses-to-council-tax-bands.json')
    test.deepEqual(results, resultsExpected)
})
