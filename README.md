Reconcile
=========

Add new columns to your spreadsheet based on lookups to online services.

Requires [Node](http://nodejs.org/).


Installing
----------

    $ npm install -g reconcile


Usage
-----

    $ reconcile <command> <filename>

Where `<command>` is one of the operations listed in the next section.

Most commands need some parameters to work, which are given using the `-p` flag. They can be written in either Yaml or Json format, and either inline or in a file.

For example, if you had a file, `params.yaml`:

    jurisdiction: gb
    companyNumberField: RegisteredCompanyNumber

You would then want to run something like:

    $ reconcile company-numbers-to-company-officer-names input.csv -p params.yaml > output.csv

(Note this also uses redirection (`>`) to send the output into a new CSV file.)

Alternatively, give the parameters inline:

    $ reconcile company-numbers-to-company-officer-names input.csv -p '{jurisdiction: gb, companyNumberField: RegisteredCompanyNumber}' > output.csv


Commands
--------

Double-press the tab key to autocomplete these names from the command line.

<hr>

#### `company-names-to-company-numbers`

Use [OpenCorporates](https://opencorporates.com/) to look up a list of company names and find the most likely registration number for each.

Parameters:
* `apiToken` (optional) An OpenCorporates API token. You are [limited to 500 requests per month](https://api.opencorporates.com/documentation/API-Reference#usage_limits) otherwise.
* `jurisdiction` (optional) If all companies have the same jurisdiction you can specify it here instead of in a column.
* `companyNameField` (optional) Company name column. Default is `"companyName"`.
* `companyJurisdictionField` (optional) Jurisdiction code column, if any. Default is `"companyJurisdiction"`.

Produces a CSV which adds:

* `companyJurisdiction`
* `companyNumber`
* `companyName`

Jurisdiction codes should be given in [ISO 3166-2 format] (https://en.wikipedia.org/wiki/ISO_3166-2#Current_codes). Results do not include companies for which no match is found. Beware incorrect matches! Company names are terrible unique identifiers.

<hr>

#### `company-numbers-to-company-details`

Use [OpenCorporates](https://opencorporates.com/) to look up a list of company numbers and jurisdiction codes, and retrieve various details for each.

Parameters:
* `apiToken` (optional) An OpenCorporates API token. You are [limited to 500 requests per month](https://api.opencorporates.com/documentation/API-Reference#usage_limits) otherwise.
* `jurisdiction` (optional) If all companies have the same jurisdiction you can specify it here instead of in a column.
* `companyNumberField` (optional) Company number column. Default is `"companyNumber"`.
* `companyJurisdictionField` (optional) Jurisdiction code column. Default is `"companyJurisdiction"`.

Produces a CSV which adds:
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

Jurisdiction codes should be given in [ISO 3166-2 format] (https://en.wikipedia.org/wiki/ISO_3166-2#Current_codes).

<hr>

#### `company-numbers-to-company-officer-names`

Use [OpenCorporates](https://opencorporates.com/) to look up a list of company numbers and jurisdiction codes, and retrieve the names of their directors.

Parameters:
* `apiToken` (optional) An OpenCorporates API token. You are [limited to 500 requests per month](https://api.opencorporates.com/documentation/API-Reference#usage_limits) otherwise.
* `jurisdiction` (optional) If all companies have the same jurisdiction you can specify it here instead of in a column.
* `companyNumberField` (optional) Company number column. Default is `"companyNumber"`.
* `companyJurisdictionField` (optional) Jurisdiction code column, if any. Default is `"companyJurisdiction"`.

Produces a CSV which includes:
* `officerName`
* `officerPosition`
* `officerStartDate`
* `officerEndDate`
* `officerNationality`
* `officerOccupation`
* `officerAddress` (only if API token is sent)
* `officerDateOfBirth` (only if API token is sent)

Jurisdiction codes should be given in [ISO 3166-2 format] (https://en.wikipedia.org/wiki/ISO_3166-2#Current_codes).

<hr>

#### `individual-names-to-company-officer-names`

Use [OpenCorporates](https://opencorporates.com/) to look up a list of individual names and find which companies they are officers of (typically either as directors or secretaries).

Parameters:
* `apiToken` (optional) An OpenCorporates API token. You are [limited to 500 requests per month](https://api.opencorporates.com/documentation/API-Reference#usage_limits) otherwise.
* `jurisdiction` (optional) If all individuals have the same jurisdiction you can specify it here instead of in a column.
* `individualNameField` (optional) Individual name column. Default is `"individualName"`.
* `individualJurisdictionField` (optional) Jurisdiction code column, if any. Default is `"individualJurisdiction"`.

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

Jurisdiction codes should be given in [ISO 3166-2 format] (https://en.wikipedia.org/wiki/ISO_3166-2#Current_codes).
