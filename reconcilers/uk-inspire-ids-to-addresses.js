import Cheerio from 'cheerio'
import Puppeteer from 'puppeteer'

function initialise(parameters, requestor, alert) {

    const request = requestor({
        messages: e => {
            if (e.response.status >= 400) return `Received code ${e.response.status} for ID ${e.config.passthrough.inspireID}`
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
            const page = (await browser.pages())[0]
            await page.goto('https://search-property-information.service.gov.uk/search/search-by-inspire-id')
            await page.evaluate(() => {
                document.querySelector('body').replaceChildren(document.querySelector('#inspire-id-search'))
                document.querySelectorAll('fieldset, .govuk-form-group:nth-of-type(1), button').forEach(element => element.remove())
                document.querySelector('#inspire-id-search').style.cssText += 'display:grid;place-items:center;min-height:100vh;'
            })
            await page.waitForFunction(() => grecaptcha.getResponse() !== '')
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
    })

    async function locate(entry) {
        const inspireID = entry.data[parameters.inspireIDField]
        if (!inspireID) {
            alert({
                message: `No title number found on line ${entry.line}`,
                importance: 'error'
            })
            return
        }
        return {
            url: 'https://search-property-information.service.gov.uk/search/search-by-inspire-id',
            method: 'POST',
            dataQuery: {
                search_input: inspireID
            },
            headers: {
                referer: 'https://search-property-information.service.gov.uk/search/search-by-inspire-id',
                'user-agent': 'reconcile'
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
                message: `Could not find ID ${response.passthrough.inspireID}`,
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
