// Rebuild this authored question expansion without changing earlier question IDs.
// Run from the project root: node scripts/add-practice-questions.mjs
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../src/data/questions.json', import.meta.url);
const expansion = 'practice-expansion-01';
const original = JSON.parse(readFileSync(file, 'utf8')).filter(q => q.expansion !== expansion);
const additions = [];
const counters = {};
function add(category, tag, question, choices, explanation, visual) {
  const number = counters[category] = (counters[category] || 0) + 1;
  const prefix = { 'Verbal Intelligence': 'V', 'Non-Verbal Intelligence': 'NV', Academic: 'A' }[category];
  const answer = (number - 1) % 4;
  // Input lists the correct answer first; rotate its position in the final paper.
  const options = choices.slice(-answer || choices.length).concat(choices.slice(0, -answer || choices.length));
  assert.equal(options[answer], choices[0]);
  additions.push({ id: `${prefix}-EXT-${String(number).padStart(3, '0')}`, category, tag, question, options, answer, explanation, ...(visual ? { visual } : {}), expansion });
}

// Each tuple: topic, question, correct answer followed by three distractors, explanation.
const verbal = [
  ['analogy', 'Author is to novel as composer is to what?', ['Symphony', 'Canvas', 'Sculpture', 'Camera'], 'An author creates a novel; a composer creates a symphony.'],
  ['analogy', 'Eye is to seeing as ear is to what?', ['Hearing', 'Speaking', 'Touching', 'Tasting'], 'The eye is used for seeing and the ear for hearing.'],
  ['analogy', 'Seed is to plant as egg is to what?', ['Bird', 'Nest', 'Feather', 'Wing'], 'A plant develops from a seed, just as a bird develops from an egg.'],
  ['analogy', 'Thermometer is to temperature as barometer is to what?', ['Atmospheric pressure', 'Rainfall', 'Wind speed', 'Humidity'], 'A thermometer measures temperature; a barometer measures atmospheric pressure.'],
  ['analogy', 'Carpenter is to saw as tailor is to what?', ['Scissors', 'Hammer', 'Spanner', 'Telescope'], 'A saw is a carpenter\'s cutting tool; scissors are a tailor\'s cutting tool.'],
  ['analogy', 'Page is to book as brick is to what?', ['Wall', 'Cement', 'Clay', 'Kiln'], 'Pages are components of a book; bricks are components of a brick wall.'],
  ['vocabulary', 'Choose the word closest in meaning to CAUTIOUS.', ['Careful', 'Careless', 'Hasty', 'Reckless'], 'Cautious means taking care to avoid danger or mistakes.'],
  ['vocabulary', 'Choose the word closest in meaning to CONCISE.', ['Brief', 'Lengthy', 'Confusing', 'Repeated'], 'Concise means expressing something clearly in few words.'],
  ['vocabulary', 'Choose the opposite of ABUNDANT.', ['Scarce', 'Plentiful', 'Numerous', 'Ample'], 'Abundant means plentiful; scarce means in short supply.'],
  ['vocabulary', 'Choose the opposite of EXPAND.', ['Contract', 'Enlarge', 'Extend', 'Increase'], 'To contract is to become smaller; to expand is to become larger.'],
  ['vocabulary', 'Choose the word closest in meaning to FRAGILE.', ['Delicate', 'Durable', 'Tough', 'Sturdy'], 'Something fragile or delicate can be damaged or broken easily.'],
  ['vocabulary', 'Choose the word closest in meaning to RELUCTANT.', ['Unwilling', 'Eager', 'Enthusiastic', 'Keen'], 'Reluctant means unwilling or hesitant to do something.'],
  ['ranking', 'Ali is seventh from the top and ninth from the bottom of a single ranking list. How many people are in the list?', ['15', '14', '16', '17'], 'Total = 7 + 9 - 1 = 15; Ali is counted in both positions.'],
  ['family-relation', 'Sara is Hamza\'s sister. Hamza is Ayesha\'s father. How is Sara related to Ayesha?', ['Paternal aunt', 'Mother', 'Grandmother', 'Daughter'], 'The sister of a person\'s father is that person\'s paternal aunt.'],
  ['ordering', 'In a queue, A stands before B, and B stands before C. Which of these three stands earliest?', ['A', 'B', 'C', 'Cannot be determined'], 'A is before B, who is before C, so A is earliest among the three.'],
  ['deduction', 'All pilots are trained. No trained person is careless. Which conclusion must follow?', ['No pilot is careless', 'All trained people are pilots', 'Some pilots are careless', 'Every careful person is a pilot'], 'Pilots are included among trained people, and trained people are excluded from the careless group.'],
  ['ranking', 'Five runners finish a race with no ties. Bilal finishes third. What is his position when counted from the last finisher?', ['Third', 'First', 'Second', 'Fourth'], 'Position from the end = 5 - 3 + 1 = 3.'],
  ['ordering', 'Maria is older than Sana. Sana is older than Hina. Who is the youngest of these three?', ['Hina', 'Maria', 'Sana', 'Cannot be determined'], 'The age order is Maria, then Sana, then Hina from oldest to youngest.'],
  ['coding', 'A code shifts every letter one place forward in the alphabet: BIRD becomes CJSE. How is FISH written?', ['GJTI', 'EHRG', 'GITH', 'HJUK'], 'Shift F to G, I to J, S to T, and H to I.'],
  ['coding', 'A code shifts each letter two places forward in the alphabet. How is CODE written?', ['EQFG', 'DPEF', 'AMBC', 'FQGH'], 'C becomes E, O becomes Q, D becomes F, and E becomes G.'],
  ['coding', 'A code writes each word in reverse order. How is LAMP written?', ['PMAL', 'PLAM', 'MAPL', 'LPMA'], 'Reading LAMP from its last letter to its first gives PMAL.'],
  ['coding', 'Using A = 1, B = 2, ..., Z = 26, what is the sum of the letter values in DOG?', ['26', '24', '25', '27'], 'D + O + G = 4 + 15 + 7 = 26.'],
  ['direction', 'You face north, turn right, then left, then left again. Which direction do you face?', ['West', 'North', 'East', 'South'], 'North to east to north to west.'],
  ['direction', 'A cadet walks 8 metres east and then 6 metres north. What is the straight-line distance from the starting point?', ['10 metres', '14 metres', '2 metres', '48 metres'], 'The two legs form a right triangle: distance = sqrt(8² + 6²) = sqrt(100) = 10 metres.'],
  ['number-sequence', 'Find the next term: 4, 9, 19, 39, ?', ['79', '78', '80', '81'], 'Multiply each term by 2 and add 1: 39 × 2 + 1 = 79.'],
  ['number-sequence', 'Find the next term: 2, 6, 12, 20, 30, ?', ['42', '40', '44', '46'], 'The differences are 4, 6, 8, 10, then 12, so 30 + 12 = 42.'],
  ['letter-series', 'Find the next letter: A, C, F, J, O, ?', ['U', 'T', 'V', 'S'], 'Letter positions increase by 2, 3, 4, 5, then 6: O (15) + 6 = U (21).'],
  ['letter-series', 'Find the next letter: Z, W, T, Q, ?', ['N', 'M', 'O', 'P'], 'Move three letters backwards each time: Q to N.'],
  ['number-sequence', 'Find the next term: 3, 6, 18, 72, ?', ['360', '144', '216', '288'], 'Multiply successively by 2, 3, 4, then 5: 72 × 5 = 360.'],
  ['number-sequence', 'Find the next square number: 1, 4, 9, 16, 25, ?', ['36', '30', '35', '49'], 'These are 1², 2², 3², 4², 5²; the next is 6² = 36.'],
];
for (const [tag, question, options, explanation] of verbal) add('Verbal Intelligence', tag, question, options, explanation);

const academic = [
  ['percentage', 'What is 18% of 250?', ['45', '40', '50', '55'], '18/100 × 250 = 45.'],
  ['ratio', 'Two amounts are in the ratio 3:5 and total 64. What is the smaller amount?', ['24', '16', '32', '40'], 'There are 8 ratio parts. Each part is 64/8 = 8; the smaller amount is 3 × 8 = 24.'],
  ['percentage', 'A book costs Rs 1,200 before a 15% discount. What is its discounted price?', ['Rs 1,020', 'Rs 1,050', 'Rs 1,080', 'Rs 1,180'], 'The discount is 0.15 × 1200 = Rs 180. Pay 1200 - 180 = Rs 1020.'],
  ['speed', 'A vehicle travels 180 km in 3 hours. What is its average speed?', ['60 km/h', '45 km/h', '90 km/h', '540 km/h'], 'Average speed = total distance / total time = 180/3 = 60 km/h.'],
  ['algebra', 'Solve for x: 4x + 7 = 35.', ['7', '6', '8', '9'], 'Subtract 7 to obtain 4x = 28, then divide by 4 to get x = 7.'],
  ['statistics', 'What is the arithmetic mean of 12, 18, 20, and 30?', ['20', '18', '22', '25'], 'Mean = (12 + 18 + 20 + 30)/4 = 80/4 = 20.'],
  ['geometry', 'Two interior angles of a triangle are 48° and 67°. What is the third angle?', ['65°', '55°', '75°', '115°'], 'A triangle\'s interior angles sum to 180°: 180 - 48 - 67 = 65°.'],
  ['geometry', 'A rectangle is 14 cm long and 9 cm wide. What is its area?', ['126 cm²', '46 cm²', '63 cm²', '252 cm²'], 'Area = length × width = 14 × 9 = 126 cm².'],
  ['interest', 'Find the simple interest on Rs 5,000 at 8% per year for 2 years.', ['Rs 800', 'Rs 400', 'Rs 832', 'Rs 1,000'], 'Simple interest = principal × rate × time = 5000 × 0.08 × 2 = Rs 800.'],
  ['fractions', 'Express 0.375 as a fraction in lowest terms.', ['3/8', '3/5', '5/8', '7/20'], '0.375 = 375/1000. Dividing numerator and denominator by 125 gives 3/8.'],
  ['work-rate', 'Six workers complete a job in 12 days. At the same constant rate, how many days would nine workers need?', ['8 days', '6 days', '9 days', '18 days'], 'The job requires 6 × 12 = 72 worker-days. Nine workers need 72/9 = 8 days.'],
  ['probability', 'A fair six-sided die numbered 1 to 6 is rolled once. What is the probability of an odd result?', ['1/2', '1/3', '1/6', '2/3'], 'The odd outcomes are 1, 3, and 5: 3 favourable outcomes out of 6, or 1/2.'],
  ['english-grammar', 'Choose the correct verb: Neither of the two candidates ___ absent.', ['is', 'are', 'were', 'have'], 'In formal standard English, neither is singular here and takes the singular verb is.'],
  ['english-articles', 'Complete the sentence: We waited for ___ hour.', ['an', 'a', 'the only', 'no article'], 'Hour starts with a vowel sound because its h is silent, so use an.'],
  ['english-prepositions', 'Complete the sentence: She is interested ___ mathematics.', ['in', 'on', 'at', 'by'], 'The standard expression is interested in something.'],
  ['english-tense', 'Choose the correct verb: Yesterday, he ___ to the library.', ['went', 'go', 'goes', 'going'], 'Yesterday places the completed action in the past; the simple past of go is went.'],
  ['english-voice', 'Choose the passive form of: The cadet wrote the report.', ['The report was written by the cadet.', 'The report is written by the cadet.', 'The report has written the cadet.', 'The report was writing the cadet.'], 'The simple past passive uses was/were + past participle: was written.'],
  ['english-spelling', 'Which word is spelled correctly?', ['Accommodate', 'Accomodate', 'Acommodate', 'Acomodate'], 'Accommodate is spelled with a double c and a double m.'],
  ['english-parts-of-speech', 'In the sentence "The cadet answered quickly," which word is an adverb?', ['Quickly', 'Cadet', 'Answered', 'The'], 'Quickly modifies the verb answered by explaining how the action was performed.'],
  ['english-plurals', 'What is the standard plural of analysis?', ['Analyses', 'Analysises', 'Analysies', 'Analysis'], 'The singular analysis changes to analyses in the plural.'],
  ['physics', 'Which is the SI unit of force?', ['Newton', 'Joule', 'Watt', 'Pascal'], 'Force is measured in newtons (N); 1 N = 1 kg·m/s².'],
  ['physics', 'Which is the SI unit of power?', ['Watt', 'Volt', 'Ohm', 'Coulomb'], 'Power is measured in watts (W); 1 watt is 1 joule per second.'],
  ['chemistry', 'Which chemical formula represents water?', ['H₂O', 'CO₂', 'O₂', 'NaCl'], 'A water molecule contains two hydrogen atoms and one oxygen atom: H₂O.'],
  ['chemistry', 'Which particle in an atom carries a positive electric charge?', ['Proton', 'Electron', 'Neutron', 'Photon'], 'Protons have positive charge; electrons have negative charge and neutrons have no net charge.'],
  ['chemistry', 'At 25°C, an aqueous solution with pH 3 is classified as what?', ['Acidic', 'Neutral', 'Alkaline', 'Always pure water'], 'At 25°C, pH below 7 is acidic, pH 7 is neutral, and pH above 7 is alkaline.'],
  ['biology', 'Which gas do green plants take in from the air for photosynthesis?', ['Carbon dioxide', 'Nitrogen', 'Helium', 'Hydrogen'], 'Plants use carbon dioxide and water to make sugars during photosynthesis.'],
  ['electricity', 'Which of these materials is a good electrical conductor at room temperature?', ['Copper', 'Rubber', 'Dry wood', 'Glass'], 'Copper is a metal with mobile electrons that carry electric current.'],
  ['waves', 'In which of these can sound NOT travel?', ['A vacuum', 'Air', 'Water', 'Steel'], 'Sound is a mechanical wave and requires a material medium; a vacuum has none.'],
  ['biology', 'In a typical animal cell, which organelle produces most ATP during aerobic respiration?', ['Mitochondrion', 'Ribosome', 'Nucleus', 'Golgi apparatus'], 'Mitochondria carry out key stages of aerobic respiration and produce most of the cell\'s ATP.'],
  ['physics', 'A net force of 12 N acts on a mass of 3 kg. What is its acceleration?', ['4 m/s²', '9 m/s²', '15 m/s²', '36 m/s²'], 'Newton\'s second law gives a = F/m = 12/3 = 4 m/s².'],
];
for (const [tag, question, options, explanation] of academic) add('Academic', tag, question, options, explanation);

// All figures are authored inline SVG, using actual dot coordinates for transforms.
const bits = positions => positions.reduce((mask, position) => mask | (1 << position), 0);
function transform(mask, mapping) {
  let result = 0;
  for (let i = 0; i < 9; i++) if (mask & (1 << i)) result |= 1 << mapping(i % 3, Math.floor(i / 3));
  return result;
}
const rotate = mask => transform(mask, (x, y) => x * 3 + (2 - y));
const mirror = mask => transform(mask, (x, y) => y * 3 + (2 - x));
function rotations(mask) { return [mask, rotate(mask), rotate(rotate(mask)), rotate(rotate(rotate(mask)))]; }
function figure(mask) {
  let dots = '';
  for (let i = 0; i < 9; i++) dots += `<circle cx="${16 + (i % 3) * 20}" cy="${16 + Math.floor(i / 3) * 20}" r="${mask & (1 << i) ? 5.5 : 2}" fill="${mask & (1 << i) ? '#173d30' : '#dce7e0'}"/>`;
  return `svgraw:<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="66" height="66" rx="8" fill="white" stroke="#adc8b5"/>${dots}</svg>`;
}
function visualQuestion(tag, question, correct, wrong, explanation, figures, mode = 'sequence') {
  const masks = [correct, ...wrong];
  assert.equal(new Set(masks).size, 4, 'Visual choices must be distinct patterns.');
  add('Non-Verbal Intelligence', tag, question, masks.map(figure), explanation,
    figures ? { mode, figures: figures.map(mask => mask === '?' ? '?' : figure(mask)) } : undefined);
}
// Select six patterns without rotational or reflection symmetry, from different orbits.
const patterns = [], orbits = new Set();
for (let mask = 1; mask < 512 && patterns.length < 6; mask++) {
  const orbit = [...rotations(mask), ...rotations(mirror(mask))];
  const canonical = Math.min(...orbit);
  if (new Set(orbit).size === 8 && !orbits.has(canonical)) { patterns.push(mask); orbits.add(canonical); }
}
assert.equal(patterns.length, 6);
for (const mask of patterns) {
  const [initial, clockwise, half, anticlockwise] = rotations(mask);
  visualQuestion('figure-rotation', 'Rotate the displayed dot pattern 90° clockwise. Which option shows the result?', clockwise, [initial, half, anticlockwise], 'Each filled dot moves a quarter-turn clockwise around the centre. The top-left cell moves to the top-right cell.', [mask]);
}
for (const mask of patterns) {
  visualQuestion('figure-reflection', 'Reflect the displayed dot pattern across a vertical mirror line through its centre. Which option is correct?', mirror(mask), rotations(mask).slice(0, 3), 'A vertical reflection swaps the left and right columns while keeping the top, middle, and bottom rows unchanged.', [mask]);
}
const dotOrder = [0, 4, 8, 2, 6, 1, 7, 3, 5];
const countMask = count => bits(dotOrder.slice(0, count));
for (const [start, step] of [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2]]) {
  const next = start + step * 3;
  const wrong = Array.from({ length: 9 }, (_, i) => i + 1).filter(n => n !== next).sort((a, b) => Math.abs(a - next) - Math.abs(b - next)).slice(0, 3);
  visualQuestion('dot-sequence', 'Continue the sequence by keeping the existing filled dots and adding the same number of filled dots at each step.', countMask(next), wrong.map(countMask), `The filled-dot counts are ${start}, ${start + step}, ${start + step * 2}. Add ${step} again to obtain ${next} filled dots.`, [countMask(start), countMask(start + step), countMask(start + step * 2), '?']);
}
for (const [name, operation, rule] of [
  ['union', (a, b) => a | b, 'at least one of the first two panels'],
  ['intersection', (a, b) => a & b, 'both of the first two panels'],
  ['exclusive-difference', (a, b) => a ^ b, 'exactly one of the first two panels, but not both'],
]) {
  for (let variation = 0; variation < 2; variation++) {
    const turn = mask => variation ? rotate(mask) : mask;
    const pairs = [[bits([0, 1, 4]), bits([1, 2, 4])], [bits([3, 4, 6]), bits([4, 7, 8])], [bits([0, 4, 8]), bits([2, 4, 6])]].map(pair => pair.map(turn));
    const correct = operation(...pairs[2]);
    const panels = pairs.flatMap(([a, b], i) => [a, b, i === 2 ? '?' : operation(a, b)]);
    visualQuestion(`matrix-${name}`, `Complete the missing panel. In every row, the third panel keeps dots present in ${rule}.`, correct, [correct ^ 1, correct ^ 16, correct ^ 256], `Apply the row rule to the last row: retain dots present in ${rule}. All other cells stay empty.`, panels, 'matrix');
  }
}
const symmetric = [bits([0, 2]), bits([3, 5]), bits([6, 8]), bits([0, 2, 4]), bits([1, 3, 5]), bits([3, 5, 7])];
for (let i = 0; i < 6; i++) {
  const wrong = [symmetric[i], symmetric[(i + 1) % 6], symmetric[(i + 2) % 6]];
  const asymmetric = symmetric[i] ^ 1;
  assert.notEqual(mirror(asymmetric), asymmetric);
  assert.ok(wrong.every(mask => mirror(mask) === mask));
  visualQuestion('visual-symmetry', 'Which dot pattern is NOT symmetric about a vertical line through its centre?', asymmetric, wrong, 'In the asymmetric option, a filled dot on one side has no filled partner in the corresponding cell on the opposite side. The other three patterns match across the vertical centre line.');
}

assert.equal(additions.length, 90);
assert.ok(Object.values(counters).every(count => count === 30));
const bank = [...original, ...additions];
assert.equal(new Set(bank.map(q => q.id)).size, bank.length, 'Question IDs must remain unique.');
const canonical = q => JSON.stringify([q.category, q.question, [...q.options].sort(), q.visual || null]);
const seen = new Set(original.map(canonical));
for (const q of additions) {
  assert.equal(q.options.length, 4);
  assert.equal(new Set(q.options).size, 4);
  assert.ok(q.explanation && q.answer >= 0 && q.answer < 4);
  assert.ok(!seen.has(canonical(q)), `Duplicate question: ${q.id}`);
  seen.add(canonical(q));
}
writeFileSync(file, JSON.stringify(bank) + '\n');
console.log(JSON.stringify({ added: additions.length, byCategory: counters, total: bank.length }, null, 2));
