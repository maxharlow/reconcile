Reconcile
=========

Enrich your data, adding new columns based on lookups to online services.

Requires [Node](https://nodejs.org/).


Installing
----------

    $ npm install -g reconcile

Alternatively, don't install it and just prepend the below commands with `npx`.


Usage
-----

    $ reconcile <command> <filename>

Where `<command>` is one of the operations listed in the next section.

Each command will need some parameters specific to what it does to work, which are given using the `-p` flag. They should be written in Yaml format, for example:

    $ reconcile company-numbers-to-company-officer-names input.csv -p 'jurisdiction: gb, companyNumberField: RegisteredCompanyNumber' > output.csv

Note this also uses redirection (`>`) to send the output into a new CSV file. If you are giving it a value that has spaces in it, you'll need put it in quotes. If, as above, you used single quotes (`'`) around your whole list of parameters, you should use double quotes (`"`) around the value, and vice-versa.

If there are a lot of parameters, it may be more convenient to put them in a separate file, and pass the name of that file to `-p`.

HTTP requests are automatically retried if they fail, five times by default, but this can be adjusted with the `-r` flag.

Request caching can be turned on with the `-c` flag. This will save a copy of each HTTP request in a `.reconcile-cache` directory. Reconcile always looks for a cached copy of a request before making one itself. Note that if the data is likely to have changed since it was cached, you will still be getting the cached copy -- delete the directory if this is not what you want. Also beware that this directory can become quite large.

If you'd like to include rows where no match was found, or an error was encountered, set the join flag `-j` to `'outer'`.


Commands
--------

Double-press the tab key to autocomplete these names from the command line.

<hr>

#### `company-names-to-company-numbers`

Use [OpenCorporates](https://opencorporates.com/) to look up a list of company names and find the most likely registration number for each. Beware incorrect matches! Company names are terrible unique identifiers.

Parameters:
* `apiToken` An OpenCorporates API token. You are [limited to 200 requests per month and 50 per day](https://api.opencorporates.com/documentation/API-Reference#usage-limits) otherwise. Optional.
* `jurisdiction` If all companies have the same jurisdiction you can specify it here instead of in a column. Optional.
* `companyNameField` Company name column. Optional. Default is `"companyName"`.
* `companyJurisdictionField` Jurisdiction code column, if any. It should use [ISO 3166-2 format](https://en.wikipedia.org/wiki/ISO_3166-2#Current_codes). Optional. Default is `"companyJurisdiction"`.
* `maximumResults` Maximum number of results to include for each name. Optional. Default is 1, maximum is 30, or 100 with an API token.

Produces a CSV including columns:
* `companyJurisdiction`
* `companyNumber`
* `companyName`

<hr>

#### `company-numbers-to-company-details`

Use [OpenCorporates](https://opencorporates.com/) to look up a list of company numbers and jurisdiction codes, and retrieve various details for each.

Parameters:
* `apiToken` An OpenCorporates API token. You are [limited to 200 requests per month and 50 per day](https://api.opencorporates.com/documentation/API-Reference#usage-limits) otherwise. Optional.
* `jurisdiction` If all companies have the same jurisdiction you can specify it here instead of in a column. Optional.
* `companyNumberField` Company number column. Optional. Default is `"companyNumber"`.
* `companyJurisdictionField` Jurisdiction code column. It should use [ISO 3166-2 format](https://en.wikipedia.org/wiki/ISO_3166-2#Current_codes). Optional. Default is `"companyJurisdiction"`.

Produces a CSV including columns:
* `companyJurisdiction`
* `companyName`
* `companyIncorporationDate`
* `companyDissolutionDate`
* `companyType`
* `companyStatus`
* `companyAddress`
* `companyPreviousNames`
* `companyAlternativeNames`
* `companyBeneficialOwners`
* `companyAgentName`
* `companyAgentAddress`
* `companyActivities`

<hr>

#### `company-numbers-to-company-officer-names`

Use [OpenCorporates](https://opencorporates.com/) to look up a list of company numbers and jurisdiction codes, and retrieve the names of their officers.

Parameters:
* `apiToken` An OpenCorporates API token. You are [limited to 200 requests per month and 50 per day](https://api.opencorporates.com/documentation/API-Reference#usage-limits) otherwise. Optional.
* `jurisdiction` If all companies have the same jurisdiction you can specify it here instead of in a column. Optional.
* `companyNumberField` Company number column. Optional. Default is `"companyNumber"`.
* `companyJurisdictionField` Jurisdiction code column, if any. It should use [ISO 3166-2 format](https://en.wikipedia.org/wiki/ISO_3166-2#Current_codes). Optional. Default is `"companyJurisdiction"`.

Produces a CSV including columns:
* `companyName`
* `officerName`
* `officerPosition`
* `officerStartDate`
* `officerEndDate`
* `officerNationality`
* `officerOccupation`
* `officerAddress` (only if an API token is sent)
* `officerDateOfBirth` (only if an API token is sent)

<hr>

#### `individual-names-to-company-officer-names`

Use [OpenCorporates](https://opencorporates.com/) to look up a list of individual names and find which companies they are officers of (typically either as directors or secretaries).

Parameters:
* `apiToken` An OpenCorporates API token. You are [limited to 200 requests per month and 50 per day](https://api.opencorporates.com/documentation/API-Reference#usage-limits) otherwise. Optional.
* `jurisdiction` If all individuals have the same jurisdiction you can specify it here instead of in a column. Optional.
* `individualNameField` Individual name column. Optional. Default is `"individualName"`.
* `individualDateOfBirthField` Individual birth date column. It should use [ISO 8601 format](https://en.wikipedia.org/wiki/ISO_8601). For a range the two dates should be separated with a colon. Optional. Default is `"individualDateOfBirth"`.
* `individualJurisdictionField` Jurisdiction code column, if any. It should use [ISO 3166-2 format](https://en.wikipedia.org/wiki/ISO_3166-2#Current_codes). Optional. Default is `"individualJurisdiction"`.
* `maximumResults` Maximum number of results to include for each name. Optional. Default is 1, maximum is 30, or 100 with an API token.

Produces a CSV including columns:
* `officerName`
* `officerPosition`
* `officerNationality`
* `officerOccupation`
* `officerAddress` (only if an API token is sent)
* `officerDateOfBirth` (only if an API token is sent)
* `companyName`
* `companyNumber`
* `companyJurisdiction`

<hr>

#### `land-registry-title-numbers-to-addresses`

Look up [Land Registry](https://www.gov.uk/government/organisations/land-registry) title numbers (such as the result of a [PN1 search](https://www.gov.uk/government/publications/proprieters-names-search-of-the-index-pn1)), and find their addresses.

Parameters:
* `titleNumberField` Title number field. Optional. Default is `"titleNumber"`.

Produces a CSV including columns:
* `titleAddress`
* `titleTenure` Leasehold or freehold.

<hr>

#### `names-to-sec-ciks`

Use the [US SEC Edgar CIK lookup](https://www.sec.gov/edgar/searchedgar/cik.htm) to take a list of names of companies, funds, or individuals and find the most likely CIK, or 'central index key', an identifier given by the SEC to those who have filed disclosures. Beware incorrect matches! Names are terrible unique identifiers.

Parameters:
* `nameField` Name column. Optional. Default is `"name"`.
* `maximumResults` Maximum number of results to include for each name. Optional. Default is 1, maximum is 100.

Produces a CSV including columns:
* `name`
* `cik`

<hr>

#### `sec-ciks-to-sec-filings`

Use the [US SEC Edgar company filings search](https://www.sec.gov/edgar/searchedgar/companysearch.html) to take a list of CIKs, or 'central index keys', an identifier given by the SEC to those who have filed disclosures, and retrieve all their filings.

Parameters:
* `cikField` CIK column. Optional. Default is `"cik"`.
* `filingType` Type of filings to include, eg. 10-K. Optional. Default is all filings.
* `includeAll` Set true to include all filed documents, instead of just the first. Optional. Default is first only.

Produces a CSV including columns:
* `filingDate`
* `filingType`
* `filingDetail`
* `filingDocumentType`
* `filingDocumentDescription`
* `filingDocument`

<hr>

#### `uk-company-names-to-company-numbers`

Use UK [Companies House](https://beta.companieshouse.gov.uk/) to look up a list of company names and find the most likely registration number for each. Beware incorrect matches! Company names are terrible unique identifiers.

Parameters:
* `apiKey` A Companies House [API key](https://developer.companieshouse.gov.uk/developer/applications/register).
* `companyNameField` Company name column. Optional. Default is `"companyName"`.
* `maximumResults` Maximum number of results to include for each name. Optional. Default is 1, maximum is 100.

Produces a CSV including columns:
* `companyNumber`
* `companyName`

<hr>

#### `uk-company-numbers-to-company-details`

Use UK [Companies House](https://beta.companieshouse.gov.uk/) to look up a list of company numbers, and retrieve various details for each.

Parameters:
* `apiKey` A Companies House [API key](https://developer.companieshouse.gov.uk/developer/applications/register).
* `companyNumberField` Company number column. Optional. Default is `"companyNumber"`.

Produces a CSV including columns:
* `companyName`
* `companyUKJurisdiction`
* `companyCreationDate`
* `companyCessationDate`
* `companyType`
* `companySubtype`
* `companyStatus`
* `companyStatusDetail`
* `companyAddress`
* `companyAddressIsInDispute`
* `companyAddressIsUndeliverable`
* `companyPreviousNames`
* `companySICs`
* `companyCanFile`
* `companyHasInsolvencyHistory`
* `companyHasCharges`
* `companyHasBeenLiquidated`
* `companyAccountsOverdue`
* `companyAnnualReturnOverdue`
* `companyPartialDataAvailable`
* `companyExternalRegistrationNumber`
* `companyLastFullMembersListDate`

<hr>

#### `uk-company-numbers-to-company-beneficial-owner-names`

Use UK [Companies House](https://beta.companieshouse.gov.uk/) to look up a list of company numbers, and retrieve the names of their beneficial owners.

Parameters:
* `apiKey` A Companies House [API key](https://developer.companieshouse.gov.uk/developer/applications/register).
* `companyNumberField` Company number column. Optional. Default is `"companyNumber"`.

Produces a CSV including columns:
* `beneficialOwnerName`
* `beneficialOwnerKind`
* `beneficialOwnerNaturesOfControl`
* `beneficialOwnerName`
* `beneficialOwnerTitle`
* `beneficialOwnerFirstName`
* `beneficialOwnerMiddleNames`
* `beneficialOwnerLastName`
* `beneficialOwnerKind`
* `beneficialOwnerNaturesOfControl`
* `beneficialOwnerNotifiedOn`
* `beneficialOwnerCeasedOn`
* `beneficialOwnerNationality`
* `beneficialOwnerAddress`
* `beneficialOwnerDateOfBirth`
* `beneficialOwnerCountryOfResidence`
* `beneficialOwnerIDLegalAuthority`
* `beneficialOwnerIDLegalForm`
* `beneficialOwnerIDRegisteredPlace`
* `beneficialOwnerIDRegisteredCountry`
* `beneficialOwnerIDNumber`

<hr>

#### `uk-company-numbers-to-company-officer-names`

Use UK [Companies House](https://beta.companieshouse.gov.uk/) to look up a list of company numbers, and retrieve the names of their officers.

Parameters:
* `apiKey` A Companies House [API key](https://developer.companieshouse.gov.uk/developer/applications/register).
* `companyNumberField` Company number column. Optional. Default is `"companyNumber"`.

Produces a CSV including columns:
* `officerName`
* `officerRole`
* `officerAppointedDate`
* `officerResignedDate`
* `officerNationality`
* `officerOccupation`
* `officerAddress`
* `officerDateOfBirth`
* `officerCountryOfResidence`
* `officerFormerNames`
* `officerIDType`
* `officerIDLegalAuthority`
* `officerIDLegalForm`
* `officerIDRegisteredPlace`
* `officerIDNumber`
