const Crypto = require('crypto')
const FSExtra = require('fs-extra')
const Ix = require('ix')
const Axios = require('axios')
const AxiosRetry = require('axios-retry')
const AxiosRateLimit = require('axios-rate-limit')
const CSVParser = require('csv-parser')

function request(retries, cache, alert, limit, messages) {
    const cacheDirectory = '.reconcile-cache'
    const timeout = 30 * 1000
    const toErrorMessage = e => {
        const reconcilerError = e.response && messages(e)
        if (reconcilerError) return reconcilerError // look for reconciler-specific errors first
        if (e.response) return `Received code ${e.response.status}: ${e.config.url}` // response recieved, but non-2xx
        if (e.code === 'ECONNABORTED') return `Timed out after ${timeout / 1000}ms: ${e.config.url}` // request timed out
        if (e.code) return `Error ${e.code}: ${e.config.url}` // request failed, with error code
        return e.message // request not made
    }
    const instance = Axios.create({ timeout })
    AxiosRetry(instance, {
        retries,
        shouldResetTimeout: true,
        retryCondition: e => {
            return !e.response || e.response.status >= 500 || e.response.status === 429 // no response, server error, or hit rate limit
        },
        retryDelay: (number, e) => {
            const message = toErrorMessage(e)
            const attempt = number > 0 && number <= retries && retries > 1 ? ` (retrying, attempt ${number}...)` : ''
            if (number === 1) alert(`${message}${attempt}`)
            else alert(`  → ${message}${attempt}`)
            return 5 * 1000
        }
    })
    AxiosRateLimit(instance, {
        maxRequests: limit, // so limit is number of requests per second
        perMilliseconds: 1 * 1000
    })
    let cacheChecked = false
    return async location => {
        const url = typeof location === 'object' ? location.url : location
        const hash = Crypto.createHash('sha1').update(JSON.stringify(location)).digest('hex')
        if (cache) {
            if (!cacheChecked) {
                const cacheExists = await FSExtra.pathExists(cacheDirectory)
                if (cacheExists) alert('Cached data found!')
                else alert('No existing cached data found')
                cacheChecked = true
            }
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
            throw new Error(toErrorMessage(e))
        }
    }
}

async function length(filename) {
    const data = FSExtra.createReadStream(filename).pipe(CSVParser())
    return Ix.AsyncIterable.from(data).count()
}

function run(command, filename, parameters = {}, retries = 5, cache = false, join = 'inner', alert = () => {}) {
    const requestor = request.bind(null, retries, cache, alert)
    const reconciler = require('./reconcile-' + command)
    const execute = reconciler.initialise(parameters, requestor)
    const blank = Object.fromEntries(reconciler.details.columns.map(column => [column.name]))
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
            if (join === 'outer' && results.length === 0) {
                return [{ ...item, ...blank }]
            }
            return results.map(result => {
                return { ...item, ...result }
            })
        }
        catch (e) {
            alert(e.message)
            if (join === 'outer') {
                return [{ ...item, ...blank }]
            }
            else return []
        }
    })
}

module.exports = { run, length }
