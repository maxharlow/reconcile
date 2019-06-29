const Crypto = require('crypto')
const FSExtra = require('fs-extra')
const Ix = require('ix')
const Axios = require('axios')
const AxiosRetry = require('axios-retry')
const CSVParser = require('csv-parser')

async function request(retries, cache, alert, handling, location) {
    const cacheDirectory = '.reconcile-cache'
    const url = typeof location === 'object' ? location.url : location
    const hash = Crypto.createHash('sha1').update(url).digest('hex')
    if (cache) {
        const isCached = await FSExtra.pathExists(`${cacheDirectory}/${hash}`)
        if (isCached) {
            const cacheData = await FSExtra.readFile(`${cacheDirectory}/${hash}`)
            return {
                url,
                data: JSON.parse(cacheData),
                passthrough: location.passthrough
            }
        }
    }
    const timeout = 15 * 1000
    const instance = Axios.create({ timeout })
    AxiosRetry(instance, {
        retries,
        shouldResetTimeout: true,
        retryCondition: e => {
            return !e.response || e.response.status >= 500 // no response or server error
        },
        retryDelay: (number, e) => {
            if (number === 1) alert(`Received code ${e.code}: ${e.config.url}`)
            else alert(`  → Received code ${e.code} in retry attempt #${number - 1}: ${e.config.url}`)
            return 5 * 1000
        }
    })
    try {
        const response = await instance(location)
        if (cache) {
            await FSExtra.ensureDir(cacheDirectory)
            await FSExtra.writeJson(`${cacheDirectory}/${hash}`, response.data)
        }
        return {
            url,
            data: response.data,
            passthrough: location.passthrough
        }
    }
    catch (e) {
        if (e.response) handling(e, location.passthrough) // run reconciler-specific handling first
        if (e.response) throw new Error(`Received code ${e.response.status}: ${e.config.url}`) // response recieved, but non-2xx
        if (e.request) throw new Error(`Timed out after ${timeout}s: ${e.config.url}`) // request made, no response
        throw e // a bad request perhaps
    }
}

async function length(filename) {
    const data = FSExtra.createReadStream(filename).pipe(CSVParser())
    return Ix.AsyncIterable.from(data).count()
}

function run(command, filename, parameters = {}, retries = 5, cache = false, alert = () => {}) {
    const requestor = request.bind(null, retries, cache, alert)
    const reconciler = require('./reconcile-' + command)
    const execute = reconciler.initialise(parameters, requestor)
    const data = FSExtra.createReadStream(filename).pipe(CSVParser())
    return Ix.AsyncIterable.from(data).map(async (item, i) => {
        if (i === 0) {
            const keysReconciler = reconciler.details.columns.map(column => column.name)
            const keysItem = Object.keys(item)
            const overlap = keysReconciler.filter(key => keysItem.includes(key))
            overlap.forEach(key => alert(`Column ${key} in the source will be overwritten with data from the reconciler`))
        }
        try {
            const executed = await execute(item)
            const results = Array.isArray(executed) ? executed : [executed]
            return results.map(result => {
                return { ...item, ...result }
            })
        }
        catch (e) {
            alert(e.message)
            return []
        }
    })
}

module.exports = { run, length }
