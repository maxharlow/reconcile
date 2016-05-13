const FS = require('fs')
const Stream = require('stream')
const Process = require('process')
const Commander = require('commander')
const Highland = require('highland')
const CSVParser = require('csv-parser')
const CSVWriter = require('csv-write-stream')

function run(command, filename) {
    const reconciler = require('./reconcile-' + command)
    Highland(Highland.wrapCallback(FS.readFile)(filename))
        .through(CSVParser())
        .through(new reconciler)
        .errors(e => console.error(e.stack))
        .through(CSVWriter())
        .pipe(Process.stdout)
}

Commander
    .arguments('<command> <filename>')
    .action(run)
    .parse(Process.argv)
