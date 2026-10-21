import { createUUID } from '../lib/uuid.js';

export const TOTAL = 85;
export const PASS = 64;
export const LIMIT = 30 * 60 * 1000;
export const categories = {
  verbal: 'Verbal Intelligence',
  nonverbal: 'Non-Verbal Intelligence',
  academic: 'Academic Preparation',
};
export function createAttempt(paper, category, now = Date.now()) {
  if (paper.length !== TOTAL) throw new Error('A test requires 85 questions.');
  return { id: createUUID(), category, paper, answers: Array(TOTAL).fill(null), index: 0,
    started: now, due: now + LIMIT, status: 'running', steps: 0, skipped: {}, resurfaced: [] };
}
export function summarize(s, reason, now = Date.now()) {
  const correct = s.answers.filter((a, i) => a !== null && a === s.paper[i].answer).length;
  const answered = s.answers.filter(a => a !== null).length;
  return { id: s.id, category: s.category, correct, incorrect: answered - correct,
    unanswered: TOTAL - answered, reason, pass: !['tab', 'interrupt'].includes(reason) && correct >= PASS,
    finished: now, duration: Math.min(LIMIT, Math.max(0, now - s.started)) };
}
export function finish(s, reason, now = Date.now()) {
  if (s.status !== 'running') return s;
  return { ...s, status: 'ended', result: summarize(s, reason, now), paper: [], answers: [], skipped: {} };
}
export function transition(s, action, now = Date.now()) {
  if (!s || s.status !== 'running') return s;
  if (now >= s.due) return finish(s, 'time', now);
  if (action.type === 'finish') return finish(s, action.reason, now);
  if (action.type === 'jump') {
    const index = action.index;
    if (!Number.isInteger(index) || index < 0 || index >= TOTAL || s.answers[index] !== null) return s;
    return { ...s, index };
  }
  if (action.type === 'answer') {
    if (s.answers[s.index] !== null || !Number.isInteger(action.choice) || action.choice < 0 || action.choice > 3) return s;
    const answers = [...s.answers]; answers[s.index] = action.choice;
    const skipped = { ...s.skipped }; delete skipped[s.index];
    return { ...s, answers, skipped };
  }
  if (action.type === 'previous') return { ...s, index: Math.max(0, s.index - 1) };
  if (action.type !== 'next' && action.type !== 'skip') return s;
  const skipped = { ...s.skipped }, steps = s.steps + 1;
  if (action.type === 'skip' && s.answers[s.index] === null && !s.resurfaced.includes(s.index)) skipped[s.index] = steps + 10;
  const due = Object.keys(skipped).map(Number).find(i => i !== s.index && skipped[i] <= steps && s.answers[i] === null);
  if (due !== undefined) { delete skipped[due]; return { ...s, steps, skipped, index: due, resurfaced: [...s.resurfaced, due] }; }
  let index = s.index + 1;
  if (index >= TOTAL) {
    index = s.answers.findIndex(a => a === null);
    if (index < 0) return s;
    delete skipped[index];
  }
  return { ...s, index, steps, skipped };
}
