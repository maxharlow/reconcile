const Readline = require('readline')
const FSExtra = require('fs-extra')
const Yargs = require('yargs')
const Process = require('process')
const Yaml = require('js-yaml')
const Progress = require('progress')
const PapaParse = require('papaparse')
const reconcile = require('./reconcile.js')

async function parse(parameters) {
    if (!parameters) return {}
    try {
        const file = await FSExtra.readFile(parameters, 'utf8')
        return Yaml.load(file)
    }
    catch (e) { // it's not a file, try and parse it instead
        try {
            return Yaml.load(parameters.replace(/, ?/g, '\n').replace(/: ?/g, ': '))
        }
        catch (e) {
            throw new Error('could not parse parameters')
        }
    }
}

function alert(message) {
    Readline.clearLine(process.stderr)
    Readline.cursorTo(process.stderr, 0)
    console.error(message)
}

function ticker(text, total) {
    const progress = new Progress(text + ' |:bar| :percent / :etas left', {
        total,
        width: Infinity,
        complete: '█',
        incomplete: ' '
    })
    return () => progress.tick()
}

function csv() {
    let headerWritten = false
    return function* (record) {
        if (!headerWritten) {
            const header = PapaParse.unparse([Object.keys(record)])
            yield header + '\n'
            headerWritten = true
        }
        const entry = PapaParse.unparse([Object.values(record)])
        yield entry + '\n'
    }
}

function write(line) {
    Process.stdout.write(line)
}

function display(details) {
    const align = section => {
        const width = Math.max(...section.map(item => item.name.length)) + 2
        const rows = section.map(item => {
            const space = ' '.repeat(width - item.name.length)
            return `  ${item.name}${space}${item.description || ''}`
        })
        return rows.join('\n')
    }
    return 'Parameters:\n' + align(details.parameters)
        + '\n\n'
        + 'Columns:\n' + align(details.columns)
}

async function setup() {
    const listing = await FSExtra.readdir(__dirname)
    const reconcilers = listing
        .filter(file => file.startsWith('reconcile-'))
        .map(file => file.match(/reconcile-(.+).js/)[1])
    const interface = Yargs
        .usage('Usage: reconcile <command> <filename>')
        .wrap(null)
        .completion('completion', false, () => reconcilers)
        .option('p', { alias: 'parameters', type: 'string', describe: 'Parameters to be passed to the reconciler, either in Json or Yaml' })
        .option('r', { alias: 'retries', type: 'number', nargs: 1, describe: 'Number of times a request should be retried', default: 5 })
        .option('c', { alias: 'cache', type: 'boolean', describe: 'Whether to cache HTTP requests', default: false })
        .help('?').alias('?', 'help')
        .version().alias('v', 'version')
    reconcilers.forEach(command => {
        const reconciler = require('./reconcile-' + command)
        const commandArgs = args => args
            .usage(`Usage: reconcile ${command} <filename>`)
            .demand(1, '')
            .positional('filename', { type: 'string', describe: 'The input file to process' })
            .epilog(display(reconciler.details))
        interface.command(command, '', commandArgs)
    })
    if (interface.argv['get-yargs-completions']) Process.exit(0)
    if (interface.argv._.length === 0) Yargs.showHelp().exit(0)
    try {
        const command = interface.argv._[0]
        const filename = interface.argv._[1]
        const parameters = await parse(interface.argv.parameters)
        const retries = interface.argv.retries
        const cache = interface.argv.cache
        if (!reconcilers.includes(command)) throw new Error(`${command}: reconciler not found`)
        if (filename === '-') throw new Error('reading from standard input not supported')
        const exists = await FSExtra.pathExists(filename)
        if (!exists) throw new Error(`${filename}: could not find file`)
        console.error('Starting up...')
        const total = await reconcile.length(filename)
        reconcile.run(command, filename, parameters, retries, cache, alert)
            .tap(ticker('Working...', total))
            .flatMap(x => x) // flatten
            .flatMap(csv())
            .forEach(write)
            .finally(() => console.error('Done!'))
    }
    catch (e) {
        console.error(e.message)
        Process.exit(1)
    }

}

setup()
