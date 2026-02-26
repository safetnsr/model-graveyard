import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import type { Registry, ModelEntry } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _registry: Registry | null = null;

function loadRegistry(): Registry {
  if (_registry) return _registry;

  // Look for registry.yaml relative to this file (dist/registry.ts → ../registry.yaml)
  // or from project root
  const candidates = [
    join(__dirname, '..', 'registry.yaml'),
    join(__dirname, 'registry.yaml'),
    join(process.cwd(), 'registry.yaml'),
  ];

  for (const candidate of candidates) {
    try {
      const raw = readFileSync(candidate, 'utf8');
      _registry = yaml.load(raw) as Registry;
      return _registry;
    } catch {
      // try next
    }
  }

  throw new Error('registry.yaml not found. reinstall @safetnsr/model-graveyard.');
}

export function getRegistry(): Registry {
  return loadRegistry();
}

/** Build a flat lookup map: every id + alias → ModelEntry */
function buildLookup(): Map<string, ModelEntry> {
  const registry = loadRegistry();
  const map = new Map<string, ModelEntry>();

  for (const model of registry.models) {
    map.set(model.id.toLowerCase(), model);
    for (const alias of model.aliases ?? []) {
      map.set(alias.toLowerCase(), model);
    }
  }
  return map;
}

let _lookup: Map<string, ModelEntry> | null = null;

function getLookup(): Map<string, ModelEntry> {
  if (!_lookup) _lookup = buildLookup();
  return _lookup;
}

export function resolveModel(raw: string): ModelEntry | null {
  const lookup = getLookup();
  const key = raw.toLowerCase().trim();

  // Exact match
  if (lookup.has(key)) return lookup.get(key)!;

  // Strip date suffix: gpt-4-0613 already handled via aliases
  // Try prefix match for versioned strings like claude-opus-4-20250514
  const dateSuffixRe = /-\d{8}$/;
  if (dateSuffixRe.test(key)) {
    const stripped = key.replace(dateSuffixRe, '');
    if (lookup.has(stripped)) return lookup.get(stripped)!;
  }

  return null;
}

export function isKnownModelString(raw: string): boolean {
  return resolveModel(raw) !== null;
}
