const assert=require('node:assert/strict');
const E=require('./engine'),L=require('./league'),C=require('./collection');
for(let seed=1;seed<=30;seed++){
  const s=E.create('리그검증','balanced',seed,{position:Object.keys(E.positions)[seed%9]});
  const a=JSON.parse(JSON.stringify(s));E.autoSeason(s);E.autoSeason(a);
  assert.deepEqual(s,a,'same seed and choices reproduce the whole league');
  const l=s.leagueState;
  assert.equal(l.players.length,90);assert.equal(new Set(l.players.map(p=>p.id)).size,90);
  assert.equal(l.teams.length,10);assert.equal(l.days,128);
  assert.equal(l.teams.reduce((n,t)=>n+t.wins,0),640);
  assert.equal(l.teams.reduce((n,t)=>n+t.losses,0),640);
  for(const t of l.teams)assert.equal(t.wins+t.losses,128);
  const team=l.teams.find(t=>t.club===s.club);assert.equal(team.wins,s.team.wins);assert.equal(team.losses,s.team.losses);
  assert.deepEqual(l.players.find(p=>p.id==='user').totals,s.totals);
  for(const p of l.players){const t=p.totals;assert.equal(t.pa,t.ab+t.bb);assert.ok(t.h<=t.ab);assert.ok(t.hr+t.doubles+t.triples<=t.h);assert.ok(t.games<=128);}
  const qualified=L.leaders(l,'avg');assert.ok(qualified.every(p=>p.totals.pa>=397));
  assert.deepEqual(l.awards.filter(a=>a.title==='타격왕').map(a=>a.playerId).sort(),qualified.filter(p=>p.rank===1).map(p=>p.id).sort());
  assert.equal(l.awards.filter(a=>a.title.startsWith('골든글러브')).length,9);
  assert.equal(l.postseason.length,4);assert.equal(l.champion,l.postseason[3].winner);
  assert.ok(L.standings(l).slice(0,5).some(t=>t.club===l.champion));
  assert.equal(s.awards.some(a=>a.title==='한국시리즈 우승'),l.champion===s.club);
  assert.deepEqual(s.seasons[0].leagueSnapshot,l);
  const before=JSON.stringify(l);L.finish(s);assert.equal(JSON.stringify(l),before,'awards and playoffs never reroll');
  const history=JSON.stringify(s.seasons[0]);E.offseason(s,'stay',false);assert.equal(s.leagueState.days,0);assert.equal(JSON.stringify(s.seasons[0]),history);
}
// A mid-season v0.3 save keeps its player stats and team record after upgrade.
const old=E.create('이전선수','contact',700);
for(let i=0;i<3;i++){E.train(old,'contact');if(old.phase==='event')E.choose(old,E.event(old).options[0].id);E.simulate(old);E.advance(old);}
old.club='서울 그린웨이브';delete old.leagueState;delete old.worldSeed;delete old.careerId;
const original=JSON.stringify({totals:old.totals,team:old.team,history:old.history,seed:old.seed});
const migrated=E.migrate(old);assert.equal(migrated.club,'LG 트윈스');assert.equal(migrated.leagueState.days,48);
assert.equal(JSON.stringify({totals:old.totals,team:old.team,history:old.history,seed:old.seed}),original);
assert.equal(migrated.leagueState.teams[0].wins,old.team.wins);
assert.equal(migrated.leagueState.reconstructed,true);
const after=JSON.stringify(migrated);E.migrate(migrated);assert.equal(JSON.stringify(migrated),after);
E.autoSeason(migrated);assert.equal(migrated.leagueState.days,128);
// Old finalized seasons aren't given invented league snapshots on load.
delete migrated.leagueState;delete migrated.seasons[0].leagueSnapshot;
E.migrate(migrated);assert.equal(migrated.leagueState,undefined);assert.equal(migrated.seasons[0].leagueSnapshot,undefined);
// Archiving is idempotent and independent from new active careers.
const retired=E.create('보관선수','power',904,{position:'C'});E.autoSeason(retired);retired.phase='retired';retired.retirementReason='voluntary';
const collection=C.empty();assert.equal(C.archive(collection,E.create('현역','contact',2),E.career(retired)),false);
assert.equal(C.archive(collection,retired,E.career(retired)),true);assert.equal(C.archive(collection,retired,E.career(retired)),true);assert.equal(collection.players.length,1);
assert.equal(C.assign(collection,0,retired.careerId),true);assert.equal(C.assign(collection,1,retired.careerId),false);assert.equal(C.assign(collection,1,'missing'),false);
assert.equal(C.move(collection,0,1),true);assert.equal(collection.lineup[1].playerId,retired.careerId);assert.equal(C.valid(collection),true);
const saved=JSON.stringify(collection);E.create('다음선수','contact',905);assert.equal(JSON.stringify(collection),saved);assert.equal(C.valid(JSON.parse(saved)),true);
retired.totals.h=9999;assert.notEqual(collection.players[0].totals.h,9999);
const tied=E.create('동률검증','contact',991);E.autoSeason(tied);tied.leagueState.players[0].totals.hr=999;tied.leagueState.players[1].totals.hr=999;
assert.equal(L.leaders(tied.leagueState,'hr').filter(p=>p.rank===1).length,2);
console.log('PASS: 30 deterministic ten-team seasons; conserved wins/losses; player stats; qualified leaders; awards; playoffs; snapshots; old-save migration; independent archive; duplicate prevention; lineup persistence.');
