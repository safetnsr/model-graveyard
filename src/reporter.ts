import chalk from 'chalk';
import type { Match, ScanReport, MigrationReport } from './types.js';

const STATUS_ICON: Record<string, string> = {
  deprecated: '⚠',
  eol: '✖',
  active: '✔',
  unknown: '?',
};

const STATUS_COLOR: Record<string, (s: string) => string> = {
  deprecated: chalk.yellow,
  eol: chalk.red,
  active: chalk.green,
  unknown: chalk.gray,
};

function statusBadge(status: string): string {
  const icon = STATUS_ICON[status] ?? '?';
  const color = STATUS_COLOR[status] ?? chalk.gray;
  return color(`${icon} ${status}`);
}

export function printScanReport(report: ScanReport): void {
  const { summary, matches, filesScanned, rootPath, scannedAt } = report;

  console.log('');
  console.log(chalk.bold('model-graveyard scan'));
  console.log(chalk.dim(`path:    ${rootPath}`));
  console.log(chalk.dim(`scanned: ${new Date(scannedAt).toLocaleString()}`));
  console.log(chalk.dim(`files:   ${filesScanned}`));
  console.log('');

  if (matches.length === 0) {
    console.log(chalk.green('✔ no model strings found'));
    return;
  }

  // Group by file
  const byFile = new Map<string, Match[]>();
  for (const m of matches) {
    if (!byFile.has(m.file)) byFile.set(m.file, []);
    byFile.get(m.file)!.push(m);
  }

  for (const [file, fileMatches] of byFile) {
    console.log(chalk.bold.underline(file));
    for (const m of fileMatches) {
      const status = m.model?.status ?? 'unknown';
      const badge = statusBadge(status);
      const loc = chalk.dim(`${m.line}:${m.column}`);
      const raw = chalk.cyan(`"${m.raw}"`);
      let detail = '';
      if (m.model?.status === 'deprecated' || m.model?.status === 'eol') {
        const eolStr = m.model.eol ? chalk.dim(` eol: ${m.model.eol}`) : '';
        const successorStr = m.model.successor
          ? chalk.green(` → ${m.model.successor}`)
          : '';
        detail = `${eolStr}${successorStr}`;
      }
      console.log(`  ${loc}  ${badge}  ${raw}${detail}`);
      console.log(chalk.dim(`         ${m.context.slice(0, 120)}`));
    }
    console.log('');
  }

  // Summary bar
  const parts: string[] = [];
  if (summary.eol > 0) parts.push(chalk.red(`${summary.eol} eol`));
  if (summary.deprecated > 0) parts.push(chalk.yellow(`${summary.deprecated} deprecated`));
  if (summary.active > 0) parts.push(chalk.green(`${summary.active} active`));
  if (summary.unknown > 0) parts.push(chalk.gray(`${summary.unknown} unknown`));

  console.log(chalk.bold(`total: ${summary.total}`) + '  ' + parts.join('  '));
  console.log('');

  if (summary.deprecated > 0 || summary.eol > 0) {
    console.log(
      chalk.yellow('run') +
      chalk.bold(' graveyard migrate [path]') +
      chalk.yellow(' to replace deprecated models')
    );
    console.log('');
  }
}

export function printMigrationReport(report: MigrationReport): void {
  if (report.changes.length === 0) {
    console.log(chalk.green('✔ nothing to migrate'));
    return;
  }

  console.log('');
  console.log(chalk.bold('model-graveyard migrate'));
  console.log('');

  // Group by file
  const byFile = new Map<string, typeof report.changes>();
  for (const c of report.changes) {
    if (!byFile.has(c.file)) byFile.set(c.file, []);
    byFile.get(c.file)!.push(c);
  }

  for (const [file, changes] of byFile) {
    console.log(chalk.bold.underline(file));
    for (const c of changes) {
      const applied = c.applied ? chalk.green('applied') : chalk.dim('dry-run');
      console.log(
        `  line ${chalk.dim(c.line)}  ` +
        chalk.red(`- "${c.from}"`) +
        '  →  ' +
        chalk.green(`+ "${c.to}"`) +
        `  [${applied}]`
      );
    }
    console.log('');
  }

  const appliedCount = report.changes.filter(c => c.applied).length;
  if (report.applied) {
    console.log(chalk.green(`✔ applied ${appliedCount} replacement(s)`));
  } else {
    console.log(chalk.dim(`dry-run: ${report.changes.length} replacement(s) pending`));
    console.log(chalk.dim('run with --apply to write changes'));
  }
  console.log('');
}
