import Path from 'path'
import URL from 'url'
import FSExtra from 'fs-extra'
import Yargs from 'yargs'
import Process from 'process'
import Yaml from 'yaml'
import reconcile from './reconcile.js'
import cliRenderer from './cli-renderer.js'

async function parse(parameters) {
    if (!parameters) return {}
    try {
        const file = await FSExtra.readFile(parameters, 'utf8')
        return Yaml.parse(file)
    }
    catch (e) { // it's not a file, try and parse it instead
        try {
            return Yaml.parse(parameters.replace(/; ?/g, '\n'))
        }
        catch (e) {
            throw new Error('could not parse parameters')
        }
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
    const detailsParameters = details.parameters.map(item => {
        const restrictions = `${item.required ? '' : '[optional]'}${item.choices ? ' [choices: ' + item.choices + ']' : ''}${item.defaults ? ' [default: ' + item.defaults + ']' : ''}`
        return {
            name: item.name,
            description: `${item.description || ''}${restrictions ? '  ' + restrictions : ''}`
        }
    })
    return `Parameters:\n${align(detailsParameters)}\n\nColumns:\n${align(details.columns)}`
}

async function setup() {
    const listing = await FSExtra.readdir(Path.resolve(Path.dirname(URL.fileURLToPath(import.meta.url)), 'reconcilers'))
    const reconcilers = listing.map(file => file.match(/(.+).js/)[1]).sort()
    const instructions = Yargs(Process.argv.slice(2))
        .usage('Usage: reconcile <command> <filename>')
        .wrap(null)
        .completion('completion', false)
        .option('p', { alias: 'parameters', type: 'string', describe: 'Parameters to be passed to the reconciler, either in Json or Yaml' })
        .option('r', { alias: 'retries', type: 'number', nargs: 1, describe: 'Number of times a request should be retried', default: 5 })
        .option('c', { alias: 'cache', type: 'boolean', describe: 'Whether to cache HTTP requests', default: false })
        .option('j', { alias: 'join', type: 'string', describe: 'Whether to include unmatched rows (outer) or not (inner)', choices: ['outer', 'inner'], default: 'inner' })
        .option('V', { alias: 'verbose', type: 'boolean', describe: 'Print every request made', default: false })
        .help('?').alias('?', 'help')
        .version().alias('v', 'version')
    await reconcilers.reduce(async (previous, command) => {
        await previous
        const { default: reconciler } = await import(`./reconcilers/${command}.js`)
        const commandArgs = args => args
            .usage(`Usage: reconcile ${command} <filename>`)
            .demandCommand(1, '')
            .positional('filename', { type: 'string', describe: 'The input file to process' })
            .epilog(display(reconciler.details))
        return instructions.command(command, '', commandArgs)
    }, Promise.resolve())
    if (instructions.argv['get-yargs-completions']) Process.exit(0)
    if (instructions.argv._.length === 0) instructions.showHelp().exit(0)
    const { alert, progress, finalise } = cliRenderer(instructions.argv.verbose)
    try {
        const {
            _: [command, filename],
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
        alert({
            message: 'Starting up...',
            importance: 'info'
        })
        const reconcillation = await reconcile(command, filename, parametersParsed, retries, cache, join, verbose, alert)
        const total = await reconcillation.length()
        const processing = await reconcillation.run()
        await processing
            .catch(async e => {
                alert({
                    message: instructions.argv.verbose ? e.stack : `Fatal error: ${e.message}`,
                    importance: 'error'
                })
                await finalise('error')
            })
            .each(progress('Working...', total))
            .flatten()
            .CSVStringify()
            .each(write)
            .whenEnd()
        await finalise('complete')
    }
    catch (e) {
        alert({
            message: instructions.argv.verbose ? e.stack : e.message,
            importance: 'error'
        })
        await finalise('error')
        Process.exit(1)
    }

}

setup()
