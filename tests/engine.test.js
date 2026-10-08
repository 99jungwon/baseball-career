const assert=require('node:assert/strict');
const E=require('../js/engine');
// A seed makes regressions reproducible without altering the live game's RNG.
for(let seed=1;seed<=100;seed++){
  const s=E.create('테스트','contact',seed);
  for(let year=1;year<=50;year++){
    assert.equal(s.year,year);
    assert.ok(E.valid(s));
    E.autoSeason(s);
    assert.ok(E.valid(s));
    const t=s.totals;
    assert.equal(t.pa,t.ab+t.bb);
    assert.ok(t.h<=t.ab);
    assert.ok(t.hr+t.doubles+t.triples<=t.h);
    assert.ok(t.games<=128);
    assert.equal(s.team.wins+s.team.losses,128);
    assert.equal(s.seasons.length,year);
    assert.ok(s.stats.energy>=0&&s.stats.energy<=100);
    if(s.phase==='retired')break;
    const proposals=E.offers(s);
    E.offseason(s,s.contract===0?proposals.at(-1).id:'stay',true);
    assert.equal(s.phase,'train');
  }
  assert.equal(s.phase,'retired');
  assert.equal(s.retirementReason,'no-offers');
  assert.equal(E.offers(s).length,0);
  const career=E.career(s);
  assert.equal(career.totals.h,s.seasons.reduce((n,y)=>n+y.totals.h,0));
  assert.equal(s.earnings,s.seasons.reduce((n,y)=>n+y.salary,0));
  assert.ok(career.best&&career.title);
  assert.equal(E.offseason(s,'stay',true),false);
}
const s=E.create('수동 플레이','power',42);
assert.equal(E.simulate(s),false);
assert.equal(E.choose(s,'patient'),false);
assert.equal(E.train(s,'invalid'),false);
s.potential.contact=99; // far below the ceiling: full training effect
const before=s.stats.contact;
E.train(s,'contact',100);
assert.equal(s.stats.contact,before+6);
assert.equal(E.train(s,'contact',100),false);
assert.equal(E.choose(s,'invalid'),false);
E.choose(s,'patient');
assert.equal(s.phase,'ready');
assert.equal(E.choose(s,'patient'),false);
E.simulate(s);
assert.equal(E.simulate(s),false);
const copy=JSON.parse(JSON.stringify(s));
assert.ok(E.valid(copy));
E.autoSeason(copy);
assert.equal(copy.history.length,8);
assert.equal(copy.seasons.length,1);
assert.equal(copy.history[0].choice,'출루로 기회를 만들겠습니다');
while(copy.age<30&&copy.phase!=='retired'){E.offseason(copy,copy.contract===0?E.offers(copy)[0].id:'stay',false);E.autoSeason(copy);}
assert.equal(copy.age,30);
E.offseason(copy,'retire',false);
assert.equal(copy.phase,'retired');
assert.equal(copy.seasons.length,12);
assert.ok(E.valid(copy));
const rebuild=E.create('폼 교정','balanced',100);
rebuild.round=2;rebuild.stats.energy=80;
rebuild.history=[{line:{ab:40,h:4,bb:0},training:'투구 분석',injured:false},{line:{ab:40,h:5,bb:0},training:'투구 분석',injured:false}];
for(let seed=1;seed<100;seed++){rebuild.seed=seed;rebuild.adviceMemory={};E.prepareRound(rebuild);if(E.event(rebuild)?.id==='slump')break;}
assert.equal(E.event(rebuild).id,'slump');
const cached=JSON.stringify(E.event(rebuild)),seedBefore=rebuild.seed;
E.event(rebuild);assert.equal(rebuild.seed,seedBefore);assert.equal(JSON.stringify(E.event(rebuild)),cached);
E.train(rebuild,'rest');E.choose(rebuild,'rebuild');E.simulate(rebuild);E.advance(rebuild);
const oldContact=rebuild.stats.contact;
E.train(rebuild,'rest');if(rebuild.phase==='event')E.choose(rebuild,E.event(rebuild).options[0].id);
const result=E.simulate(rebuild);
assert.ok(rebuild.stats.contact>oldContact);
assert.ok(result.notes.some(n=>n.includes('타격폼')));
assert.equal(E.valid({}),false);
// Age alone must never disqualify an elite veteran.
const veteran=E.create('정상급 노장','power',99);
veteran.age=43;veteran.year=25;veteran.contract=0;
veteran.totals={games:116,pa:464,ab:400,h:135,doubles:25,triples:1,hr:30,bb:64,rbi:110,sb:1};
veteran.stats.field=40;veteran.stats.trust=85;
assert.ok(E.offers(veteran).length>=2);
const struggling=structuredClone(veteran);
struggling.age=27;struggling.year=9;
struggling.totals={games:45,pa:180,ab:160,h:25,doubles:3,triples:0,hr:1,bb:20,rbi:10,sb:0};
assert.equal(E.offers(struggling).length,0);
struggling.phase='offseason';
assert.equal(E.offseason(struggling,'move',false),false);
console.log('PASS: 100 careers through contract-loss retirement; stat invariants; manual flow; save round-trip; voluntary retirement; branches; elite 43-year-old offers; younger-player rejection.');
// Profile, new school career and every route.
const school=E.create('고교 선수','contact',7,{school:true,number:99,throws:'L',bats:'S',preferredClub:'수원 레드폭스'});
assert.equal(school.age,18);assert.equal(school.number,99);assert.equal(E.handLabel(school),'좌투양타');
E.autoSeason(school);assert.equal(school.team.wins+school.team.losses,32);assert.ok(E.valid(school));
assert.equal(school.phase,'offseason');
E.offseason(school,'college',false);assert.equal(school.level,'college');assert.equal(school.stageYear,1);
for(let grade=1;grade<=4;grade++){E.autoSeason(school);assert.equal(school.team.wins+school.team.losses,48);assert.ok(E.valid(school));if(grade<4)E.offseason(school,'college',false);}
assert.ok(!E.routeOffers(school).some(o=>o.id==='college'));
E.offseason(school,'draft',false);assert.equal(school.level,'pro');assert.equal(school.age,23);assert.ok(E.valid(school));
const american=E.create('해외 도전','power',123,{school:true,number:0,throws:'R',bats:'L'});
for(const k of ['contact','power','eye'])american.stats[k]=95;
E.autoSeason(american);assert.ok(E.routeOffers(american).some(o=>o.id==='usa'));
E.offseason(american,'usa',false);assert.equal(american.level,'minor');assert.equal(american.stageYear,1);
E.autoSeason(american);E.offseason(american,'mlb',false);assert.equal(american.league,'MLB');assert.equal(american.level,'pro');assert.ok(E.valid(american));
const direct=E.create('국내 지명','contact',15,{school:true,number:7});E.autoSeason(direct);
assert.ok(E.routeOffers(direct).some(o=>o.id==='draft'));E.offseason(direct,'draft',false);assert.equal(direct.age,19);assert.equal(direct.level,'pro');
const legacy=E.create('기존 저장','contact',3);delete legacy.systems;delete legacy.number;delete legacy.startAge;delete legacy.level;delete legacy.roundEvent;
legacy.phase='event';const migrated=E.migrate(JSON.parse(JSON.stringify(legacy)));assert.equal(migrated.number,27);assert.ok(E.event(migrated));assert.equal(migrated.age,19);assert.ok(E.valid(migrated));
// Critical fatigue always gets a warning, but a cooldown prevents repeated dialogue.
const tired=E.create('피로 선수','contact',5);tired.round=3;tired.stats.energy=15;E.prepareRound(tired);
assert.equal(tired.advice.recommend,'rest');assert.equal(tired.advice.id,'fatigue');
tired.round++;E.prepareRound(tired);assert.equal(tired.advice.id,'critical');assert.equal(tired.roundEvent,null);
const beforeLight=E.trainingEffect(tired,'contact');tired.trainingIntensity='light';assert.ok(Math.abs(E.trainingEffect(tired,'contact').energy)<Math.abs(beforeLight.energy));
assert.equal(E.fitness(60).penalty,0);assert.equal(E.fitness(39).risk,.14);assert.equal(E.fitness(24).risk,.28);
const profiles=new Set();let quiet=0;
for(let seed=1;seed<=100;seed++){const p=E.create('다양성','contact',seed*79843);p.round=2;p.history=[{line:{ab:40,h:16,bb:4,games:16},training:'투구 분석'}];E.prepareRound(p);if(p.advice)profiles.add(p.advice.id);else quiet++;}
assert.ok(profiles.size>=2);assert.ok(quiet>0);
console.log('PASS: profile settings; high school / four college years / draft / USA minors / MLB; old-save migration; advice eligibility / cooldown / stable rendering; fatigue thresholds; training intensity.');
for (let seed=1;seed<=20;seed++) {
  const p=E.create('고교부터 은퇴','balanced',seed*8765,{school:true});
  let seasons=0;
  while(p.phase!=='retired'&&seasons++<100){
    E.autoSeason(p);assert.ok(E.valid(p));if(p.phase==='retired')break;
    const deal=p.level==='pro'?(p.contract?'stay':E.offers(p)[0].id):E.routeOffers(p).find(o=>o.id==='draft'||o.id==='mlb')?.id||E.routeOffers(p)[0].id;
    assert.ok(E.offseason(p,deal,false));
  }
  assert.equal(p.phase,'retired');assert.equal(p.retirementReason,'no-offers');
}
const minor=E.create('마이너 장기 도전','balanced',541,{school:true});
minor.level='minor';minor.league='마이너';minor.club='선버즈 산하팀';minor.salary=2400;
let minorYears=0;
while(minor.phase!=='retired'&&minorYears++<100){E.autoSeason(minor);if(minor.phase==='retired')break;const deal=minor.level==='minor'?(E.routeOffers(minor).some(o=>o.id==='minor')?'minor':'domestic'):(minor.contract?'stay':E.offers(minor)[0].id);assert.ok(E.offseason(minor,deal,false));assert.ok(E.valid(minor));}
assert.equal(minor.phase,'retired');assert.equal(minor.retirementReason,'no-offers');
console.log('PASS: 20 high-school-to-retirement careers; lifelong minor-league path ages and ends when every offer disappears.');
const posting=E.create('해외 진출','contact',88);posting.phase='offseason';posting.round=8;posting.age=25;posting.year=7;
posting.seasons=Array.from({length:6},(_,i)=>({year:i+1,age:i+19,level:'pro',league:'국내 프로',totals:{games:110}}));
posting.totals={games:120,pa:500,ab:440,h:145,doubles:30,triples:2,hr:27,bb:60,rbi:90,sb:9};posting.stats.trust=85;
assert.ok(E.postingStatus(posting).eligible);assert.equal(E.transferOptions(posting)[0].id,'posting-mlb');
const rejected=structuredClone(posting);rejected.stats.trust=40;assert.equal(E.offseason(rejected,'posting-mlb',false),false);assert.match(E.postingStatus(rejected).reason,/거부/);
const early=structuredClone(posting);early.seasons=early.seasons.slice(0,5);assert.equal(E.postingStatus(early).eligible,false);
const noUsa=structuredClone(posting);noUsa.totals.h=60;noUsa.totals.hr=0;noUsa.totals.doubles=3;assert.match(E.postingStatus(noUsa).reason,/제안이 없습니다/);
assert.ok(E.offseason(posting,'posting-mlb',false));assert.equal(posting.league,'MLB');assert.equal(posting.contract,3);assert.equal(posting.age,26);assert.ok(E.valid(posting));
E.autoSeason(posting);assert.equal(E.transferOptions(posting).length,0);posting.contract=0;
posting.totals={games:120,pa:500,ab:440,h:120,doubles:20,triples:2,hr:15,bb:60,rbi:70,sb:4};
assert.ok(E.transferOptions(posting).some(o=>o.id==='return-kbo'));assert.ok(E.offseason(posting,'return-kbo',false));assert.equal(posting.league,'국내 프로');assert.equal(posting.contract,2);assert.ok(E.valid(posting));
const minorReturn=E.create('미국 복귀','contact',92);minorReturn.level='minor';minorReturn.league='마이너';E.autoSeason(minorReturn);assert.ok(E.routeOffers(minorReturn).some(o=>o.id==='domestic'));assert.ok(E.offseason(minorReturn,'domestic',false));assert.equal(minorReturn.league,'국내 프로');
console.log('PASS: KBO posting eligibility / club rejection / no USA offer / MLB transfer; contract-bound MLB return; minor return to KBO.');

// Potential: same seed rolls the same ceilings; reroll only before the first training.
const potA=E.create('잠재력','balanced',777,{school:true}),potB=E.create('잠재력','balanced',777,{school:true});
assert.deepEqual(potA.potential,potB.potential);
for(const k of ['contact','power','eye','speed','field'])assert.ok(potA.potential[k]>=potA.stats[k]+6&&potA.potential[k]<=99);
const rerolled=E.reroll(potA,778);assert.ok(rerolled&&rerolled.rerolls===1&&rerolled.number===potA.number&&rerolled.position===potA.position);
E.train(potA,'contact');assert.equal(E.canReroll(potA),false);assert.equal(E.reroll(potA,779),null);
// Past the ceiling growth slows, and stops at the breakthrough limit.
const capped=E.create('한계','contact',31,{school:true});capped.potential.contact=capped.stats.contact;
const slow=E.trainingEffect(capped,'contact');assert.ok(E.preview(capped,slow).contact<slow.contact);
capped.stats.contact=E.limit(capped,'contact');assert.equal(E.preview(capped,slow).contact,0);
// Old saves without potential get ceilings no lower than current ability.
const unrolled=E.create('옛 저장','power',55);delete unrolled.potential;unrolled.stats.contact=97;assert.ok(E.migrate(unrolled).potential.contact>=97);
console.log('PASS: potential determinism / reroll window / ceiling slowdown / breakthrough limit / legacy migration.');

// Season plan + auto-until-key: stops at special rounds, key events and season end only.
const planned=E.create('계획','power',2024,{school:true});
assert.equal(E.plan(planned).focus,'power');E.setPlan(planned,'contact','light');assert.deepEqual([planned.plan.focus,planned.plan.intensity],['contact','light']);
let stop=E.autoUntilKey(planned);
assert.ok(['special','event'].includes(stop.reason));if(stop.reason==='special')assert.ok(E.isSpecial(planned)&&planned.round===1&&planned.phase==='train');
let guardStops=0;while(['train','event','ready','result'].includes(planned.phase)&&guardStops++<20){
  if(planned.phase==='event'){assert.ok(E.isKeyEvent(E.event(planned)));E.choose(planned,E.event(planned).options[0].id);}
  stop=E.autoUntilKey(planned);
}
assert.equal(stop.reason,'season-end');assert.equal(planned.phase,'offseason');assert.equal(planned.history.length,8);
// Special rounds pay more for the same drill score.
const sp=E.create('특훈','contact',8,{school:true});sp.potential.contact=99;
const normal=E.trainingEffect(sp,'contact',100).contact;sp.round=1;const special=E.trainingEffect(sp,'contact',100).contact;
assert.ok(special>normal,`special ${special} > normal ${normal}`);
console.log('PASS: season plan / auto-until-key stops / special training reward.');
