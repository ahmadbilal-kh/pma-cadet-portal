import { categories, LIMIT, PASS, TOTAL } from '../exam/engine.js';

const reasons = new Set(['passed', 'complete', 'early', 'time']);
const historyKey = userId => `cadetprep:${userId}:history`;
function browserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

export function normalizeResult(row) {
  if (!row || typeof row.id !== 'string' || !row.id || !Object.hasOwn(categories, row.category) || !reasons.has(row.reason)) return null;
  const counts = [row.correct, row.incorrect, row.unanswered];
  if (counts.some(value => !Number.isInteger(value) || value < 0 || value > TOTAL) || counts.reduce((a, b) => a + b, 0) !== TOTAL) return null;
  const finished = typeof row.finished === 'number' ? row.finished : Date.parse(row.finished_at);
  const duration = row.duration ?? row.duration_ms;
  if (!Number.isFinite(finished) || finished <= 0 || !Number.isFinite(duration) || duration < 0 || duration > LIMIT) return null;
  return { id: row.id, category: row.category, correct: row.correct, incorrect: row.incorrect, unanswered: row.unanswered,
    finished, duration, reason: row.reason, pass: row.correct >= PASS };
}

export function mergeResults(local, remote = []) {
  const rows = new Map();
  for (const [source, synced] of [[local, false], [remote, true]]) {
    for (const candidate of source) {
      const row = normalizeResult(candidate);
      if (row) rows.set(row.id, { ...row, synced });
    }
  }
  return [...rows.values()].sort((a, b) => b.finished - a.finished || a.id.localeCompare(b.id));
}

export function readLocalHistory(userId, storage = browserStorage()) {
  if (!userId) return [];
  const rows = [];
  try {
    const saved = JSON.parse(storage.getItem(historyKey(userId)) || '[]');
    if (Array.isArray(saved)) rows.push(...saved);
  } catch { /* Recover from the last result saved for each category. */ }
  for (const category of Object.keys(categories)) {
    try {
      const saved = JSON.parse(storage.getItem(`cadetprep:${userId}:${category}`));
      if (saved?.status === 'ended' && saved.result?.category === category) rows.push(saved.result);
    } catch { /* One unavailable or damaged entry must not hide the others. */ }
  }
  return mergeResults(rows);
}

export function recordResult(userId, result, storage = browserStorage()) {
  const row = normalizeResult(result);
  if (!userId || !row) return;
  const rows = mergeResults(readLocalHistory(userId, storage), [row]);
  storage.setItem(historyKey(userId), JSON.stringify(rows.map(({ synced, ...entry }) => entry)));
}

export async function loadHistory(client, userId, storage = browserStorage()) {
  const local = readLocalHistory(userId, storage);
  if (!client || !userId) return { rows: local, offline: true };
  const remote = [];
  try {
    let offset = 0;
    while (true) {
      const { data, error, count } = await client.from('practice_attempts')
        .select('id,user_id,category,correct,incorrect,unanswered,reason,finished_at,duration_ms', { count: 'exact' })
        .eq('user_id', userId).order('finished_at', { ascending: false }).order('id', { ascending: true }).range(offset, offset + 499);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('History unavailable');
      remote.push(...data.filter(row => row.user_id === userId));
      offset += data.length;
      if (!data.length || (typeof count === 'number' ? offset >= count : data.length < 500)) break;
    }
    return { rows: mergeResults(local, remote), offline: false };
  } catch { return { rows: mergeResults(local, remote), offline: true }; }
}

export function summarizeHistory(rows) {
  const total = rows.length;
  return { total, average: total ? Math.round(rows.reduce((sum, row) => sum + row.correct, 0) / (total * TOTAL) * 100) : null,
    best: total ? rows.reduce((best, row) => Math.max(best, row.correct), 0) : null,
    passRate: total ? Math.round(rows.filter(row => row.pass).length / total * 100) : null };
}
