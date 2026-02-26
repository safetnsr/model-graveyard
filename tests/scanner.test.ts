import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { scan } from '../src/scanner.ts';

const TMP = join(tmpdir(), `graveyard-test-${Date.now()}`);

before(() => {
  mkdirSync(TMP, { recursive: true });

  // JS file with deprecated model
  writeFileSync(join(TMP, 'client.js'), `
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "hello" }],
});
`);

  // Python file with deprecated model
  writeFileSync(join(TMP, 'main.py'), `
import anthropic
client = anthropic.Anthropic()
message = client.messages.create(
    model="claude-3-opus-20240229",
    max_tokens=1024,
)
`);

  // TypeScript with active model
  writeFileSync(join(TMP, 'service.ts'), `
const MODEL = 'gpt-4o-mini';
const client = new OpenAI();
`);

  // YAML config
  writeFileSync(join(TMP, 'config.yaml'), `
model: gpt-3.5-turbo
temperature: 0.7
`);

  // .env file
  writeFileSync(join(TMP, '.env'), `
API_KEY=sk-abc
MODEL=claude-instant-1
`);

  // File with no models
  writeFileSync(join(TMP, 'utils.ts'), `
export function add(a: number, b: number) { return a + b; }
`);
});

after(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('scanner', () => {
  it('scans directory and finds matches', async () => {
    const report = await scan(TMP);
    assert.ok(report.filesScanned > 0);
    assert.ok(report.matches.length > 0);
  });

  it('finds deprecated gpt-4 in JS file', async () => {
    const report = await scan(TMP);
    const match = report.matches.find(m => m.raw === 'gpt-4' && m.file.includes('client.js'));
    assert.ok(match, 'expected to find gpt-4 in client.js');
    assert.equal(match?.model?.status, 'deprecated');
  });

  it('finds deprecated claude-3-opus via alias in Python file', async () => {
    const report = await scan(TMP);
    const match = report.matches.find(m => m.raw === 'claude-3-opus-20240229');
    assert.ok(match, 'expected to find claude-3-opus-20240229 in main.py');
    assert.equal(match?.model?.id, 'claude-opus-3');
    assert.equal(match?.model?.status, 'deprecated');
  });

  it('finds active gpt-4o-mini in TS file', async () => {
    const report = await scan(TMP);
    const match = report.matches.find(m => m.raw === 'gpt-4o-mini');
    assert.ok(match, 'expected to find gpt-4o-mini in service.ts');
    assert.equal(match?.model?.status, 'active');
  });

  it('finds deprecated gpt-3.5-turbo in YAML config', async () => {
    const report = await scan(TMP);
    const match = report.matches.find(m => m.raw === 'gpt-3.5-turbo');
    assert.ok(match, 'expected to find gpt-3.5-turbo in config.yaml');
    assert.equal(match?.model?.status, 'deprecated');
  });

  it('finds deprecated claude-instant in .env file', async () => {
    const report = await scan(TMP);
    const match = report.matches.find(m => m.raw.includes('claude-instant'));
    assert.ok(match, 'expected to find claude-instant in .env');
    assert.equal(match?.model?.status, 'deprecated');
  });

  it('summary counts are correct', async () => {
    const report = await scan(TMP);
    assert.ok(report.summary.total > 0);
    assert.ok(report.summary.deprecated > 0);
    assert.equal(
      report.summary.total,
      report.summary.deprecated + report.summary.eol + report.summary.active + report.summary.unknown
    );
  });

  it('includes line numbers', async () => {
    const report = await scan(TMP);
    for (const m of report.matches) {
      assert.ok(m.line >= 1, `line should be >= 1, got ${m.line}`);
    }
  });

  it('deduplicates matches per file+line+model', async () => {
    const report = await scan(TMP);
    const seen = new Set<string>();
    for (const m of report.matches) {
      const key = `${m.file}:${m.line}:${m.raw}`;
      assert.ok(!seen.has(key), `duplicate match: ${key}`);
      seen.add(key);
    }
  });
});
