import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { scan } from './scanner.js';
import type { MigrationReport, MigrationChange, ScanReport } from './types.js';

function applyToFile(
  filePath: string,
  changes: MigrationChange[],
  apply: boolean
): MigrationChange[] {
  if (changes.length === 0) return [];

  let content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  for (const change of changes) {
    const lineIdx = change.line - 1;
    if (lines[lineIdx] === undefined) continue;

    // Replace the first occurrence of the from-model string on that line
    // Use a regex that matches quoted occurrences
    const escapedFrom = change.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lineRe = new RegExp(`(['"\`])${escapedFrom}\\1`);
    const newLine = lines[lineIdx].replace(lineRe, (_, q) => `${q}${change.to}${q}`);

    if (newLine !== lines[lineIdx]) {
      lines[lineIdx] = newLine;
      change.applied = apply;
    }
  }

  if (apply) {
    writeFileSync(filePath, lines.join('\n'), 'utf8');
  } else {
    // Generate unified diff output (printed to stdout by caller)
    generateDiff(filePath, content, lines.join('\n'));
  }

  return changes;
}

function generateDiff(file: string, original: string, modified: string): void {
  const origLines = original.split('\n');
  const modLines = modified.split('\n');

  const diffLines: string[] = [`--- a/${file}`, `+++ b/${file}`];
  for (let i = 0; i < Math.max(origLines.length, modLines.length); i++) {
    if (origLines[i] !== modLines[i]) {
      diffLines.push(`@@ -${i + 1} +${i + 1} @@`);
      if (origLines[i] !== undefined) diffLines.push(`-${origLines[i]}`);
      if (modLines[i] !== undefined) diffLines.push(`+${modLines[i]}`);
    }
  }

  if (diffLines.length > 2) {
    console.log(diffLines.join('\n'));
  }
}

export async function migrate(
  rootPath: string,
  opts: { apply?: boolean; json?: boolean } = {}
): Promise<MigrationReport> {
  const absRoot = resolve(rootPath);
  const report: ScanReport = await scan(absRoot);

  const changes: MigrationChange[] = [];

  // Build changes from deprecated/eol matches that have a successor
  for (const match of report.matches) {
    if (!match.model) continue;
    if (match.model.status === 'active') continue;
    if (!match.model.successor) continue;

    const absFile = resolve(absRoot, match.file);

    changes.push({
      file: match.file,
      line: match.line,
      from: match.raw,
      to: match.model.successor,
      applied: false,
    });

    // Apply to file (mutates change.applied flag)
    applyToFile(absFile, [changes[changes.length - 1]], opts.apply ?? false);
  }

  return {
    changes,
    applied: opts.apply ?? false,
  };
}
