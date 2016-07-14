const FS = require('fs')
const Process = require('process')
const Yargs = require('yargs')
const Highland = require('highland')
const Yaml = require('js-yaml')
const CSVParser = require('csv-parser')
const CSVWriter = require('csv-write-stream')

function setup() {
    const reconcilers = FS.readdirSync(__dirname)
        .filter(f => f.startsWith('reconcile-'))
        .map(f => f.match(/reconcile-(.+).js/)[1])
    const interface = Yargs
        .usage('Usage: reconcile <command> [filename]')
        .wrap(null)
        .demand(1, '')
        .completion('completion', false, () => reconcilers)
        .option('p', { alias: 'parameters', type: 'string', describe: 'Parameters to be passed to the reconciler, either in Json or Yaml' })
        .help('?').alias('?', 'help')
        .version().alias('v', 'version')
    reconcilers.forEach(reconciler => interface.command(reconciler))
    if (interface.argv['get-yargs-completions']) Process.exit(0)
    else run(interface.argv._[0], interface.argv._[1], parse(interface.argv.parameters))
}

function parse(input) {
    if (!input) return {}
    try {
        const file = FS.readFileSync(input, 'utf8')
        const data = Yaml.load(file)
        return data
    }
    catch (e) { // it's not a file, try and parse it instead
        try {
            const data = Yaml.load(input)
            return data
        }
        catch (e) {
            console.error(e.message)
            Process.exit(1)
        }
    }
}

function combine(fn) {
    return input => fn(input).then(output => output.map(outputRow => Object.assign({}, input, outputRow)))
}

function run(command, input, parameters) {
    const filename = input === undefined || input === '-' ? '/dev/stdin' : input
    try {
        if (Process.stdin.isTTY === true && filename === '/dev/stdin') throw new Error('Error: no input')
        const reconciler = require('./reconcile-' + command)(parameters)
        const reconcilerCombined = item => Highland(combine(reconciler)(item))
        Highland(Highland.wrapCallback(FS.readFile)(filename))
            .through(CSVParser())
            .flatMap(reconcilerCombined)
            .flatten()
            .errors(e => console.error(e.message))
            .through(CSVWriter())
            .pipe(Process.stdout)
    }
    catch (e) {
        console.error(e.message)
        Process.exit(1)
    }
}

setup()
