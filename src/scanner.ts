import { readFileSync } from 'fs';
import { glob } from 'glob';
import { resolve } from 'path';
import { resolveModel } from './registry.js';
import type { Match, ScanReport } from './types.js';

// File extensions to scan
const INCLUDE_EXTENSIONS = [
  '**/*.ts', '**/*.tsx',
  '**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs',
  '**/*.py',
  '**/*.go',
  '**/*.yaml', '**/*.yml',
  '**/*.json',
  '**/*.toml',
  '**/*.env',
  '**/.env',
  '**/.env.*',
];

const EXCLUDE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/*.min.js',
  '**/*.lock',
];

/**
 * Patterns that capture model name strings from source code.
 * Each pattern must have a named capture group `model`.
 */
const SCAN_PATTERNS: RegExp[] = [
  // keyword arg with quotes: model="claude-opus-3" or model='gpt-4' or model: "gpt-4"
  /\bmodel\s*[=:]\s*["'](?<model>[a-zA-Z0-9._/:-]+)["']/g,
  // model_name= or model_id= with quotes
  /\bmodel_(?:name|id)\s*[=:]\s*["'](?<model>[a-zA-Z0-9._/:-]+)["']/g,
  // YAML/config bare value: model: gpt-3.5-turbo (no quotes, must start with known prefix)
  /\bmodel(?:_name|_id)?\s*:\s*(?<model>(?:claude|gpt|gemini|o\d|text-davinci|mistral|llama)[a-zA-Z0-9._/:-]+)/g,
  // env: MODEL=claude-opus-3 (no quotes)
  /^MODEL(?:_NAME|_ID)?\s*=\s*(?<model>[a-zA-Z0-9._/:-]+)\s*$/gm,
  // standalone string literals containing known provider prefixes
  /["'](?<model>(?:claude|gpt|gemini|o\d|text-davinci|text-curie|text-babbage|text-ada)[a-zA-Z0-9._/:-]*)["']/g,
];

/** Deduplicate matches by file+line+raw to avoid pattern overlap */
function dedup(matches: Match[]): Match[] {
  const seen = new Set<string>();
  return matches.filter(m => {
    const key = `${m.file}:${m.line}:${m.raw}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scanFile(filePath: string, rootPath: string): Match[] {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const lines = content.split('\n');
  const matches: Match[] = [];
  const relPath = filePath.startsWith(rootPath)
    ? filePath.slice(rootPath.length).replace(/^\//, '')
    : filePath;

  for (const pattern of SCAN_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const raw = match.groups?.model;
      if (!raw) continue;

      // Compute line number from match index
      const before = content.slice(0, match.index);
      const lineIndex = before.split('\n').length - 1;
      const lineText = lines[lineIndex] ?? '';
      const column = match.index - before.lastIndexOf('\n') - 1;

      // Only report if we know this model (or it looks like a model string via prefix patterns)
      const resolved = resolveModel(raw);

      // For the generic string pattern (last one), skip if not in registry
      // to avoid noise from arbitrary strings like "claude-from-movie"
      const isGenericPattern = pattern === SCAN_PATTERNS[SCAN_PATTERNS.length - 1];
      if (isGenericPattern && !resolved) continue;

      matches.push({
        file: relPath,
        line: lineIndex + 1,
        column,
        raw,
        context: lineText.trim(),
        model: resolved,
      });
    }
  }

  return dedup(matches);
}

export async function scan(rootPath: string): Promise<ScanReport> {
  const absRoot = resolve(rootPath);
  const scannedAt = new Date().toISOString();

  const files = await glob(INCLUDE_EXTENSIONS, {
    cwd: absRoot,
    absolute: true,
    ignore: EXCLUDE,
    dot: true,
  });

  const allMatches: Match[] = [];
  for (const file of files) {
    const fileMatches = scanFile(file, absRoot);
    allMatches.push(...fileMatches);
  }

  const sorted = allMatches.sort((a, b) =>
    a.file.localeCompare(b.file) || a.line - b.line
  );

  const summary = {
    total: sorted.length,
    deprecated: sorted.filter(m => m.model?.status === 'deprecated').length,
    eol: sorted.filter(m => m.model?.status === 'eol').length,
    active: sorted.filter(m => m.model?.status === 'active').length,
    unknown: sorted.filter(m => !m.model).length,
  };

  return {
    scannedAt,
    rootPath: absRoot,
    filesScanned: files.length,
    matches: sorted,
    summary,
  };
}
