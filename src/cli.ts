#!/usr/bin/env node
import { scan } from './scanner.js';
import { migrate } from './migrator.js';
import { printScanReport, printMigrationReport } from './reporter.js';
import { writeFileSync, readFileSync } from 'fs';

const [,, command, ...args] = process.argv;

function parseArgs(args: string[]): { path: string; flags: Record<string, boolean | string> } {
  const flags: Record<string, boolean | string> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { path: positional[0] ?? '.', flags };
}

function showHelp(): void {
  console.log(`
model-graveyard — find deprecated AI models in your codebase

usage:
  graveyard scan [path]          scan for hardcoded model strings
  graveyard migrate [path]       replace deprecated models with successors
  graveyard list                 list all models in the registry
  graveyard help                 show this help

options (scan):
  --json                         output JSON report
  --output <file>                write JSON report to file

options (migrate):
  --apply                        write changes to disk (default: dry-run)
  --json                         output JSON report

examples:
  graveyard scan .
  graveyard scan ./src --json
  graveyard migrate . --apply
`);
}

async function cmdScan(rawArgs: string[]): Promise<void> {
  const { path, flags } = parseArgs(rawArgs);

  const report = await scan(path);

  if (flags['json'] || flags['output']) {
    const json = JSON.stringify(report, null, 2);
    if (flags['output'] && typeof flags['output'] === 'string') {
      writeFileSync(flags['output'], json, 'utf8');
      console.log(`report written to ${flags['output']}`);
    } else {
      console.log(json);
    }
    return;
  }

  printScanReport(report);

  // Exit with non-zero if deprecated/eol models found
  const hasIssues = report.summary.deprecated > 0 || report.summary.eol > 0;
  if (hasIssues) process.exit(1);
}

async function cmdMigrate(rawArgs: string[]): Promise<void> {
  const { path, flags } = parseArgs(rawArgs);
  const apply = Boolean(flags['apply']);

  const report = await migrate(path, { apply });

  if (flags['json']) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printMigrationReport(report);
}

async function cmdList(): Promise<void> {
  const { getRegistry } = await import('./registry.js');
  const registry = getRegistry();

  const byStatus: Record<string, typeof registry.models> = { active: [], deprecated: [], eol: [] };
  for (const model of registry.models) {
    (byStatus[model.status] ??= []).push(model);
  }

  const chalk = (await import('chalk')).default;

  for (const [status, models] of Object.entries(byStatus)) {
    if (models.length === 0) continue;
    const label =
      status === 'active' ? chalk.green(status) :
      status === 'deprecated' ? chalk.yellow(status) :
      chalk.red(status);

    console.log(`\n${chalk.bold(label)} (${models.length})`);
    for (const m of models) {
      const eol = m.eol ? chalk.dim(` eol: ${m.eol}`) : '';
      const succ = m.successor ? chalk.green(` → ${m.successor}`) : '';
      console.log(`  ${chalk.cyan(m.id)}  [${m.provider}]${eol}${succ}`);
    }
  }
  console.log('');
}

async function main(): Promise<void> {
  switch (command) {
    case 'scan':
      await cmdScan(args);
      break;
    case 'migrate':
      await cmdMigrate(args);
      break;
    case 'list':
      await cmdList();
      break;
    case '--version':
    case '-v': {
      const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
      console.log(pkg.version);
      break;
    }
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      showHelp();
      break;
    default:
      console.error(`unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main().catch(err => {
  console.error(err.message ?? err);
  process.exit(1);
});
