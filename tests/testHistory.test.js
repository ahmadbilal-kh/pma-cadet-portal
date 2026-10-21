import test from 'node:test';
import assert from 'node:assert/strict';
import { loadHistory, mergeResults, normalizeResult, readLocalHistory, recordResult, summarizeHistory } from '../src/lib/testHistory.js';

const result = (id, extra = {}) => ({ id, category: 'verbal', correct: 70, incorrect: 10, unanswered: 5, reason: 'complete', finished: 1800000000000, duration: 60000, ...extra });
const memory = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

test('history accepts completed results and rejects unfinished or malformed summaries', () => {
  assert.equal(normalizeResult(result('valid')).pass, true);
  for (const extra of [{ reason: 'interrupt' }, { reason: 'tab' }, { reason: 'running' }, { category: 'unknown' }, { incorrect: 50 }, { correct: -1 }, { finished: NaN }, { duration: -1 }, { duration: 1800001 }]) {
    assert.equal(normalizeResult(result('invalid', extra)), null);
  }
  assert.equal(normalizeResult(result('low', { correct: 10, incorrect: 70, pass: true })).pass, false);
});

test('merging history deduplicates by attempt ID, prefers account results, and sorts newest first', () => {
  const rows = mergeResults([result('one'), result('two', { finished: 1800000001000 })], [result('one', { correct: 64, incorrect: 16 })]);
  assert.deepEqual(rows.map(row => row.id), ['two', 'one']);
  assert.equal(rows[1].correct, 64);
  assert.equal(rows[1].synced, true);
  assert.equal(rows[0].synced, false);
});

test('the local archive keeps multiple completed attempts from the same category and isolates accounts', () => {
  const storage = memory();
  recordResult('u1', result('one'), storage);
  recordResult('u1', result('two', { finished: 1800000001000 }), storage);
  recordResult('u1', result('two', { finished: 1800000001000 }), storage);
  recordResult('u2', result('other'), storage);
  storage.setItem('cadetprep:u1:verbal', JSON.stringify({ status: 'running', result: result('not-complete') }));
  assert.deepEqual(readLocalHistory('u1', storage).map(row => row.id), ['two', 'one']);
  assert.deepEqual(readLocalHistory('u2', storage).map(row => row.id), ['other']);
});

test('legacy per-category results survive a damaged archive and unavailable storage is safe', () => {
  const storage = memory();
  storage.setItem('cadetprep:u1:history', 'broken json');
  storage.setItem('cadetprep:u1:verbal', JSON.stringify({ status: 'ended', result: result('legacy') }));
  storage.setItem('cadetprep:u1:academic', JSON.stringify({ status: 'ended', result: result('wrong-category') }));
  assert.deepEqual(readLocalHistory('u1', storage).map(row => row.id), ['legacy']);
  assert.deepEqual(readLocalHistory('u1', null), []);
});

test('account history is scoped to the current user and reads every response page', async () => {
  const storage = memory();
  recordResult('u1', result('local'), storage);
  const requests = [];
  const pages = [
    [{ ...result('remote'), user_id: 'u1' }, { ...result('foreign'), user_id: 'u2' }],
    [{ ...result('local'), user_id: 'u1' }],
  ];
  const client = { from(table) {
    const request = { table, orders: [] }; requests.push(request);
    return { select(columns) { request.columns = columns; return this; }, eq(column, id) { request.filter = [column, id]; return this; }, order(column) { request.orders.push(column); return this; }, range(from, to) { request.range = [from, to]; return Promise.resolve({ data: pages[requests.length - 1], count: 3, error: null }); } };
  } };
  const loaded = await loadHistory(client, 'u1', storage);
  assert.equal(loaded.offline, false);
  assert.deepEqual(new Set(loaded.rows.map(row => row.id)), new Set(['remote', 'local']));
  assert.equal(loaded.rows.every(row => row.synced), true);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].filter, ['user_id', 'u1']);
  assert.deepEqual(requests[0].orders, ['finished_at', 'id']);
  assert.deepEqual(requests[1].range, [2, 501]);
  assert.equal(requests[0].columns.includes('paper'), false);
});

test('failed account reads keep device history available', async () => {
  const storage = memory();
  recordResult('u1', result('local'), storage);
  const loaded = await loadHistory({ from() { throw new Error('Offline'); } }, 'u1', storage);
  assert.equal(loaded.offline, true);
  assert.equal(loaded.rows[0].id, 'local');
  assert.equal(loaded.rows[0].synced, false);
});

test('history summary computes scores and pass rate without inventing values for empty history', () => {
  assert.deepEqual(summarizeHistory([]), { total: 0, average: null, best: null, passRate: null });
  const rows = mergeResults([result('one'), result('two', { correct: 15, incorrect: 65 })]);
  assert.deepEqual(summarizeHistory(rows), { total: 2, average: 50, best: 70, passRate: 50 });
});
