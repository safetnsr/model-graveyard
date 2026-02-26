#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/registry.ts
var registry_exports = {};
__export(registry_exports, {
  getRegistry: () => getRegistry,
  isKnownModelString: () => isKnownModelString,
  resolveModel: () => resolveModel
});
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
function loadRegistry() {
  if (_registry) return _registry;
  const candidates = [
    join(__dirname, "..", "registry.yaml"),
    join(__dirname, "registry.yaml"),
    join(process.cwd(), "registry.yaml")
  ];
  for (const candidate of candidates) {
    try {
      const raw = readFileSync(candidate, "utf8");
      _registry = yaml.load(raw);
      return _registry;
    } catch {
    }
  }
  throw new Error("registry.yaml not found. reinstall @safetnsr/model-graveyard.");
}
function getRegistry() {
  return loadRegistry();
}
function buildLookup() {
  const registry = loadRegistry();
  const map = /* @__PURE__ */ new Map();
  for (const model of registry.models) {
    map.set(model.id.toLowerCase(), model);
    for (const alias of model.aliases ?? []) {
      map.set(alias.toLowerCase(), model);
    }
  }
  return map;
}
function getLookup() {
  if (!_lookup) _lookup = buildLookup();
  return _lookup;
}
function resolveModel(raw) {
  const lookup = getLookup();
  const key = raw.toLowerCase().trim();
  if (lookup.has(key)) return lookup.get(key);
  const dateSuffixRe = /-\d{8}$/;
  if (dateSuffixRe.test(key)) {
    const stripped = key.replace(dateSuffixRe, "");
    if (lookup.has(stripped)) return lookup.get(stripped);
  }
  return null;
}
function isKnownModelString(raw) {
  return resolveModel(raw) !== null;
}
var __dirname, _registry, _lookup;
var init_registry = __esm({
  "src/registry.ts"() {
    "use strict";
    __dirname = dirname(fileURLToPath(import.meta.url));
    _registry = null;
    _lookup = null;
  }
});

// src/scanner.ts
init_registry();
import { readFileSync as readFileSync2 } from "fs";
import { glob } from "glob";
import { resolve } from "path";
var INCLUDE_EXTENSIONS = [
  "**/*.ts",
  "**/*.tsx",
  "**/*.js",
  "**/*.jsx",
  "**/*.mjs",
  "**/*.cjs",
  "**/*.py",
  "**/*.go",
  "**/*.yaml",
  "**/*.yml",
  "**/*.json",
  "**/*.toml",
  "**/*.env",
  "**/.env",
  "**/.env.*"
];
var EXCLUDE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/*.min.js",
  "**/*.lock"
];
var SCAN_PATTERNS = [
  // keyword arg with quotes: model="claude-opus-3" or model='gpt-4' or model: "gpt-4"
  /\bmodel\s*[=:]\s*["'](?<model>[a-zA-Z0-9._/:-]+)["']/g,
  // model_name= or model_id= with quotes
  /\bmodel_(?:name|id)\s*[=:]\s*["'](?<model>[a-zA-Z0-9._/:-]+)["']/g,
  // YAML/config bare value: model: gpt-3.5-turbo (no quotes, must start with known prefix)
  /\bmodel(?:_name|_id)?\s*:\s*(?<model>(?:claude|gpt|gemini|o\d|text-davinci|mistral|llama)[a-zA-Z0-9._/:-]+)/g,
  // env: MODEL=claude-opus-3 (no quotes)
  /^MODEL(?:_NAME|_ID)?\s*=\s*(?<model>[a-zA-Z0-9._/:-]+)\s*$/gm,
  // standalone string literals containing known provider prefixes
  /["'](?<model>(?:claude|gpt|gemini|o\d|text-davinci|text-curie|text-babbage|text-ada)[a-zA-Z0-9._/:-]*)["']/g
];
function dedup(matches) {
  const seen = /* @__PURE__ */ new Set();
  return matches.filter((m) => {
    const key = `${m.file}:${m.line}:${m.raw}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function scanFile(filePath, rootPath) {
  let content;
  try {
    content = readFileSync2(filePath, "utf8");
  } catch {
    return [];
  }
  const lines = content.split("\n");
  const matches = [];
  const relPath = filePath.startsWith(rootPath) ? filePath.slice(rootPath.length).replace(/^\//, "") : filePath;
  for (const pattern of SCAN_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const raw = match.groups?.model;
      if (!raw) continue;
      const before = content.slice(0, match.index);
      const lineIndex = before.split("\n").length - 1;
      const lineText = lines[lineIndex] ?? "";
      const column = match.index - before.lastIndexOf("\n") - 1;
      const resolved = resolveModel(raw);
      const isGenericPattern = pattern === SCAN_PATTERNS[SCAN_PATTERNS.length - 1];
      if (isGenericPattern && !resolved) continue;
      matches.push({
        file: relPath,
        line: lineIndex + 1,
        column,
        raw,
        context: lineText.trim(),
        model: resolved
      });
    }
  }
  return dedup(matches);
}
async function scan(rootPath) {
  const absRoot = resolve(rootPath);
  const scannedAt = (/* @__PURE__ */ new Date()).toISOString();
  const files = await glob(INCLUDE_EXTENSIONS, {
    cwd: absRoot,
    absolute: true,
    ignore: EXCLUDE,
    dot: true
  });
  const allMatches = [];
  for (const file of files) {
    const fileMatches = scanFile(file, absRoot);
    allMatches.push(...fileMatches);
  }
  const sorted = allMatches.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line
  );
  const summary = {
    total: sorted.length,
    deprecated: sorted.filter((m) => m.model?.status === "deprecated").length,
    eol: sorted.filter((m) => m.model?.status === "eol").length,
    active: sorted.filter((m) => m.model?.status === "active").length,
    unknown: sorted.filter((m) => !m.model).length
  };
  return {
    scannedAt,
    rootPath: absRoot,
    filesScanned: files.length,
    matches: sorted,
    summary
  };
}

// src/migrator.ts
import { readFileSync as readFileSync3, writeFileSync } from "fs";
import { resolve as resolve2 } from "path";
function applyToFile(filePath, changes, apply) {
  if (changes.length === 0) return [];
  let content = readFileSync3(filePath, "utf8");
  const lines = content.split("\n");
  for (const change of changes) {
    const lineIdx = change.line - 1;
    if (lines[lineIdx] === void 0) continue;
    const escapedFrom = change.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const lineRe = new RegExp(`(['"\`])${escapedFrom}\\1`);
    const newLine = lines[lineIdx].replace(lineRe, (_, q) => `${q}${change.to}${q}`);
    if (newLine !== lines[lineIdx]) {
      lines[lineIdx] = newLine;
      change.applied = apply;
    }
  }
  if (apply) {
    writeFileSync(filePath, lines.join("\n"), "utf8");
  } else {
    generateDiff(filePath, content, lines.join("\n"));
  }
  return changes;
}
function generateDiff(file, original, modified) {
  const origLines = original.split("\n");
  const modLines = modified.split("\n");
  const diffLines = [`--- a/${file}`, `+++ b/${file}`];
  for (let i = 0; i < Math.max(origLines.length, modLines.length); i++) {
    if (origLines[i] !== modLines[i]) {
      diffLines.push(`@@ -${i + 1} +${i + 1} @@`);
      if (origLines[i] !== void 0) diffLines.push(`-${origLines[i]}`);
      if (modLines[i] !== void 0) diffLines.push(`+${modLines[i]}`);
    }
  }
  if (diffLines.length > 2) {
    console.log(diffLines.join("\n"));
  }
}
async function migrate(rootPath, opts = {}) {
  const absRoot = resolve2(rootPath);
  const report = await scan(absRoot);
  const changes = [];
  for (const match of report.matches) {
    if (!match.model) continue;
    if (match.model.status === "active") continue;
    if (!match.model.successor) continue;
    const absFile = resolve2(absRoot, match.file);
    changes.push({
      file: match.file,
      line: match.line,
      from: match.raw,
      to: match.model.successor,
      applied: false
    });
    applyToFile(absFile, [changes[changes.length - 1]], opts.apply ?? false);
  }
  return {
    changes,
    applied: opts.apply ?? false
  };
}

// src/reporter.ts
import chalk from "chalk";
var STATUS_ICON = {
  deprecated: "\u26A0",
  eol: "\u2716",
  active: "\u2714",
  unknown: "?"
};
var STATUS_COLOR = {
  deprecated: chalk.yellow,
  eol: chalk.red,
  active: chalk.green,
  unknown: chalk.gray
};
function statusBadge(status) {
  const icon = STATUS_ICON[status] ?? "?";
  const color = STATUS_COLOR[status] ?? chalk.gray;
  return color(`${icon} ${status}`);
}
function printScanReport(report) {
  const { summary, matches, filesScanned, rootPath, scannedAt } = report;
  console.log("");
  console.log(chalk.bold("model-graveyard scan"));
  console.log(chalk.dim(`path:    ${rootPath}`));
  console.log(chalk.dim(`scanned: ${new Date(scannedAt).toLocaleString()}`));
  console.log(chalk.dim(`files:   ${filesScanned}`));
  console.log("");
  if (matches.length === 0) {
    console.log(chalk.green("\u2714 no model strings found"));
    return;
  }
  const byFile = /* @__PURE__ */ new Map();
  for (const m of matches) {
    if (!byFile.has(m.file)) byFile.set(m.file, []);
    byFile.get(m.file).push(m);
  }
  for (const [file, fileMatches] of byFile) {
    console.log(chalk.bold.underline(file));
    for (const m of fileMatches) {
      const status = m.model?.status ?? "unknown";
      const badge = statusBadge(status);
      const loc = chalk.dim(`${m.line}:${m.column}`);
      const raw = chalk.cyan(`"${m.raw}"`);
      let detail = "";
      if (m.model?.status === "deprecated" || m.model?.status === "eol") {
        const eolStr = m.model.eol ? chalk.dim(` eol: ${m.model.eol}`) : "";
        const successorStr = m.model.successor ? chalk.green(` \u2192 ${m.model.successor}`) : "";
        detail = `${eolStr}${successorStr}`;
      }
      console.log(`  ${loc}  ${badge}  ${raw}${detail}`);
      console.log(chalk.dim(`         ${m.context.slice(0, 120)}`));
    }
    console.log("");
  }
  const parts = [];
  if (summary.eol > 0) parts.push(chalk.red(`${summary.eol} eol`));
  if (summary.deprecated > 0) parts.push(chalk.yellow(`${summary.deprecated} deprecated`));
  if (summary.active > 0) parts.push(chalk.green(`${summary.active} active`));
  if (summary.unknown > 0) parts.push(chalk.gray(`${summary.unknown} unknown`));
  console.log(chalk.bold(`total: ${summary.total}`) + "  " + parts.join("  "));
  console.log("");
  if (summary.deprecated > 0 || summary.eol > 0) {
    console.log(
      chalk.yellow("run") + chalk.bold(" graveyard migrate [path]") + chalk.yellow(" to replace deprecated models")
    );
    console.log("");
  }
}
function printMigrationReport(report) {
  if (report.changes.length === 0) {
    console.log(chalk.green("\u2714 nothing to migrate"));
    return;
  }
  console.log("");
  console.log(chalk.bold("model-graveyard migrate"));
  console.log("");
  const byFile = /* @__PURE__ */ new Map();
  for (const c of report.changes) {
    if (!byFile.has(c.file)) byFile.set(c.file, []);
    byFile.get(c.file).push(c);
  }
  for (const [file, changes] of byFile) {
    console.log(chalk.bold.underline(file));
    for (const c of changes) {
      const applied = c.applied ? chalk.green("applied") : chalk.dim("dry-run");
      console.log(
        `  line ${chalk.dim(c.line)}  ` + chalk.red(`- "${c.from}"`) + "  \u2192  " + chalk.green(`+ "${c.to}"`) + `  [${applied}]`
      );
    }
    console.log("");
  }
  const appliedCount = report.changes.filter((c) => c.applied).length;
  if (report.applied) {
    console.log(chalk.green(`\u2714 applied ${appliedCount} replacement(s)`));
  } else {
    console.log(chalk.dim(`dry-run: ${report.changes.length} replacement(s) pending`));
    console.log(chalk.dim("run with --apply to write changes"));
  }
  console.log("");
}

// src/cli.ts
import { writeFileSync as writeFileSync2 } from "fs";
var [, , command, ...args] = process.argv;
function parseArgs(args2) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args2.length; i++) {
    const arg = args2[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args2[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { path: positional[0] ?? ".", flags };
}
function showHelp() {
  console.log(`
model-graveyard \u2014 find deprecated AI models in your codebase

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
async function cmdScan(rawArgs) {
  const { path, flags } = parseArgs(rawArgs);
  const report = await scan(path);
  if (flags["json"] || flags["output"]) {
    const json = JSON.stringify(report, null, 2);
    if (flags["output"] && typeof flags["output"] === "string") {
      writeFileSync2(flags["output"], json, "utf8");
      console.log(`report written to ${flags["output"]}`);
    } else {
      console.log(json);
    }
    return;
  }
  printScanReport(report);
  const hasIssues = report.summary.deprecated > 0 || report.summary.eol > 0;
  if (hasIssues) process.exit(1);
}
async function cmdMigrate(rawArgs) {
  const { path, flags } = parseArgs(rawArgs);
  const apply = Boolean(flags["apply"]);
  const report = await migrate(path, { apply });
  if (flags["json"]) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  printMigrationReport(report);
}
async function cmdList() {
  const { getRegistry: getRegistry2 } = await Promise.resolve().then(() => (init_registry(), registry_exports));
  const registry = getRegistry2();
  const byStatus = { active: [], deprecated: [], eol: [] };
  for (const model of registry.models) {
    (byStatus[model.status] ??= []).push(model);
  }
  const chalk2 = (await import("chalk")).default;
  for (const [status, models] of Object.entries(byStatus)) {
    if (models.length === 0) continue;
    const label = status === "active" ? chalk2.green(status) : status === "deprecated" ? chalk2.yellow(status) : chalk2.red(status);
    console.log(`
${chalk2.bold(label)} (${models.length})`);
    for (const m of models) {
      const eol = m.eol ? chalk2.dim(` eol: ${m.eol}`) : "";
      const succ = m.successor ? chalk2.green(` \u2192 ${m.successor}`) : "";
      console.log(`  ${chalk2.cyan(m.id)}  [${m.provider}]${eol}${succ}`);
    }
  }
  console.log("");
}
async function main() {
  switch (command) {
    case "scan":
      await cmdScan(args);
      break;
    case "migrate":
      await cmdMigrate(args);
      break;
    case "list":
      await cmdList();
      break;
    case "help":
    case "--help":
    case "-h":
    case void 0:
      showHelp();
      break;
    default:
      console.error(`unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}
main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
