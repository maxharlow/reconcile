Reconcile
=========

Enrich your data, adding new columns based on lookups to online services.


Installing
----------

    $ npm install -g reconcile

Alternatively, don't install it and just prepend the below commands with `npx`.


Usage
-----

    $ reconcile <command> <filename>

Where `<command>` is one of the operations listed in the next section.

Each command will need some parameters specific to what it does to work, which are given using the `-p` flag. They should be written in Yaml format, for example:

    $ reconcile company-numbers-to-company-officer-names input.csv -p 'jurisdiction: gb; companyNumberField: RegisteredCompanyNumber' > output.csv

Note this also uses redirection (`>`) to send the output into a new CSV file. If you are giving it a value that has spaces in it, you'll need put it in quotes. If, as above, you used single quotes (`'`) around your whole list of parameters, you should use double quotes (`"`) around the value, and vice-versa.

If there are a lot of parameters, it may be more convenient to put them in a separate file, and pass the name of that file to `-p`.

HTTP requests are automatically retried if they fail, five times by default, but this can be adjusted with the `-r` flag.

Request caching can be turned on with the `-c` flag. This will save a copy of each HTTP request in a `.reconcile-cache` directory, and look for a cached copy of a request before making one itself. Note that if the data is likely to have changed since it was cached, you will still be getting the cached copy -- delete the directory if this is not what you want. Also beware that this directory can become quite large.

If you'd like to include rows where no match was found, or an error was encountered, set the join flag `-j` to `outer`.


Commands
--------

Double-press the tab key to autocomplete these names from the command line.

<hr>

### Using OpenCorporates

#### `company-numbers-to-company-details`

Use [OpenCorporates](https://opencorporates.com/) to look up a list of company numbers and jurisdiction codes, and retrieve various details for each.

Parameters:
* `apiToken` An OpenCorporates API token. You are [limited to 200 requests per month and 50 per day](https://api.opencorporates.com/documentation/API-Reference#usage-limits) otherwise. Optional.
* `jurisdiction` If all companies have the same jurisdiction you can specify it here instead of in a column. Required unless `companyJurisdictionField` is specified.
* `companyNumberField` Company number column.
* `companyJurisdictionField` Jurisdiction code column. It should use [ISO 3166-2 format](https://en.wikipedia.org/wiki/ISO_3166-2#Current_codes). Required unless `jurisdiction` is specified.

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
* `jurisdiction` If all companies have the same jurisdiction you can specify it here instead of in a column. Required unless `companyJurisdictionField` is specified.
* `companyNumberField` Company number column.
* `companyJurisdictionField` Jurisdiction code column, if any. It should use [ISO 3166-2 format](https://en.wikipedia.org/wiki/ISO_3166-2#Current_codes). Required unless `jurisdiction` is specified.

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

#### `company-names-to-company-numbers`

Use [OpenCorporates](https://opencorporates.com/) to look up a list of company names and find the most likely registration number for each. Beware incorrect matches! Company names are terrible unique identifiers.

Parameters:
* `jurisdiction` If all companies have the same jurisdiction you can specify it here instead of in a column. Optional.
* `companyNameField` Company name column.
* `companyJurisdictionField` Jurisdiction code column, if any. It should use [ISO 3166-2 format](https://en.wikipedia.org/wiki/ISO_3166-2#Current_codes). Optional.
* `maximumResults` Maximum number of results to include for each name. Optional. Default is 1.

Produces a CSV including columns:
* `companyJurisdiction`
* `companyNumber`
* `companyName`

<hr>

#### `individual-names-to-company-officer-names`

Use [OpenCorporates](https://opencorporates.com/) to look up a list of individual names and find which companies they are officers of (typically either as directors or secretaries).

Parameters:
* `apiToken` An OpenCorporates API token.
* `jurisdiction` If all individuals have the same jurisdiction you can specify it here instead of in a column. Optional.
* `individualNameField` Individual name column.
* `individualDateOfBirthField` Individual birth date column. It should use [ISO 8601 format](https://en.wikipedia.org/wiki/ISO_8601). For a range the two dates should be separated with a colon. Optional.
* `individualJurisdictionField` Jurisdiction code column, if any. It should use [ISO 3166-2 format](https://en.wikipedia.org/wiki/ISO_3166-2#Current_codes). Optional.

Produces a CSV including columns:
* `officerName`
* `officerPosition`
* `officerNationality`
* `officerOccupation`
* `officerAddress`
* `officerDateOfBirth`
* `companyName`
* `companyNumber`
* `companyJurisdiction`

<hr>

#### `names-to-company-beneficial-owner-names`

Use [OpenCorporates](https://opencorporates.com/) to look up a list of names of companies or individuals and find which companies are their beneficial owners. Includes past beneficial owners.

Parameters:
* `apiToken` An OpenCorporates API token.
* `nameField` Name column.

Produces a CSV including columns:
* `ownerName`
* `ownerCompanyNumber`
* `ownerCompanyJurisdiction`
* `ownerBirthDate`
* `ownerNationality`
* `ownerCountryOfResidence`
* `ownerAddress`
* `ownerControlMechanisms`
* `companyName`
* `companyNumber`
* `companyJurisdiction`

<hr>


### Using Companies House (UK)

#### `uk-company-numbers-to-company-details`

Use [Companies House](https://find-and-update.company-information.service.gov.uk/) to look up a list of company numbers, and retrieve various details for each.

Parameters:
* `apiKey` A Companies House [API key](https://developer.company-information.service.gov.uk/developer/applications/register).
* `companyNumberField` Company number column.

Produces a CSV including columns:
* `companyNumber`
* `companyName`
* `companyUKJurisdiction`
* `companyCreationDate`
* `companyCessationDate`
* `companyType`
* `companySubtype`
* `companyStatus`
* `companyStatusDetail`
* `companyPostcode`
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

#### `uk-company-numbers-to-filings`

Use [Companies House](https://find-and-update.company-information.service.gov.uk/) to look up a list of company numbers, and retrieve the filings for each.

Parameters:
* `apiKey` A Companies House [API key](https://developer.company-information.service.gov.uk/developer/applications/register).
* `companyNumberField` Company number column.
* `filingCategory` Category of filings to include, eg. "accounts". Optional. Default is all filings. Can be: `accounts`, `address`, `annual-return`, `capital`, `change-of-name`, `incorporation`, `liquidation`, `miscellaneous`, `mortgage`, `officers`, `resolution`, `confirmation-statement`.
* `filingDescription` Descriptions of filings to include. Optional.
* `includeAll` Set true to include all filed documents, instead of just the first. Optional. Default is first only.

Produces a CSV including columns:
* `filingDate`
* `filingCategory`
* `filingSubcategory`
* `filingType`
* `filingDescription`
* `filingActionDate`
* `filingPaperFiled`
* `filingID`
* `filingURL`
* `filingAPIURL

<hr>

#### `uk-company-numbers-to-company-beneficial-owner-names`

Use [Companies House](https://find-and-update.company-information.service.gov.uk/) to look up a list of company numbers, and retrieve the names of their beneficial owners.

Parameters:
* `apiKey` A Companies House [API key](https://developer.company-information.service.gov.uk/developer/applications/register).
* `companyNumberField` Company number column.

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
* `beneficialOwnerNotifiedDate`
* `beneficialOwnerCeasedDate`
* `beneficialOwnerNationality`
* `beneficialOwnerAddress`
* `beneficialOwnerDateOfBirth`
* `beneficialOwnerCountryOfResidence`
* `beneficialOwnerIdentificationLegalAuthority`
* `beneficialOwnerIdentificationLegalForm`
* `beneficialOwnerIdentificationRegisteredPlace`
* `beneficialOwnerIdentificationRegisteredCountry`
* `beneficialOwnerIdentificationNumber`

<hr>

#### `uk-company-numbers-to-uk-company-officer-ids`

Use [Companies House](https://find-and-update.company-information.service.gov.uk/) to look up a list of company numbers, and retrieve the IDs and names of their officers.

Parameters:
* `apiKey` A Companies House [API key](https://developer.company-information.service.gov.uk/developer/applications/register).
* `companyNumberField` Company number column.

Produces a CSV including columns:
* `officerID`
* `officerName`
* `officerDateOfBirth`
* `officerNationality`
* `officerRole`
* `officerAppointedDate`
* `officerResignedDate`
* `officerOccupation`
* `officerAddress`
* `officerCountryOfResidence`
* `officerFormerNames`
* `officerIdentificationType`
* `officerIdentificationLegalAuthority`
* `officerIdentificationLegalForm`
* `officerIdentificationRegisteredPlace`
* `officerIdentificationNumber`

<hr>

#### `uk-company-numbers-to-insolvency-cases`

Use [Companies House](https://find-and-update.company-information.service.gov.uk/) to look up a list of company numbers, and retrieve the insolvency cases for each.

Parameters:
* `apiKey` A Companies House [API key](https://developer.company-information.service.gov.uk/developer/applications/register).
* `companyNumberField` Company number column.

Produces a CSV including columns:
* `companyInsolvencyStatus`
* `companyInsolvencyCaseNumber`
* `companyInsolvencyCaseType`
* `companyInsolvencyCaseWoundUpDate`
* `companyInsolvencyCasePetitionedDate`
* `companyInsolvencyCaseConcludedWindingUpDate`
* `companyInsolvencyCaseDueToBeDissolvedDate`
* `companyInsolvencyCaseDissolvedDate`
* `companyInsolvencyCaseAdministrationStartedDate`
* `companyInsolvencyCaseAdministrationEndedDate`
* `companyInsolvencyCaseAdministrationDischargedDate`
* `companyInsolvencyCaseVoluntaryArrangementStartedDate`
* `companyInsolvencyCaseVoluntaryArrangementEndedDate`
* `companyInsolvencyCaseMoratoriumStartedDate`
* `companyInsolvencyCaseInstrumentedDate`
* `companyInsolvencyCasePractitioners`
* `companyInsolvencyCaseNotes`

<hr>

#### `uk-company-numbers-to-charges`

Use [Companies House](https://find-and-update.company-information.service.gov.uk/) to look up a list of company numbers, and retrieve the charges for each.

Parameters:
* `apiKey` A Companies House [API key](https://developer.company-information.service.gov.uk/developer/applications/register).
* `companyNumberField` Company number column.

Produces a CSV including columns:
* `chargeCode`
* `chargeNumber`
* `chargeStatus`
* `chargePersonsEntitled`
* `chargeAcquiredDate`
* `chargeCreatedDate`
* `chargeDeliveredDate`
* `chargeResolvedDate`
* `chargeSatisfiedDate`
* `chargeCoveringInstrumentDate`
* `chargeTransactions`
* `chargeInsolvencyCases`
* `chargeParticulars`
* `chargeContainsFixedCharge`
* `chargeContainsFloatingCharge`
* `chargeContainsNegativePledge`
* `chargeFloatingChargeCoversAll`
* `chargeChargorActingAsBareTrustee`
* `chargeHasScottishAlterationsToOrder`
* `chargeHasScottishAlterationsToProhibitions`
* `chargeHasScottishAlterationsRestrictingProvisions`
* `chargeAssetsCeasedReleased`
* `chargeClassificationType`
* `chargeClassificationDescription`
* `chargeSecuredType`
* `chargeSecuredDescription`

<hr>

#### `company-names-to-uk-company-numbers`

Use [Companies House](https://find-and-update.company-information.service.gov.uk/) to look up a list of company names and find the most likely registration number for each. Beware incorrect matches! Company names are terrible unique identifiers.

Parameters:
* `apiKey` A Companies House [API key](https://developer.company-information.service.gov.uk/developer/applications/register).
* `companyNameField` Company name column.
* `postcodeField` Postcode column. If given will use it to filter results. Only looks at the current company postcode. Optional.
* `preciseMatch` Match company name precisely. Ignores non-alphanumeric differences. Optional.
* `maximumResults` Maximum number of results to include for each name. Optional. Default is 1, maximum is 100.

Produces a CSV including columns:
* `companyNumber`
* `companyName`
* `companyCreationDate`
* `companyCessationDate`
* `companyPostcode`
* `companyAddress`

<hr>

#### `place-names-to-uk-company-numbers`

Use [Companies House](https://find-and-update.company-information.service.gov.uk/) to look up a list of place names and retrieve all the companies who include that term in their registered address.

Parameters:
* `apiKey` A Companies House [API key](https://developer.company-information.service.gov.uk/developer/applications/register).
* `placeNameField` Place name column.
* `maximumResults` Maximum number of results to include for each name. Optional. Default is all.

Produces a CSV including columns:
* `companyNumber`
* `companyName`
* `companyStatus`
* `companyType`
* `companyCreationDate`
* `companyCessationDate`
* `companyPostcode`
* `companyAddress`

<hr>

#### `individual-names-to-uk-company-officer-ids`

Use [Companies House](https://find-and-update.company-information.service.gov.uk/) to look up a list of individual names and find the ID numbers for each. Many officers will have multiple IDs associated with them. This is limited to bringing back the first 10 pages of matches.

Parameters:
* `apiKey` A Companies House [API key](https://developer.company-information.service.gov.uk/developer/applications/register).
* `individualNameField` Individual name column.
* `dateOfBirthField` Date of birth column, in ISO 8601 format. If given will use the month and year to filter results. Optional.
* `nonMiddleNameMatch` Match individual name only based on the first and last names. Ignores non-alphabetical differences and titles. Optional.
* `preciseMatch` Match individual name precisely. Ignores non-alphabetical differences and titles. Optional.

Produces a CSV including columns:
* `officerID`
* `officerName`
* `officerDateOfBirth`
* `officerAddress`

<hr>

#### `uk-company-officer-ids-to-company-numbers`

Use [Companies House](https://find-and-update.company-information.service.gov.uk/) to look up a list of officer IDs, and retrieve the company numbers for their appointments.

Parameters:
* `apiKey` A Companies House [API key](https://developer.company-information.service.gov.uk/developer/applications/register).
* `officerIDField` Officer ID column.

Produces a CSV including columns:
* `companyNumber`
* `companyName`
* `companyStatus`
* `officerID`
* `officerName`
* `officerNationality`
* `officerRole`
* `officerAppointedDate`
* `officerResignedDate`
* `officerOccupation`
* `officerAddress`
* `officerCountryOfResidence`

<hr>


### Using Investegate (UK)

#### `uk-tickers-to-regulatory-announcements`

Use [Investegate](https://www.investegate.co.uk/) to take a list of tickers for UK-listed (FTSE 350, Aim, TechMark) companies, and retrieve all their regulatory announcements.

Parameters:
* `tickerField` Ticker column.
* `category` Only include annoucements in this category. Optional. Default: all. Can be: `m-and-a`, `results`, `dividends`, `exec-changes`, `director-dealings`, `advance-results`.
* `maximumResults` Maximum number of results to include for each ticker. Optional. Default is all.
* `maximumDate` Maximum announcement date for announcements from each ticker, in ISO 8601 format. Optional. Default is no limit.

Produces a CSV including columns:
* `announcementDate`
* `announcementTime`
* `announcementSource`
* `announcementCompany`
* `announcementTitle`
* `accouncementURL`
* `announcementBody`

<hr>


### Using SEC Edgar (US)

#### `sec-ciks-to-sec-filings`

Use the [SEC Edgar company filings search](https://www.sec.gov/edgar/searchedgar/companysearch.html) to take a list of CIKs, or 'central index keys', an identifier given by the SEC to those who have filed disclosures, and retrieve all their filings.

Parameters:
* `cikField` CIK column.
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

#### `names-to-sec-ciks`

Use the [SEC Edgar CIK lookup](https://www.sec.gov/edgar/searchedgar/cik.htm) to take a list of names of companies, funds, or individuals and find the most likely CIK, or 'central index key', an identifier given by the SEC to those who have filed disclosures. Beware incorrect matches! Names are terrible unique identifiers.

Parameters:
* `nameField` Name column.
* `maximumResults` Maximum number of results to include for each name. Optional. Default is 1, maximum is 100.

Produces a CSV including columns:
* `name`
* `cik`

<hr>

### Using Wikipedia & Wikidata

#### `terms-to-wikidata-concepts`

Use Wikidata to take a list of terms, and retrieve the Wikidata concept IDs for each of the results.

Parameters:
* `termField` Term column.
* `includeAll` Set true to include all URLs, instead of just the first. Optional. Default is first 50 only.

Produces a CSV including columns:
* `wikidataConceptID`
* `wikidataConceptDescription`

<hr>

#### `wikidata-concepts-to-data`

Use Wikidata to extract a specific [property](https://www.wikidata.org/wiki/Wikidata:List_of_properties) from each of the results, such as the [date of birth](https://www.wikidata.org/wiki/Property:P569) or [Facebook ID](https://www.wikidata.org/wiki/Property:P2013).

Parameters:
* `conceptIDField` Concept ID column.
* `property` Wikidata property to extract.

Produces a CSV including columns:
* `value`

<hr>

#### `wikipedia-urls-to-wikidata-concepts`

Use Wikipedia to take a list of URLs, and extract out the Wikidata concept IDs for each.

Parameters:
* `urlField` URL column.

Produces a CSV including columns:
* `wikidataConceptID`

<hr>

### Using Equasis

#### `ship-imo-numbers-to-ship-details`

Use [Equasis](https://www.equasis.org/) to take a list of ship IMO numbers, and retrieve all their connected companies, as well as other details. Note Equasis only allows around 500 lookups per day. If you exceed that two days in a row you get blocked for seven days.

Parameters:
* `email` The email address for a registered Equasis account.
* `password` The password for a registered Equasis account.
* `shipIMONumberField` Ship IMO number column.

Produces a CSV including columns:
* `shipName`
* `shipCallSign`
* `shipMMSI`
* `shipTonnage`
* `shipDWT`
* `shipType`
* `shipBuildYear`
* `shipFlag`
* `shipStatus`
* `shipFormerNames`
* `shipFormerFlags`
* `shipCompanyRole`
* `shipCompanyName`
* `shipCompanyDate`

<hr>

#### `ship-mmsi-numbers-to-ship-details`

Use [Equasis](https://www.equasis.org/) to take a list of ship MMSI numbers, and retrieve all their connected companies, as well as other details. Note Equasis only allows around 500 lookups per day. If you exceed that two days in a row you get blocked for seven days.

Parameters:
* `email` The email address for a registered Equasis account.
* `password` The password for a registered Equasis account.
* `shipMMSINumberField` Ship MMSI number column.

Produces a CSV including columns:
* `shipName`
* `shipCallSign`
* `shipMMSI`
* `shipTonnage`
* `shipDWT`
* `shipType`
* `shipBuildYear`
* `shipFlag`
* `shipStatus`
* `shipFormerNames`
* `shipFormerFlags`
* `shipCompanyRole`
* `shipCompanyName`
* `shipCompanyDate`

<hr>

#### `ship-names-to-ship-imo-numbers`

Use [Equasis](https://www.equasis.org/) to take a list of ship names, and retrieve their IMO numbers. Note Equasis only allows around 500 lookups per day. If you exceed that two days in a row you get blocked for seven days.

Parameters:
* `email` The email address for a registered Equasis account.
* `password` The password for a registered Equasis account.
* `shipNameField` Ship name column.

Produces a CSV including columns:
* `shipIMONumber`
* `shipName`
* `shipTonnage`
* `shipType`
* `shipBuildYear`
* `shipFlag`

<hr>

### Using ITU Mars

#### `ship-mmsi-numbers-to-ship-radio-station-details`

Use the [International Telecommunication Union's database of ship-based radio stations (ITU Mars)](https://www.itu.int/mmsapp/ShipStation/list) to take a list of ship MMSI numbers, and retrieve their details, including the owner.

Parameters:
* `shipMMSINumberField` Ship MMSI number column.

Produces a CSV including columns:
* `shipName`
* `shipCallSign`
* `shipIdentificationNumber`
* `shipOwner`
* `shipFormerName`
* `shipTonnage`
* `shipPersonCapacity`

<hr>

### Using IP API

#### `ip-addresses-to-details`

Use [IP API](https://ip-api.com/) to look up a list of IP addresses and get estimated details about their locations.

Parameters:
* `ipAddressField` IP address column.

Produces a CSV including columns:
* `country`
* `region`
* `city`
* `latitude`
* `longitude`
* `isp`
* `organisation`

<hr>

### Using Google Search

#### `terms-to-urls`

Use Google to take a list of terms, and retrieve the URLs for each of the results.

Parameters:
* `termField` Term column.
* `supplement` Extra terms to be included with the search. Optional.
* `includeAll` Set true to include all URLs, instead of just the first. Optional. Default is first page only.

Produces a CSV including columns:
* `resultTitle`
* `resultLocation`

<hr>

### Using data found on the given URLs

#### `urls-to-data`

Download each page and extract out arbitrary elements using CSS selectors.

Parameters:
* `urlField` URL column.
* `elements` Array of objects containing two fields, `key` and `selector`.

Produces a CSV including columns:
* `key`
* `value`

<hr>

#### `urls-to-google-analytics-ids`

Download each page and extract out anything that looks like a Google Analytics ID.

Parameters:
* `urlField` URL column.

Produces a CSV including columns:
* `googleAnalyticsID`

<hr>

### Using the Domain Name System (DNS)

#### `urls-to-domain-records`

Use DNS to look up a list of URLs, and resolve the domain name into records.

Parameters:
* `urlField` URL column.
* `recordType` Type of records to retrieve. Optional, default is `A`.

Produces a CSV including columns:
* `record`

<hr>

#### `urls-to-whois`

Use DNS to look up a list of URLs, and use the domain name to retrieve the Whois record.

Parameters:
* `urlField` URL column.
* `lineMatch` Filter lines to only those matching. Optional.

Produces a CSV including columns:
* `data`
