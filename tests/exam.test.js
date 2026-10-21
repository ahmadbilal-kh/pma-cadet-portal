import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttempt, transition, finish, LIMIT } from '../src/exam/engine.js';
import { verbalGen, academicGen, figureGen } from '../src/data/generators.js';
const paper = () => Array.from({length:85},(_,i)=>({ id:String(i), answer:0 }));
const start = () => createAttempt(paper(), 'verbal', 1000);
test('85 questions required',()=>assert.throws(()=>createAttempt([], 'verbal')));
test('answers lock and cannot change',()=>{let s=start();s=transition(s,{type:'answer',choice:1},1001);const next=transition(s,{type:'answer',choice:0},1002);assert.equal(next.answers[0],1);});

test('jump selects unanswered questions and preserves answers, timer, and skip scheduling',()=>{
 let s=transition(start(),{type:'skip'},1001);
 const skipped={...s.skipped};
 s=transition(s,{type:'jump',index:7},1002);
 assert.equal(s.index,7);assert.equal(s.due,1000+LIMIT);assert.deepEqual(s.skipped,skipped);assert.equal(s.steps,1);
 s=transition(s,{type:'answer',choice:0},1003);
 s=transition(s,{type:'jump',index:0},1004);
 const locked=transition(s,{type:'jump',index:7},1005);
 assert.equal(locked,s);assert.equal(locked.answers[7],0);
});

test('jump ignores invalid question numbers and cannot bypass the deadline',()=>{
 const s=start();
 for(const index of [-1,85,1.5,'7',undefined])assert.equal(transition(s,{type:'jump',index},1001),s);
 const expired=transition(s,{type:'jump',index:7},1000+LIMIT);
 assert.equal(expired.result.reason,'time');assert.equal(expired.status,'ended');
});
test('64 correct answers do not finish the paper; submitting computes the pass and removes answer keys',()=>{
 let s=start();
 for(let i=0;i<64;i++){
  s=transition(s,{type:'answer',choice:0},1001+i);
  assert.equal(s.status,'running');assert.equal(s.result,undefined);
  if(i<63)s=transition(s,{type:'next'},1001+i);
 }
 s=transition(s,{type:'finish',reason:'early'},1100);
 assert.equal(s.result.pass,true);assert.equal(s.result.correct,64);assert.equal(s.result.unanswered,21);
 assert.deepEqual(s.paper,[]);assert.deepEqual(s.answers,[]);
});

test('deadline overrides late answers',()=>{const s=transition(start(),{type:'answer',choice:0},1000+LIMIT);assert.equal(s.result.reason,'time');assert.equal(s.result.correct,0);assert.equal(s.result.unanswered,85);});
test('skip resurfaces after ten forward moves',()=>{let s=transition(start(),{type:'skip'},1001);assert.equal(s.index,1);for(let i=0;i<9;i++)s=transition(s,{type:'next'},1002+i);assert.equal(s.index,10);s=transition(s,{type:'next'},1012);assert.equal(s.index,0);assert.deepEqual(s.resurfaced,[0]);});
test('early submission preserves incorrect and unanswered separately',()=>{let s=transition(start(),{type:'answer',choice:2},1001);s=finish(s,'early',1002);assert.equal(s.result.incorrect,1);assert.equal(s.result.unanswered,84);assert.equal(s.result.pass,false);});
test('all 85 answers wait for explicit submission before producing a result',()=>{
 let s=start();
 for(let i=0;i<85;i++){
  s=transition(s,{type:'answer',choice:1},1001+i);
  if(i<84)s=transition(s,{type:'next'},1001+i);
 }
 assert.equal(s.status,'running');assert.equal(s.result,undefined);
 assert.equal(transition(s,{type:'next'},1100),s);
 s=transition(s,{type:'finish',reason:'complete'},1101);
 assert.equal(s.status,'ended');assert.equal(s.result.reason,'complete');assert.equal(s.result.incorrect,85);
});

test('tab disqualification cannot become a pass and ending is idempotent',()=>{let s=start();s.answers=Array(85).fill(0);s=finish(s,'tab',1001);assert.equal(s.result.pass,false);assert.equal(finish(s,'passed',1002),s);});
test('generators produce distinct options and valid answer indices',()=>{for(const gen of [verbalGen,academicGen,figureGen])for(let i=0;i<500;i++){const q=gen(i,0);assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.answer>=0&&q.answer<=3);assert.ok(q.question);}});

test('three category papers remain fresh across six attempts',async()=>{
  const { makePaper, signature } = await import('../src/exam/paper.js');
  for(const category of ['verbal','nonverbal','academic']){
    const seen=[];
    for(let run=0;run<6;run++){
      const p=makePaper(category,seen);assert.equal(p.length,85);
      const sigs=p.map(signature);assert.equal(new Set(sigs).size,85);
      for(const [i,q] of p.entries()){
        assert.ok(!seen.includes(sigs[i]));assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);
        if(category==='verbal')assert.equal(q.category,'Verbal Intelligence');
        if(category==='nonverbal')assert.equal(q.category,'Non-Verbal Intelligence');
        if(category==='academic')assert.ok(['Academic','Pakistan Studies','Islamiat','General Knowledge'].includes(q.category));
      }
      seen.push(...sigs);
    }
  }
});
