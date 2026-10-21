export function shuffle(xs){xs=[...xs];for(let i=xs.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[xs[i],xs[j]]=[xs[j],xs[i]]}return xs}
// Generated exam engine: question arrangements and numerical/visual parameters vary each attempt.
const pick = xs => xs[Math.floor(Math.random()*xs.length)];
const randint=(lo,hi)=>lo+Math.floor(Math.random()*(hi-lo+1));
function uniqueShuffle(xs){return shuffle([...new Set(xs)])}
function buildChoices(correct, distractors){
 const c=String(correct),opts=uniqueShuffle(distractors.map(String).filter(x=>x!==c));
 if(opts.length<3)return null;
 const options=shuffle([c,...opts.slice(0,3)]);
 return {options,answer:options.indexOf(c)};
}
function generated(category,slot,salt){
 if(category==='Verbal Intelligence')return verbalGen(slot,salt);
 if(category==='Non-Verbal Intelligence')return figureGen(slot,salt);
 if(category==='Academic')return academicGen(slot,salt);
 return factualGen(category,slot,salt);
}
function verbalGen(slot,salt){
 const type=slot%6;
 let question, correct, wrong, explanation;
 if(type===0){
  const a=randint(2,8),b=randint(3,17),c=randint(3,26),begin=randint(1,5);
  const f=n=>a*n*n+b*n+c;
  const terms=Array.from({length:5},(_,j)=>f(begin+j)),ans=f(begin+5);
  question=`Identify the missing sixth term in this number sequence: ${terms.join(', ')}, ?`;
  correct=ans;wrong=[ans+2*a,ans-2*a,ans+a*2+2*b,ans-a*2-2*b,ans+randint(3,14)];
  explanation=`The terms follow ${a}n² + ${b}n + ${c}, starting at n=${begin}.`;
 }else if(type===1){
  const a=randint(5,29),b=randint(8,31),da=randint(3,13),db=randint(4,15);
  const terms=Array.from({length:7},(_,j)=>j%2===0?a+(j/2)*da:b+Math.floor(j/2)*db);
  correct=b+3*db;
  question=`Two interleaved progressions form this sequence: ${terms.join(', ')}, ? What is the next term?`;
  wrong=[a+4*da,b+4*db,correct+db,correct-db,a+3*da];
  explanation=`The odd-position terms increase by ${da}; the even-position terms increase by ${db}.`;
 }else if(type===2){
  const words=['BRAVE','PILOT','SOLAR','TRAIN','CLOUD','SMART','STONE','CRANE','PLANE','TIGER','RIVER','FLAME','SWORD','BLADE'];
  const w1=pick(words),w2=pick(words.filter(x=>x!==w1)),base=randint(1,5),step=randint(1,3);
  const enc=(w,offset=0)=>w.split('').map((ch,i)=>String.fromCharCode(65+(ch.charCodeAt(0)-65+base+step*i+offset+260)%26)).join('');
  question=`A position-dependent letter code writes ${w1} as ${enc(w1)}. Using the SAME rule, how is ${w2} written?`;
  correct=enc(w2);wrong=[enc(w2,1),enc(w2,-1),w2.split('').map((ch,i)=>String.fromCharCode(65+(ch.charCodeAt(0)-65+base+step*(i+1))%26)).join(''),w2.split('').map(ch=>String.fromCharCode(65+(ch.charCodeAt(0)-65+base)%26)).join('')];
  explanation=`Shift the first letter by ${base}, then increase the shift by ${step} for each following position.`;
 }else if(type===3){
  const east=randint(10,19),north=randint(10,18),addE=randint(1,8),addN=randint(1,9);
  const E=east-addE,N=north-addN;
  question=`During an orientation exercise, a cadet walks ${east} km east, ${north} km north, ${addE} km west, then ${addN} km south. What is the cadet's final direction and straight-line distance from the start?`;
  const fn=(x,y)=>`${Math.sqrt(x*x+y*y).toFixed(2)} km northeast`;
  correct=fn(E,N);wrong=[fn(east,north),fn(E+addE,N),fn(E,N+addN),`${Math.sqrt(E*E+N*N).toFixed(2)} km northwest`,`${(E+N).toFixed(2)} km northeast`];
  explanation=`Net displacement is ${E} km east and ${N} km north. Apply Pythagoras.`;
 }else if(type===4){
  const nums=shuffle(shuffle(Array.from({length:12},(_,i)=>i+3)).slice(0,3).map(n=>n**3));
  const wrongNum=pick([6,10,12,14,15,17,18,20,21,22,24,26,28,30])**2;
  const vals=shuffle([...nums,wrongNum]);
  return {category:'Verbal Intelligence',question:'Odd one out: Three values are perfect cubes of positive integers. Which value does NOT belong?',options:vals.map(String),answer:vals.indexOf(wrongNum),explanation:'Three options are exact cubes; the exception is not a cube.'};
 }else{
  const a=randint(3,12),b=randint(4,16),m=randint(2,5),k=randint(1,8);
  const op=(x,y)=>m*x+y+k;
  const p=randint(4,12),q=randint(5,15),result=op(p,q);
  question=`A secret operation is defined by these examples: ${a} ◇ ${b} = ${op(a,b)}; ${a+2} ◇ ${b+3} = ${op(a+2,b+3)}; ${a+4} ◇ ${b+1} = ${op(a+4,b+1)}. Find ${p} ◇ ${q}.`;
  correct=result;wrong=[m*p+q,result+k,result-k,p+m*q+k,result+m];
  explanation=`The rule is x ◇ y = ${m}x + y + ${k}.`;
 }
 const choices=buildChoices(correct,wrong);if(!choices)return verbalGen(slot,salt+1);
 return {category:'Verbal Intelligence',question,...choices,explanation};
}
function gcd(a,b){return b?gcd(b,a%b):a}
function academicGen(slot,salt){
 const type=slot%6;
 let question,correct,wrong,explanation;
 if(type===0){
  const a=randint(5,22),b=a+randint(3,17);
  question=`The equation x² − ${a+b}x + ${a*b} = 0 has two real roots. What is the POSITIVE difference between its roots?`;
  correct=b-a;wrong=[a+b,b+a+1,b-a+2,b-a+4,a*b];explanation=`Factor it into (x−${a})(x−${b})=0.`;
 }else if(type===1){
  const a=randint(5,24),d=randint(3,10),n=randint(13,29),sum=n*(2*a+(n-1)*d)/2;
  question=`An arithmetic progression begins at ${a} and increases by ${d}. What is the sum of its first ${n} terms?`;
  correct=sum;wrong=[sum+n*d,sum-n*d,sum+a*n,sum-d*n*(n-1)/2,sum+d];explanation='Use Sₙ = n[2a + (n−1)d] / 2.';
 }else if(type===2){
  const n=randint(6,12),r=randint(3,7),b=randint(4,9),v=n*r+b;
  question=`Find the value of ${n} × (${r}² − ${r}) + ${b}² − ${b}.`;
  correct=n*(r*r-r)+b*b-b;wrong=[n*r*r+b*b,n*r*(r-1)+b*b,n*r*(r+1)+b*b-b,n*(r*r-r)+b*b+b];explanation='Apply brackets and order of operations carefully.';
 }else if(type===3){
  const red=randint(5,16),blue=randint(6,14),total=red+blue;
  const nu=red*(red-1),de=total*(total-1),d=gcd(nu,de),ns=nu/d,ds=de/d;
  question=`A bag contains ${red} red balls and ${blue} blue balls. Two are drawn without replacement. What is the probability that BOTH are red?`;
  correct=`${ns}/${ds}`;
  const vals=[[red*red,total*total],[red*(red-1),total*total],[red*(red+1),total*(total+1)],[red*(red-1),total*(total+1)],[red*(red-1),(total-1)*(total-2)]];
  wrong=vals.filter(([x,y])=>y).map(([x,y])=>{const g=gcd(x,y);return `${x/g}/${y/g}`});
  explanation=`(${red}/${total}) × (${red-1}/${total-1}) = ${correct}.`;
 }else if(type===4){
  const a=randint(2,6),r=randint(2,3),n=randint(6,9),sum=a*(r**n-1)/(r-1);
  question=`A geometric progression starts at ${a} and has common ratio ${r}. Find the sum of the first ${n} terms.`;
  correct=sum;wrong=[sum+a*r**(n-1),sum-a*r**(n-1),sum+a,sum-a,sum*r];explanation='Use Sₙ = a(rⁿ − 1)/(r−1).';
 }else{
  const n=randint(6,12),r=randint(2,4);let s=1;for(let j=0;j<r;j++)s*=n-j;
  question=`In how many ways can ${r} DISTINCT leadership posts be assigned to ${n} cadets, with no cadet holding two posts?`;
  correct=s;wrong=[s/r,s*r,n**r,s+n,s-2*n];explanation=`Order matters, so calculate ${n}P${r}.`;
 }
 const ch=buildChoices(correct,wrong);if(!ch)return academicGen(slot,salt+1);
 return {category:'Academic',question,...ch,explanation};
}
function maskSvg(mask){
 const dots=Array.from({length:9},(_,i)=>{
  const x=17+25*(i%3),y=17+25*Math.floor(i/3),on=(mask&(1<<i))!==0;
  return `<circle cx="${x}" cy="${y}" r="${on?7:2.4}" fill="${on?'#124d3b':'#d8e5da'}"/>`;
 }).join('');
 return 'svgraw:<svg viewBox="0 0 84 84" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="3" y="3" width="78" height="78" rx="10" fill="#fff" stroke="#cadbd0"/>'+dots+'</svg>';
}
const pop=n=>n.toString(2).replace(/0/g,'').length;
function rot(n){let r=0;for(let i=0;i<9;i++)if(n&(1<<i)){let x=i%3,y=Math.floor(i/3);r|=1<<(x*3+2-y)}return r}
function mirror(n){let r=0;for(let i=0;i<9;i++)if(n&(1<<i)){let x=i%3,y=Math.floor(i/3);r|=1<<(y*3+2-x)}return r}
function plausibleMask(){let n;do{n=randint(1,510)}while(pop(n)<3||pop(n)>7);return n}
function figureGen(slot,salt){
 const type=slot%4;
 if(type<2){
  const opname=pick(['XOR','OR','AND']);
  const op=(a,b)=>opname==='XOR'?a^b:opname==='OR'?a|b:a&b;
  let rows=[],tries=0;
  for(let j=0;j<3;j++){
   let a,b,c;do{a=plausibleMask();b=plausibleMask();c=op(a,b);tries++}
   while((pop(c)<2||pop(c)>8|| ((a^b)===(a|b))||((a|b)===(a&b))||((a^b)===(a&b)))&&tries<2000);
   rows.push([a,b,c]);
  }
  const ans=rows[2][2],wrong=[];
  while(wrong.length<3){let mask=ans^(1<<randint(0,8))^(Math.random()<.45?1<<randint(0,8):0);if(mask!==ans&&!wrong.includes(mask))wrong.push(mask)}
  const choices=shuffle([ans,...wrong]);
  const opts=choices.map(maskSvg);
  const figures=rows.flat().slice(0,8).map(maskSvg).concat('?');
  return {category:'Non-Verbal Intelligence',question:'Complete the 3×3 visual matrix. Determine the operation that combines the first two panels of each row.',visual:{mode:'matrix',figures},options:opts,answer:choices.indexOf(ans),explanation:'In each row, the third panel applies the same '+(opname==='XOR'?'exclusive-OR (dots in exactly one panel)':opname==='OR'?'union of lit dots':'intersection of lit dots')+' rule.'};
 }
 let m,rots,mirrored,tries=0;
 do{
  m=plausibleMask();rots=[m,rot(m),rot(rot(m)),rot(rot(rot(m)))];mirrored=mirror(m);tries++;
 }while((new Set(rots).size!==4||rots.includes(mirrored))&&tries<3000);
 if(type===2){
  const ans=rot(rot(rot(m))),dist=[mirror(ans),ans^1,ans^16,rot(rot(m))];
  const v=uniqueShuffle(dist.filter(x=>x!==ans)).slice(0,3);
  if(v.length<3)return figureGen(slot+4,salt+1);
  const options=shuffle([ans,...v]);
  return {category:'Non-Verbal Intelligence',question:'Study the visual sequence. Which figure continues the series?',visual:{mode:'sequence',figures:rots.slice(0,3).map(maskSvg).concat('?')},options:options.map(maskSvg),answer:options.indexOf(ans),explanation:'Each figure is rotated by 90° clockwise.'};
 }
 const rev=mirrored;
 const options=shuffle([rots[0],rots[1],rots[2],rev]);
 return {category:'Non-Verbal Intelligence',question:'Three figures are rotations of one another. Choose the single REFLECTION that cannot be produced by rotation alone.',options:options.map(maskSvg),answer:options.indexOf(rev),explanation:'The three other patterns are rotations; the selected figure is mirrored.'};
}

export { verbalGen, academicGen, figureGen };
