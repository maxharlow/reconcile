import * as Cheerio from 'cheerio'
import Puppeteer from 'puppeteer'

function initialise(parameters, requestor, alert) {

    const request = requestor({
        errors: response => {
            if (!response.data.includes('Property description')) return { message: 'request failed', retry: true }
            if (response.status >= 400) return { message: `received code ${response.status}`, retry: true }
        },
        validator: async location => {
            const browser = await Puppeteer.launch({
                headless: false,
                defaultViewport: {
                    width: 800,
                    height: 800
                },
                args: ['--window-size=800,800']
            })
            try {
                const page = (await browser.pages())[0]
                await page.goto('https://search-property-information.service.gov.uk/search/search-by-inspire-id')
                await page.evaluate(() => {
                    document.querySelector('body').replaceChildren(document.querySelector('#inspire-id-search'))
                    document.querySelectorAll('fieldset, .govuk-form-group:nth-of-type(1), button').forEach(element => element.remove())
                    document.querySelector('#inspire-id-search').style.cssText += 'display:grid;justify-items:center;min-height:100vh;padding:25px;'
                })
                await page.waitForFunction(() => grecaptcha.getResponse() !== '', { timeout: 5 * 60 * 1000 })
                const info = await page.evaluate(() => {
                    return {
                        token: document.querySelector('#inspire-id-search [name=csrf_token]').value,
                        session: document.cookie.split('; ').find(cookie => cookie.includes('session=')),
                        captcha: grecaptcha.getResponse()
                    }
                })
                await browser.close()
                location.dataQuery.csrf_token = info.token
                location.dataQuery['g-recaptcha-response'] = info.captcha
                location.headers.cookie = info.session
            }
            catch (e) {
                await browser.close()
            }
        }
    })

    async function locate(entry) {
        const inspireID = entry.data[parameters.inspireIDField]
        if (!inspireID) {
            alert({
                identifier: `Line ${entry.line}`,
                message: 'no title number found',
                importance: 'error'
            })
            return
        }
        return {
            identifier: inspireID,
            url: 'https://search-property-information.service.gov.uk/search/search-by-inspire-id',
            method: 'POST',
            dataQuery: {
                search_input: inspireID
            },
            headers: {
                referer: 'https://search-property-information.service.gov.uk/search/search-by-inspire-id',
                'user-agent': 'Reconcile'
            },
            passthrough: {
                inspireID
            }
        }
    }

    function parse(response) {
        if (!response) return
        const document = Cheerio.load(response.data)
        const failure = document('.govuk-error-summary__list').get().length > 0
        if (failure) {
            alert({
                identifier: response.passthrough.inspireID,
                message: 'could not find ID',
                importance: 'error'
            })
            return
        }
        return {
            titleAddress: document('.summary-list__row:nth-of-type(1) .summary-list__value > .govuk-body').text().trim(),
            titleTenure: document('.summary-list__row:nth-of-type(2) .summary-list__value').clone().children().remove().end().text().trim()
        }
    }

    async function run(input) {
        const dataLocated = await locate(input)
        const dataLocatedRequested = await request(dataLocated)
        const dataParsed = parse(dataLocatedRequested)
        return dataParsed
    }

    return run

}

const details = {
    parameters: [
        {
            name: 'inspireIDField',
            description: 'Inspire ID column.',
            required: true
        }
    ],
    columns: [
        { name: 'titleAddress' },
        { name: 'titleTenure', description: 'Leasehold or freehold.' }
    ]
}

export default { initialise, details }
