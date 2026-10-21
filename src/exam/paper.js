import bank from '../data/questions.json' with { type: 'json' };
import { verbalGen, academicGen, figureGen, shuffle } from '../data/generators.js';
import { TOTAL } from './engine.js';
import { createUUID } from '../lib/uuid.js';
// Canonical signature ignores option order, so shuffling cannot disguise a repeat.
export function signature(q) {
  const text = JSON.stringify([q.category, q.question, [...q.options].sort(), q.visual || null]);
  let a = 2166136261, b = 2002800311;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b ^ text.charCodeAt(i), 2246822519); }
  return (a >>> 0).toString(36) + '.' + (b >>> 0).toString(36);
}
export function makePaper(category, seen = []) {
  const used = new Set(seen), paper = [];
  const pool = shuffle(bank.filter(q => category === 'academic'
    ? ['Academic', 'Pakistan Studies', 'Islamiat', 'General Knowledge'].includes(q.category)
    : q.category === (category === 'verbal' ? 'Verbal Intelligence' : 'Non-Verbal Intelligence')));
  for (const q of pool) {
    const sig = signature(q);
    if (!used.has(sig)) { paper.push(q); used.add(sig); }
    if (paper.length === TOTAL) break;
  }
  const generator = category === 'verbal' ? verbalGen : category === 'nonverbal' ? figureGen : academicGen;
  for (let tries = 0; paper.length < TOTAL && tries < 10000; tries++) {
    const q = generator(tries, 0), sig = signature(q);
    if (q.options.length !== 4 || new Set(q.options).size !== 4 || used.has(sig)) continue;
    paper.push({ ...q, id: createUUID() }); used.add(sig);
  }
  if (paper.length !== TOTAL) throw new Error('A fresh paper could not be prepared. Please try again.');
  return shuffle(paper);
}
