import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createUUID } from '../src/lib/uuid.js';
import { createAttempt } from '../src/exam/engine.js';
import { makePaper, signature } from '../src/exam/paper.js';
import bank from '../src/data/questions.json' with { type: 'json' };

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function useCrypto(t, replacement) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: replacement });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete globalThis.crypto;
  });
}

test('UUID uses the native method with its correct receiver when available', t => {
  const crypto = { randomUUID() { assert.equal(this, crypto); return 'native-uuid'; } };
  useCrypto(t, crypto);
  assert.equal(createUUID(), 'native-uuid');
});

test('UUID fallback produces distinct version-4 IDs when randomUUID is unavailable', t => {
  useCrypto(t, { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
  const ids = Array.from({ length: 500 }, createUUID);
  for (const id of ids) assert.match(id, uuidV4);
  assert.equal(new Set(ids).size, ids.length);
});

test('UUID reports a useful error if secure random generation is entirely unavailable', t => {
  useCrypto(t, undefined);
  assert.throws(createUUID, /Secure random generation is unavailable/);
});

test('fresh generated papers and attempts work without crypto.randomUUID', t => {
  useCrypto(t, { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
  const seen = bank.map(signature);
  for (const category of ['verbal', 'nonverbal', 'academic']) {
    const paper = makePaper(category, seen);
    assert.equal(paper.length, 85);
    assert.equal(new Set(paper.map(q => q.id)).size, 85);
    for (const q of paper) assert.match(q.id, uuidV4);
    const attempt = createAttempt(paper, category);
    assert.match(attempt.id, uuidV4);
    assert.equal(attempt.status, 'running');
  }
});
