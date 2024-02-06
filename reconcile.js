import Crypto from 'crypto'
import FSExtra from 'fs-extra'
import Papaparse from 'papaparse'
import Scramjet from 'scramjet'
import Axios from 'axios'
import AxiosRetry from 'axios-retry'
import AxiosRateLimit from 'axios-rate-limit'
import FormData from 'form-data'
import Querystring from 'querystring'

function enhash(location) {
    const contents = structuredClone(location)
    delete contents.auth
    delete contents.headers?.cookie
    delete contents.hashOmit
    if (location.hashOmit) location.hashOmit.forEach(entry => {
        const [topKey, subKey] = entry.split('.')
        delete contents[topKey][subKey]
    })
    return Crypto.createHash('sha1').update(JSON.stringify(contents)).digest('hex')
}

function objectToString(object) {
    return Object.entries(object).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(' ')
}

function requestify(retries, cache, alert) {
    return config => {
        const limit = config.limit || Infinity
        const errors = config.errors || (() => {})
        const cacheDirectory = '.reconcile-cache'
        const timeout = 45 * 1000
        const toUrl = location => typeof location === 'string' ? location : location.url
        const toLocationName = location => {
            const method = location.method?.toUpperCase() || 'GET'
            return `${method} ${toUrl(location)}`
                + (location.params ? '?' + Querystring.stringify(location.params) : '')
                + (location.dataQuery ? ' ' + Querystring.stringify(location.dataQuery) : '')
                + (location.dataForm ? ' <' + objectToString(location.dataForm) + '>' : '')
                + (location.dataRaw ? ' [' + objectToString(location.dataRaw) + ']' : '')
        }
        const toErrorMessage = e => {
            if (!e.response) return e.message // request not made
            const reconcilerError = errors(e.response)
            if (reconcilerError) return reconcilerError.message // look for reconciler-specific errors
            if (e.code === 'ECONNABORTED') return `timed out after ${timeout / 1000}ms` // request timed out
            if (e.code) return `received ${e.code}` // request failed, with error code
            return `unexpected ${e.message}` // something else
        }
        const instance = Axios.create({
            timeout,
            validateStatus: () => true // based on status only, overridden by response interceptor
        })
        instance.interceptors.request.use(location => {
            alert({
                identifier: location.identifier,
                source: toLocationName(location),
                message: 'requesting...'
            })
            return location
        }, e => Promise.reject(e))
        instance.interceptors.response.use(response => {
            const error = config.errors(response)
            if (!error) return response
            const e = new Axios.AxiosError(error.message, Axios.AxiosError.ERR_BAD_RESPONSE, response.config, response.request, response)
            return Promise.reject(e)
        }, e => Promise.reject(e))
        AxiosRetry(instance, {
            retries,
            shouldResetTimeout: true,
            retryCondition: e => {
                const error = config.errors(e.response)
                return error?.retry
            },
            retryDelay: (number, e) => {
                const message = toErrorMessage(e)
                const attempt = number > 0 && number <= retries && retries > 1 ? ' (retrying' + (number > 1 ? `, attempt ${number}` : '') + '...)' : ''
                if (number === 1) alert({
                    identifier: e.config.identifier,
                    source: toLocationName(e.config),
                    message: `${message}${attempt}`
                })
                else alert({
                    identifier: e.config.identifier,
                    source: toLocationName(e.config),
                    message: `${message}${attempt}`
                })
                return 5 * 1000
            }
        })
        AxiosRateLimit(instance, {
            maxRequests: limit >= 1 ? limit : 1,
            perMilliseconds: limit >= 1 ? 1000 : (1 / limit) * 1000
        })
        let cacheChecked = false
        return async location => {
            if (!location) return
            const hash = enhash(location)
            const locationName = toLocationName(location)
            if (cache) {
                if (!cacheChecked) {
                    const cacheExists = await FSExtra.pathExists(cacheDirectory)
                    if (cacheExists) alert({ message: 'Cached data found!' })
                    else alert({ message: 'No existing cached data found' })
                    cacheChecked = true
                }
                const isCached = await FSExtra.pathExists(`${cacheDirectory}/${hash}`)
                if (isCached) {
                    alert({
                        identifier: location.identifier,
                        source: locationName,
                        message: `cached @ ${hash}`
                    })
                    const cacheData = await FSExtra.readJson(`${cacheDirectory}/${hash}`)
                    return {
                        url: toUrl(location),
                        data: cacheData,
                        passthrough: location.passthrough
                    }
                }
            }
            if (config.validator) await config.validator(location)
            if (location.dataQuery) {
                location.data = Querystring.stringify(location.dataQuery)
            }
            if (location.dataForm) {
                const form = new FormData()
                location.headers = form.getHeaders()
                Object.entries(location.dataForm).forEach(([key, value]) => form.append(key, JSON.stringify(value)))
                location.data = form
            }
            if (location.dataRaw) {
                location.data = location.dataRaw
            }
            try {
                const response = await instance(location)
                if (cache) {
                    await FSExtra.ensureDir(cacheDirectory)
                    await FSExtra.writeJson(`${cacheDirectory}/${hash}`, response.data)
                }
                alert({
                    identifier: location.identifier,
                    source: locationName,
                    message: 'done'
                })
                return {
                    url: toUrl(location),
                    data: response.data,
                    passthrough: location.passthrough
                }
            }
            catch (e) {
                alert({
                    identifier: location.identifier,
                    source: locationName,
                    message: toErrorMessage(e),
                    importance: 'error'
                })
            }
        }
    }
}

async function load(command, filename, parameters = {}, retries = 5, cache = false, join = 'inner', verbose = false, alert = () => {}) {
    const requestor = requestify(retries, cache, alert)
    const { default: reconciler } = await import(`./reconcilers/${command}.js`)
    Object.keys(parameters).forEach(parameter => {
        if (!reconciler.details.parameters.find(p => p.name === parameter)) alert({
            message: `${parameter}: unexpected parameter will be ignored`,
            importance: 'warning'
        })
    })
    reconciler.details.parameters.filter(parameter => parameter.required).forEach(parameter => {
        if (!parameters[parameter.name]) throw new Error(`${parameter.name}: parameter is required but was not found`)
    })
    const batch = reconciler.details.batch || 1
    const execute = reconciler.initialise(parameters, requestor, alert)
    const source = () => {
        const origin = FSExtra.createReadStream(filename).pipe(Papaparse.parse(Papaparse.NODE_STREAM_INPUT, { header: true }))
        let line = 1
        return Scramjet.DataStream.from(origin).map(data => {
            return {
                line: line++,
                data
            }
        })
    }
    const columnsReconciler = reconciler.details.columns.map(column => column.name)
    const columnsSource = Object.keys((await source().slice(0, 1).toArray())[0]?.data || {})
    if (columnsSource.length === 0) throw new Error('input data is empty!')
    const columnMapEntries = columnsReconciler.map(column => {
        const columnUnique = (i = '') => {
            const attempt = `${column}${i}`
            if (columnsSource.find(name => name === attempt)) return columnUnique(Number(i) + 1)
            if (i) alert({
                message: `Column '${column}' from the reconciler has been renamed '${attempt}' so it does not overwrite the source`,
                importance: 'info'
            })
            return attempt
        }
        return [column, columnUnique()]
    })
    const columnMap = Object.fromEntries(columnMapEntries)
    const blank = Object.fromEntries(Object.values(columnMap).map(key => [key, null]))
    const length = async () => {
        const entries = await source().reduce(a => a + 1, 0)
        return Math.ceil(entries / batch)
    }
    const run = async () => source().batch(batch).setOptions({ maxParallel: 1 }).map(async items => {
        const executed = await execute(batch === 1 ? items[0] : items)
        if (executed === null) {
            if (join === 'outer') return items.map(item => ({ ...item.data, ...blank }))
            else return []
        }
        return items.flatMap((item, i) => {
            const results = batch > 1 && Array.isArray(executed[i]) ? executed[i] // batch mode, reconciler is one-to-many
                : batch > 1 ? [executed[i]] // batch mode, reconciler is one-to-one
                : Array.isArray(executed) ? executed // reconciler is one-to-many
                : [executed] // reconciler is one-to-one
            if (join === 'outer' && results.filter(x => x).length === 0) return [{ ...item.data, ...blank }]
            return results.map(result => {
                if (!result) return null // if there is no result (eg. not found)
                const resultRemapped = Object.fromEntries(Object.entries(result).map(([column, value]) => [columnMap[column], value]))
                return { ...item.data, ...resultRemapped }
            }).filter(x => x)
        })
    })
    return { run, length }
}

export default load
