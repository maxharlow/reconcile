const FS = require('fs')
const Process = require('process')
const Commander = require('commander')
const Highland = require('highland')
const CSVParser = require('csv-parser')
const CSVWriter = require('csv-write-stream')

function setup() {
    Commander
        .arguments('<command> [filename]')
        .action(run)
        .parse(Process.argv)
    if (Commander.args.length === 0) Commander.help()
}

function run(command, input) {
    const filename = input === undefined || input === '-' ? '/dev/stdin' : input
    try {
        const reconciler = require('./reconcile-' + command)
        Highland(Highland.wrapCallback(FS.readFile)(filename))
            .through(CSVParser())
            .through(reconciler)
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
