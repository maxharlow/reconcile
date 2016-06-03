Reconcile
=========

Add new columns to your spreadsheet based on looking up names or numbers.

Requires [Node](http://nodejs.org/).


Installing
----------

    $ npm install -g reconcile


Usage
-----

    $ reconcile <command> <filename>

Where `<command>` is one of the following operations:


#### `company-names-to-company-numbers`

Use [OpenCorporates](https://opencorporates.com/) to look up a list of company names and find the most likely registration number for each.

Parameters:
    * `apiToken` (optional) An OpenCorporates API token. You are [limited to 500 requests per month](https://api.opencorporates.com/documentation/API-Reference#usage_limits) otherwise.
    * `jurisdiction` (optional) If all companies have the same jurisdiction you can specify it here instead of in a column.
    * `companyNameField` (optional) The name of the column which contains the company names. Defaults to `companyName`.
    * `companyJurisdictionField` (optional) The name of the column which contains the company jurisdictions, if specified. Defaults to `companyJurisdiction`.

Produces a CSV which adds:
    * `companyJurisdiction`
    * `companyNumber`
    * `companyName`

Results do not include companies for which no match is found. Beware incorrect matches! Company names are terrible unique identifiers.


#### `company-numbers-to-company-details`

Use [OpenCorporates](https://opencorporates.com/) to look up a list of company numbers and jurisdiction codes, and retrieve various details for each.

Parameters:
    * `apiToken` (optional) An OpenCorporates API token. You are [limited to 500 requests per month](https://api.opencorporates.com/documentation/API-Reference#usage_limits) otherwise.
    * `jurisdiction` (optional) If all companies have the same jurisdiction you can specify it here instead of in a column.
    * `companyNumberField` (optional) The name of the column which contains the company numbers. Defaults to `companyNumber`.
    * `companyJurisdictionField` (optional) The name of the column which contains the company jurisdictions. Defaults to `companyJurisdiction`.

Produces a CSV which adds:
    * `companyName`
    * `companyIncorporationDate`
    * `companyDissolutionDate`
    * `companyType`
    * `companyStatus`
    * `companyAddress`
    * `companyPreviousNames`
    * `companyAlternativeNames`
    * `companyAgentName`
    * `companyAgentAddress`


#### `company-numbers-to-company-officer-names`

Use [OpenCorporates](https://opencorporates.com/) to look up a list of company numbers and jurisdiction codes, and retrieve the names of their directors.

Parameters:
    * `apiToken` (optional) An OpenCorporates API token. You are [limited to 500 requests per month](https://api.opencorporates.com/documentation/API-Reference#usage_limits) otherwise.
    * `jurisdiction` (optional) If all companies have the same jurisdiction you can specify it here instead of in a column.
    * `companyNumberField` (optional) The name of the column which contains the company numbers. Defaults to `companyNumber`.
    * `companyJurisdictionField` (optional) The name of the column which contains the company jurisdictions, if specified. Defaults to `companyJurisdiction`.

Produces a CSV which includes:
    * `officerName`
    * `officerPosition`
    * `officerStartDate`
    * `officerEndDate`
    * `officerNationality`
    * `officerOccupation`
    * `officerAddress` (only if API token is sent)
    * `officerDateOfBirth` (only if API token is sent)


#### `individual-names-to-company-officer-names`

Use [OpenCorporates](https://opencorporates.com/) to look up a list of individual names and find which companies they are officers of (typically either as directors or secretaries).

Parameters:
    * `apiToken` (optional) An OpenCorporates API token. You are [limited to 500 requests per month](https://api.opencorporates.com/documentation/API-Reference#usage_limits) otherwise.
    * `jurisdiction` (optional) If all individuals have the same jurisdiction you can specify it here instead of in a column.
    * `individualNameField` (optional) The name of the column which contains the individual names. Defaults to `individualName`.
    * `individualJurisdictionField` (optional) The name of the column which contains the individual jurisdictions, if specified. Defaults to `individualJurisdiction`.

Produces a CSV which includes:
    * `officerName`
    * `officerPosition`
    * `officerNationality`
    * `officerOccupation`
    * `officerAddress` (only if API token is sent)
    * `officerDateOfBirth` (only if API token is sent)
    * `companyName`
    * `companyNumber`
    * `companyJurisdiction`
