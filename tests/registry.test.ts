import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveModel, getRegistry } from '../src/registry.ts';

describe('registry', () => {
  it('loads registry without error', () => {
    const reg = getRegistry();
    assert.ok(Array.isArray(reg.models));
    assert.ok(reg.models.length > 0);
  });

  it('resolves a known model by id', () => {
    const m = resolveModel('claude-opus-3');
    assert.ok(m !== null);
    assert.equal(m?.id, 'claude-opus-3');
    assert.equal(m?.status, 'deprecated');
  });

  it('resolves a model by alias', () => {
    const m = resolveModel('claude-3-opus-20240229');
    assert.ok(m !== null);
    assert.equal(m?.id, 'claude-opus-3');
  });

  it('resolves gpt-4 as deprecated', () => {
    const m = resolveModel('gpt-4');
    assert.ok(m !== null);
    assert.equal(m?.status, 'deprecated');
    assert.equal(m?.successor, 'gpt-4o');
  });

  it('resolves gpt-4o as active', () => {
    const m = resolveModel('gpt-4o');
    assert.ok(m !== null);
    assert.equal(m?.status, 'active');
  });

  it('returns null for unknown model', () => {
    const m = resolveModel('unicorn-model-9000');
    assert.equal(m, null);
  });

  it('is case-insensitive', () => {
    const m = resolveModel('GPT-4O');
    assert.ok(m !== null);
    assert.equal(m?.id, 'gpt-4o');
  });

  it('resolves gemini-2.5-pro as active', () => {
    const m = resolveModel('gemini-2.5-pro');
    assert.ok(m !== null);
    assert.equal(m?.status, 'active');
  });

  it('resolves gemini-1.5-pro as deprecated', () => {
    const m = resolveModel('gemini-1.5-pro');
    assert.ok(m !== null);
    assert.equal(m?.status, 'deprecated');
    assert.equal(m?.successor, 'gemini-2.5-pro');
  });

  it('resolves gpt-3.5-turbo as deprecated', () => {
    const m = resolveModel('gpt-3.5-turbo');
    assert.ok(m !== null);
    assert.equal(m?.status, 'deprecated');
    assert.equal(m?.successor, 'gpt-4o-mini');
  });

  it('all deprecated models have a successor', () => {
    const reg = getRegistry();
    const broken = reg.models
      .filter(m => m.status === 'deprecated' && !m.successor)
      .map(m => m.id);
    assert.deepEqual(broken, [], `deprecated models without successor: ${broken.join(', ')}`);
  });
});
