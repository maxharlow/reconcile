import Crypto from 'crypto'
import FSExtra from 'fs-extra'
import Scramjet from 'scramjet'
import Axios from 'axios'
import AxiosRetry from 'axios-retry'
import AxiosRateLimit from 'axios-rate-limit'
import Querystring from 'querystring'

function request(retries, cache, verbose, alert, limit, messages) {
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
        const queryForm = Querystring.stringify(location.qs)
        const queryString = Querystring.stringify(location.params)
        const query = queryForm || queryString ? '?' + (queryForm || queryString) : ''
        const url = typeof location === 'object' ? location.url + query : location
        const method = location.method || 'GET'
        if (location.qs) location.data = queryForm
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
                if (verbose) alert(`Cached: ${method} ${url}`)
                const cacheData = await FSExtra.readJson(`${cacheDirectory}/${hash}`)
                return {
                    url,
                    data: cacheData,
                    passthrough: location.passthrough
                }
            }
        }
        try {
            if (verbose) alert(`Requesting: ${method} ${url}`)
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
    return Scramjet.StringStream.from(FSExtra.createReadStream(filename)).CSVParse({ header: true }).reduce(a => a + 1, 0)
}

async function run(command, filename, parameters = {}, retries = 5, cache = false, join = 'inner', verbose = false, alert = () => {}) {
    const die = message => {
        alert(`Exiting early: ${message}`)
        process.exit(1)
    }
    const requestor = request.bind(null, retries, cache, verbose, alert)
    const { default: reconciler } = await import(`./reconcile-${command}.js`)
    const execute = reconciler.initialise(parameters, requestor, die)
    const blank = Object.fromEntries(reconciler.details.columns.map(column => [column.name]))
    const source = () => Scramjet.StringStream.from(FSExtra.createReadStream(filename)).CSVParse({ header: true })
    return source().map(async item => {
        if (i === 0) { // check for keys in the reconciler output that already exist in the input
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
            alert(verbose ? e.stack : e.message)
            if (join === 'outer') {
                return [{ ...item, ...blank }]
            }
            else return []
        }
    })
}

export default { run, length }
