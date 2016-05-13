Reconcile
=========

Tools for converting lists of one type of thing into lists of another.

Requires [Node] (http://nodejs.org/).

Install the dependencies with `npm install`.


### `company-names-to-company-numbers`

Use OpenCorporates to look up a list of company names and find the most likely registration numbers for each.

Expects a CSV named `company-names.csv` including a column named `companyName`.

Produces a CSV named `company-numbers.csv`, which includes columns: `companyJuristiction`, `companyNumber`, and `companyName`.


### `company-numbers-to-company-details`

Use OpenCorporates to look up a list of company numbers and juristiction codes, and retrieve various details about the company.

Expects a CSV named `company-numbers.csv` including `companyNumber` and `companyJuristiction` columns.

Produces a CSV named `company-details.csv`, which includes columns: `companyName`, `comapnyIncorporationDate`, `companyDissolutionDate`, `companyType`, `companyStatus`, `companyAddress`, `companyPreviousNames`, `companyAlternativeNames`, `companyAgentName`, `companyAgentAddress`.


### `company-numbers-to-company-officer-names`

Use OpenCorporates to look up a list of company numbers and retrieve the names of their directors.

Expects a CSV named `company-numbers.csv` including `companyNumber` and `companyJuristiction` columns.

Produces a CSV named `company-officer-names.csv`, which includes columns: `officerName`, `officerPosition`, `officerStartDate`, `officerEndDate`.


### `individual-names-to-company-officer-names`

Use OpenCorporates to look up a list of individual names and find which companies they are officers of (typically either as directors or secretaries).

Expects a CSV named `individual-names.csv` including `individualName` and `comapnyJuristiction` columns.

Produces a CSV named `comapny-officer-names.csv`, which includes columns: `officerName`, `officerPosition`, `companyName`, `companyNumber`.
