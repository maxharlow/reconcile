const FS = require('fs')
const Process = require('process')
const Commander = require('commander')
const Highland = require('highland')
const CSVParser = require('csv-parser')
const CSVWriter = require('csv-write-stream')

function setup() {
    const reconcilers = FS.readdirSync('.')
          .filter(f => f.startsWith('reconcile-'))
          .map(f => f.match(/reconcile-(.+).js/)[1])
    Commander
        .version(require('./package.json').version)
        .arguments('<command> [filename]')
        .option('-p, --parameters <parameters>', 'a Json object that will be passed to the reconciler')
        .action((command, input) => run(command, input, Commander.parameters))
    Commander.on('--help', () => {
        console.log('  Command must be one of the following:')
        console.log('')
        reconcilers.forEach(reconciler => console.log('    * ' + reconciler))
    })
    Commander.parse(Process.argv)
    if (Commander.args.length === 0) Commander.help()
}

function combine(fn) {
    return input => fn(input).then(output => output.map(outputRow => Object.assign({}, input, outputRow)))
}

function run(command, input, parametersData) {
    const filename = input === undefined || input === '-' ? '/dev/stdin' : input
    try {
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
