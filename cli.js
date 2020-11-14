import Path from 'path'
import URL from 'url'
import Readline from 'readline'
import FSExtra from 'fs-extra'
import Yargs from 'yargs'
import Process from 'process'
import Yaml from 'yaml'
import Progress from 'progress'
import reconcile from './reconcile.js'

async function parse(parameters) {
    if (!parameters) return {}
    try {
        const file = await FSExtra.readFile(parameters, 'utf8')
        return Yaml.parse(file)
    }
    catch (e) { // it's not a file, try and parse it instead
        try {
            return Yaml.parse(parameters.replace(/, ?/g, '\n').replace(/: ?/g, ': '))
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
    const listing = await FSExtra.readdir(Path.resolve(Path.dirname(URL.fileURLToPath(import.meta.url)), 'reconcilers'))
    const reconcilers = listing
        .map(file => file.match(/(.+).js/)[1])
    const instructions = Yargs(Process.argv)
        .usage('Usage: reconcile <command> <filename>')
        .wrap(null)
        .completion('completion', false, () => reconcilers)
        .option('p', { alias: 'parameters', type: 'string', describe: 'Parameters to be passed to the reconciler, either in Json or Yaml' })
        .option('r', { alias: 'retries', type: 'number', nargs: 1, describe: 'Number of times a request should be retried', default: 5 })
        .option('c', { alias: 'cache', type: 'boolean', describe: 'Whether to cache HTTP requests', default: false })
        .option('j', { alias: 'join', type: 'string', describe: 'Whether to include unmatched rows (outer) or not (inner)', choices: ['outer', 'inner'], default: 'inner' })
        .option('V', { alias: 'verbose', type: 'boolean', describe: 'Print every request made', default: false })
        .help('?').alias('?', 'help')
        .version().alias('v', 'version')
    await Promise.all(reconcilers.map(async command => {
        const reconciler = await import(`./reconcilers/${command}.js`)
        const commandArgs = args => args
            .usage(`Usage: reconcile ${command} <filename>`)
            .demand(1, '')
            .positional('filename', { type: 'string', describe: 'The input file to process' })
            .epilog(display(reconciler.details))
        instructions.command(command, '', commandArgs)
    }))
    if (instructions.argv['get-yargs-completions']) Process.exit(0)
    if (instructions.argv._.length === 2) instructions.showHelp().exit(0)
    try {
        const {
            _: [,, command, filename],
            parameters,
            retries,
            cache,
            join,
            verbose
        } = instructions.argv
        const parametersParsed = await parse(parameters)
        if (!reconcilers.includes(command)) throw new Error(`${command}: reconciler not found`)
        if (filename === '-') throw new Error('reading from standard input not supported')
        const exists = await FSExtra.pathExists(filename)
        if (!exists) throw new Error(`${filename}: could not find file`)
        console.error('Starting up...')
        const reconcillation = await reconcile(command, filename, parametersParsed, retries, cache, join, verbose, alert)
        const total = await reconcillation.length()
        const processing = await reconcillation.run()
        await processing
            .each(ticker('Working...', total))
            .flatten()
            .CSVStringify()
            .each(write)
            .whenEnd()
        console.error('Done!')
    }
    catch (e) {
        console.error(e.message)
        Process.exit(1)
    }

}

setup()
