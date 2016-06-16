const FS = require('fs')
const Process = require('process')
const Yargs = require('yargs')
const Highland = require('highland')
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
        .option('p', { alias: 'parameters', type: 'string', describe: 'Json configuration object to be passed to the reconciler' })
        .help('?').alias('?', 'help')
        .version().alias('v', 'version')
    reconcilers.forEach(reconciler => interface.command(reconciler))
    if (interface.argv['get-yargs-completions']) Process.exit(0)
    else run(interface.argv._[0], interface.argv._[1], interface.argv.parameters)
}

function combine(fn) {
    return input => fn(input).then(output => output.map(outputRow => Object.assign({}, input, outputRow)))
}

function run(command, input, parametersData) {
    const filename = input === undefined || input === '-' ? '/dev/stdin' : input
    try {
        if (Process.stdin.isTTY === true && filename === '/dev/stdin') throw new Error('Error: no input')
        const parameters = parametersData ? JSON.parse(parametersData) : {}
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
