(function (root) {
  'use strict';
  const L=typeof module!=='undefined'?require('./league'):root.BaseballLeague;
  const KEY = 'last-inning-save-v1';
  const labels = {contact:'컨택',power:'장타',eye:'선구안',speed:'주루',field:'수비',energy:'체력',morale:'자신감',trust:'감독 신뢰'};
  const stages = ['개막의 설렘','주전의 조건','흔들리는 타격폼','여름의 문턱','한여름의 승부','순위 경쟁','마지막 스퍼트','가을을 향해'];
  const months = ['3월 하순','4월','5월','6월','7월','8월','9월 초','9월 말'];
  const types = {
    contact:{name:'정교한 교타자',desc:'꾸준히 안타를 쌓는 타석의 설계자',contact:61,power:40,eye:56,speed:49,field:47},
    power:{name:'한 방의 거포',desc:'한 번의 스윙으로 경기를 바꾸는 해결사',contact:45,power:65,eye:44,speed:39,field:46},
    balanced:{name:'만능 유망주',desc:'공격과 수비, 어느 쪽도 놓치지 않는 선수',contact:51,power:49,eye:49,speed:56,field:58}
  };
  const trainings = {
    contact:{name:'타격 케이지',subtitle:'흔들림 없는 나만의 스윙',icon:'◎',effect:{contact:3,energy:-5},mini:true},
    power:{name:'웨이트 트레이닝',subtitle:'담장 너머를 향한 힘',icon:'↗',effect:{power:4,energy:-8}},
    eye:{name:'투구 분석',subtitle:'좋은 공을 기다리는 여유',icon:'◉',effect:{eye:3,morale:2,energy:-4}},
    field:{name:'수비와 주루',subtitle:'팀에 필요한 한 걸음',icon:'◇',effect:{field:3,speed:2,energy:-6},mini:true},
    rest:{name:'회복에 집중',subtitle:'길게 뛰기 위한 하루',icon:'☀',effect:{energy:24,morale:4}}
  };
  function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,n));}
  function create(name,type='contact',seed=Date.now(),profile={}){
    if(!types[type]) type='contact';
    const t=types[type];
    const s={version:2,name:(String(name).trim()||'김루키').slice(0,12),type,seed:seed>>>0,age:19,year:1,club:L.clubs[0],salary:3200,contract:3,earnings:0,international:0,awards:[],seasons:[],round:0,phase:'train',stats:{contact:t.contact,power:t.power,eye:t.eye,speed:t.speed,field:t.field,energy:86,morale:64,trust:42},totals:{games:0,pa:0,ab:0,h:0,doubles:0,triples:0,hr:0,bb:0,rbi:0,sb:0},team:{wins:0,losses:0},flags:{},history:[],journal:[],training:null,pending:null};
    s.number=Number.isInteger(Number(profile.number))?clamp(Number(profile.number),0,99):27;
    s.throws=profile.throws==='L'?'L':'R';s.bats=['R','L','S'].includes(profile.bats)?profile.bats:s.throws;
    s.level=profile.school?'high':'pro';s.startAge=profile.school?18:19;s.age=s.startAge;s.stageYear=1;s.league=profile.school?'고교':'국내 프로';s.preferredClub=L.clubs.includes(L.normalize(profile.preferredClub))?L.normalize(profile.preferredClub):L.clubs[0];
    s.position=L.positions[profile.position]?profile.position:'RF';s.worldSeed=seed>>>0;s.careerId=`career-${seed}-${encodeURIComponent(s.name)}`;
    if(profile.school){s.club='한빛고';s.salary=0;s.contract=0;}
    s.potential=rollPotential(s,seed>>>0);s.growthCarry={};
    s.rival={name:'이도윤',ab:0,h:0,hr:0};s.systems=3;s.adviceMemory={};s.advice=null;s.roundEvent=null;prepareRound(s);L.ensure(s);return s;
  }
  function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
  const skills=['contact','power','eye','speed','field'];
  // Hidden ceilings rolled from their own stream so the career RNG stays reproducible.
  function rollPotential(s,seed){
    const r={seed:(seed^0x9e3779b9)>>>0},talent=random(r),pot={};
    for(const k of skills){const roll=.6*talent+.4*random(r);pot[k]=clamp(Math.round(s.stats[k]+4+34*Math.pow(roll,1.4)),s.stats[k]+6,99);}
    pot.longevity=Math.floor(random(r)*6)-2;pot.awakened={};
    return pot;
  }
  // Rerolling is only offered before the first training, so it never discards played progress.
  function canReroll(s){return s.year===1&&s.round===0&&s.phase==='train'&&!s.history.length&&!s.training&&!s.seasons.length;}
  function reroll(s,seed){if(!canReroll(s))return null;const next=create(s.name,s.type,seed,{school:s.level==='high',number:s.number,throws:s.throws,bats:s.bats,preferredClub:s.preferredClub,position:s.position});next.rerolls=(s.rerolls||0)+1;return next;}
  function potentialGrade(v){return v>=92?'S':v>=85?'A':v>=78?'B':v>=70?'C':'D';}
  // Scouts see a range; it narrows as more seasons are played.
  function scout(s){
    const p=s.potential;if(!p)return null;const spread=Math.max(2,8-s.seasons.length*1.5);
    const rows=skills.map(k=>({id:k,label:labels[k],value:p[k],low:clamp(Math.round(p[k]-spread),0,99),high:clamp(Math.round(p[k]+spread),0,99),grade:potentialGrade(p[k])}));
    const overall=Math.round(skills.reduce((n,k)=>n+p[k],0)/5);
    return{rows,overall,grade:potentialGrade(overall),spread:Math.round(spread),grit:Math.round(grit(s)*100),longevity:s.seasons.length>=6?(p.longevity>=2?'꾸준함':p.longevity<=-1?'짧은 전성기':'보통'):'미확인'};
  }
  // Lower overall ceilings break through their limit faster, so effort can still chase awards.
  function grit(s){const p=s.potential;if(!p)return 0;return clamp((84-skills.reduce((n,k)=>n+p[k],0)/5)/60,0,.25);}
  function growthFactor(s,k,before){
    const p=s.potential;if(!p)return before>=85?.35:before>=70?.65:1;
    const gap=p[k]-before,age=s.age-(p.longevity||0);
    // Training can slow aging but not erase it.
    const ageFactor=age>=39?.2:age>=36?.35:age>=33?.55:age>=30?.8:1;
    if(gap>=15)return ageFactor;if(gap>=6)return .7*ageFactor;if(gap>0)return .45*ageFactor;
    return before<limit(s,k)?.25*ageFactor:0;
  }
  // Past the ceiling, effort still pays up to a breakthrough limit that is wider for low-ceiling players.
  function limit(s,k){const p=s.potential;return p?Math.min(99,p[k]+2+Math.round(grit(s)*32)):100;}
  function preview(s,e){const out={};for(const [k,v] of Object.entries(e)){if(k in s.stats){const before=s.stats[k];let gain=v;if(v>0&&skills.includes(k)){const exact=v*growthFactor(s,k,before)+(s.growthCarry?.[k]||0);gain=s.potential?Math.floor(exact+1e-9):Math.ceil(v*growthFactor(s,k,before));}out[k]=clamp(before+gain)-before;}}return out;}
  function apply(s,e){
    const out=preview(s,e);
    if(s.potential){s.growthCarry??={};for(const [k,v] of Object.entries(e))if(v>0&&skills.includes(k)&&k in out){const exact=v*growthFactor(s,k,s.stats[k])+(s.growthCarry[k]||0);s.growthCarry[k]=s.stats[k]+out[k]>=100?0:Math.max(0,exact-out[k]);}}
    for(const [k,v] of Object.entries(out))s.stats[k]+=v;return out;
  }
  function trainingEffect(s,id,score=0){
    const t=trainings[id],effect={...t.effect};
    if(id==='field'){effect.speed+=Math.floor(clamp(Number(score)||0)/40);}
    if(id==='contact'){score=clamp(Number(score)||0,0,100);effect.contact+=Math.floor(score/30);if(score>=70)effect.morale=3;}
    if(s.age>=32){for(const k of ['contact','power','field','speed'])if(effect[k])effect[k]=Math.max(1,Math.floor(effect[k]*(s.age>=40?.65:.8)));}
    if(id==='rest'&&s.age>=35)effect.energy=s.age>=40?20:22;
    if(id!=='rest'){
      const factor=s.trainingIntensity==='light'?.65:s.trainingIntensity==='hard'?1.4:1;
      for(const k of Object.keys(effect))effect[k]=Math.sign(effect[k])*Math.max(1,Math.round(Math.abs(effect[k])*factor));
    }
    return effect;
  }
  function train(s,id,score=0){
    if(s.phase!=='train'||!trainings[id])return false;
    const t=trainings[id],effect=trainingEffect(s,id,score);
    const changes=apply(s,effect);s.training=id;s.phase='event';
    if(s.systems===3&&!s.roundEvent){s.phase='ready';s.pending={event:'일상의 훈련',choice:'계획한 루틴을 이어간다',changes:{},option:{}};}
    s.journal.push({round:s.round,title:t.name,body:id==='contact'&&score>0?`집중 훈련 ${Math.round(score)}점. 스윙의 감각을 기억했다.`:'계획한 훈련을 마쳤다.',changes});
    return changes;
  }
  function option(id,title,desc,effect,extra={}){return{id,title,desc,effect,...extra};}
  function legacyEvent(s){
    const st=s.stats,f=s.flags;
    const events=[
      {tag:'COACH’S OFFICE',person:'박성훈 · 타격 코치',title:'신인의 첫 타석, 어떤 선수로 기억될까?',body:'“잘하는 걸 먼저 보여줘. 출루하는 타자인지, 한 방이 있는 타자인지.” 코치가 개막 시리즈의 역할을 묻는다.',options:[option('patient','출루로 기회를 만들겠습니다','볼넷과 정교한 타격에 집중한다.',{eye:3,trust:4},{flag:'patient',style:'출루형'}),option('slugger','과감하게 제 스윙을 하겠습니다','장타력을 끌어올리고 큰 타구를 노린다.',{power:4,morale:4},{flag:'slugger',style:'장타형'})]},
      {tag:'LINEUP CHANGE',person:'박성훈 · 타격 코치',title:'좌익수 자리, 한번 해볼래?',body:'주전 좌익수가 햄스트링 통증으로 빠졌다. 익숙한 우익수 자리를 지킬지, 새 포지션에서 기회를 잡을지 결정해야 한다.',options:[option('versatile','좌익수로도 뛰어보겠습니다','출전 기회가 늘지만 적응에 체력이 든다.',{trust:9,field:2,energy:-10},{flag:'versatile',appearances:3}),option('own','우익수 경쟁에 집중하겠습니다','기본기를 다지고 원래 자리의 경쟁을 이어간다.',{contact:3,field:4,energy:3},{flag:'own'})]},
      {tag:'BATTING LAB',person:'윤태오 · 주장',title:f.patient?'공을 너무 기다리는 건 아닐까?':'크게 휘두를수록 커지는 빈틈',body:f.patient?'출루를 우선한 뒤 볼넷은 늘었지만, 좋은 초구까지 흘려보내고 있다. 주장이 타격폼을 조금 바꿔보자고 한다.':'상대가 약점을 분석하기 시작했다. 몸쪽 빠른 공에 배트가 밀린다. 주장이 타격폼 교정을 제안한다.',options:[option('rebuild','타격폼을 교정한다','이번 구간은 적응으로 타격 저하. 다음 구간에 컨택 성장(현재 능력에 따라 최대 +6).',{energy:-6,morale:-4},{flag:'rebuild',performance:-.035}),option('keep','내 스윙을 믿는다','당장의 자신감을 지키고 익숙한 타격을 다듬는다.',{contact:2,morale:7},{flag:'keep'})]},
      {tag:'CLUBHOUSE',person:'윤태오 · 주장',title:f.versatile?'새 포지션의 첫 실책':'끝나지 않는 주전 경쟁',body:f.versatile?'좌익수로 나선 경기에서 뜬공을 놓쳤다. 더그아웃에 들어온 네게 주장이 다가온다. “혼자 해결하려고 하지 마.”':'선발 명단에 네 이름 대신 동기 이름이 올랐다. 훈련을 마친 주장이 함께 수비 연습을 하자고 한다.',options:[option('mentor','주장에게 도움을 청한다','수비와 신뢰를 쌓는다. 후반기에 조언을 받을 수 있다.',{field:5,trust:5,energy:-5},{flag:'mentor'}),option('solo','개인 타격 훈련을 더 한다','공격에서 확실한 존재감을 만들겠다고 다짐한다.',{contact:3,power:3,energy:-11},{flag:'solo'})]},
      {tag:'MEDICAL ROOM',person:'이서연 · 트레이너',title:st.energy<55?'몸이 먼저 신호를 보냈다':'긴 여름을 버티는 방법',body:st.energy<55?'스윙 뒤 옆구리가 뻐근하다. 트레이너는 훈련량을 줄이자고 한다. 지금의 체력으로 강행하면 결장할 위험이 있다.':'무더위 속 연전이 시작된다. 트레이너가 회복 계획을 가져왔다. 좋은 컨디션을 유지할지, 더 많은 출전을 노릴지 정해야 한다.',options:[option('recover','회복 프로그램을 따른다','이번 구간 출전 3경기 감소. 체력을 크게 회복한다.',{energy:25,morale:3},{flag:'recovered',appearances:-3}),option('push','출전을 이어간다','신뢰와 출전 기회 증가. 낮은 체력에서는 결장 위험.',{energy:-13,trust:8},{flag:'pushed',appearances:2})]},
      {tag:'PENNANT RACE',person:'김도현 · 감독',title:f.mentor?'주장이 건넨 상대 분석 노트':'승부처에서 맡겨진 역할',body:f.mentor?'함께 훈련했던 주장이 상대 투수의 습관을 정리해줬다. “이번 시리즈, 네가 해줄 거라고 믿는다.”':'팀이 가을야구 진출을 놓고 경쟁 중이다. 감독은 네게 다음 시리즈의 타석 접근법을 정해달라고 한다.',options:[option('team','출루와 연결에 집중한다','선구안과 팀 승리 확률이 올라간다.',{eye:f.mentor?5:3,trust:5},{flag:'teamplayer',teamBonus:.1}),option('hero','내가 해결하겠습니다','장타와 자신감을 높여 타점 기회를 노린다.',{power:4,morale:6,energy:-5},{flag:'hero',rbiBonus:3})]},
      {tag:'SPOTLIGHT',person:'구단 홍보팀',title:'첫 인터뷰, 카메라가 너를 향한다',body:'신인 선수 특집 인터뷰 제안이 왔다. 팬들에게 이름을 알릴 기회지만, 원정과 촬영 사이에서 개인 훈련 시간을 조정해야 한다.',options:[option('interview','팬들에게 내 이야기를 전한다','자신감 상승. 시즌 평가에 팬들의 기대가 반영된다.',{morale:10,energy:-7},{flag:'fans'}),option('focus','이번에는 훈련에 집중한다','컨택과 선구안을 다듬으며 시즌을 마무리한다.',{contact:3,eye:3},{flag:'focus'})]},
      {tag:'FINAL STRETCH',person:'김도현 · 감독',title:'마지막 16경기, 어떤 끝을 만들까?',body:`팀은 현재 ${s.team.wins}승 ${s.team.losses}패. ${st.trust>=65?'감독은 이제 너를 믿고 타선을 맡긴다.':'아직 증명할 기회가 남아 있다.'} 긴 시즌의 마지막 방향을 정할 시간이다.`,options:[option('allin','남은 힘을 모두 쏟는다','출전과 타격 집중도 증가. 체력이 낮으면 결장 위험.',{energy:-12,morale:7,trust:4},{flag:'allin',appearances:2,performance:.015}),option('steady','끝까지 내 페이스를 지킨다','체력을 회복하고 안정적으로 마지막 경기를 준비한다.',{energy:12,eye:2},{flag:'steady'})]}
    ];
    if(s.year>1){
      events[0]={tag:'SPRING CAMP',person:'김도현 · 감독',title:s.age>=32?'베테랑의 봄, 역할을 다시 정하다':'올해는 어떤 타자로 뛸까?',body:`${s.club}에서 맞는 ${s.year}년 차. ${s.age>=32?'타석에서의 경험은 늘었지만, 몸의 회복 속도는 예전 같지 않다.':'지난 시즌의 기록은 이제 출발점이다.'} 감독과 올해의 타격 방향을 정한다.`,options:[option('patient','출루로 타선을 연결한다','선구안과 감독 신뢰를 높인다.',{eye:3,trust:4},{flag:'patient',style:'출루형'}),option('slugger','중심 타선의 해결사를 맡는다','장타와 자신감을 키운다.',{power:4,morale:4},{flag:'slugger',style:'장타형'})]};
      events[1]={tag:'LINEUP CHANGE',person:'김도현 · 감독',title:s.age>=30?'체력 안배와 선발 출전 사이':'주전 자리를 지키는 일',body:s.age>=30?'감독이 지명타자 출전을 섞자고 제안한다. 수비 부담을 줄일 수 있지만, 매일 수비에 나서는 리듬을 포기해야 한다.':'성장한 후배가 같은 포지션에서 경쟁하고 있다. 감독은 수비 범위를 넓히면 더 많은 기회를 줄 수 있다고 한다.',options:s.age>=30?[option('dh','지명타자와 수비를 병행한다','체력을 아끼고 타격에 집중한다.',{energy:16,power:2},{flag:'dh'}),option('versatile','수비도 계속 책임진다','출전 기회와 감독 신뢰 증가. 체력 소모.',{trust:6,field:2,energy:-10},{flag:'versatile',appearances:2})]:events[1].options};
      events[3]={tag:'CLUBHOUSE',person:s.age>=29?'이준서 · 신인 외야수':'윤태오 · 주장',title:s.age>=29?'누군가에게는 네가 선배다':'함께 성장하는 라커룸',body:s.age>=29?'타격 부진에 빠진 후배가 조심스럽게 다가온다. 시간을 내서 도와줄지, 내 훈련에 더 집중할지 결정한다.':'연전 속에서 수비 호흡이 흔들린다. 동료와 합동 훈련을 하면 해결할 수 있지만 개인 타격 훈련 시간은 줄어든다.',options:[option('mentor',s.age>=29?'후배와 함께 훈련한다':'동료와 호흡을 맞춘다','팀의 신뢰를 쌓는다. 후반기 팀 플레이에 도움이 된다.',{field:3,trust:6,energy:-5},{flag:'mentor'}),option('solo','개인 훈련을 우선한다','자신의 공격력을 더 다듬는다.',{contact:3,power:3,energy:-10},{flag:'solo'})]};
      events[6].title=s.age>=32?'마지막까지 기억되고 싶은 모습':'팬들이 기다리는 너의 이야기';
      events[6].body=s.age>=32?'오래 지켜본 팬들을 위한 인터뷰 요청이 왔다. 커리어를 돌아볼 시간과, 남은 경기에 집중할 시간 사이에서 선택한다.':`프로 ${s.year}년 차, 구단이 선수 특집 인터뷰를 제안했다. 팬과 만날지, 개인 훈련에 집중할지 정한다.`;
    }
    return events[s.round];
  }
  function choose(s,id){
    if(s.phase!=='event')return false;
    const ev=event(s),o=ev.options.find(x=>x.id===id);if(!o)return false;
    const changes=apply(s,o.effect);s.flags[o.flag||o.id]=true;if(o.style)s.flags.style=o.style;
    s.pending={event:ev.title,choice:o.title,changes,option:o};s.phase='ready';s.previousAdvice={tick:tick(s),choice:o.title};if(o.id==='rebuild')s.formDue=tick(s)+1;
    s.journal.push({round:s.round,title:o.title,body:ev.title,changes});return s.pending;
  }
  function simulate(s){
    if(s.phase!=='ready')return false;
    const st=s.stats,o=s.pending.option;
    const notes=[];
    if(s.formDue!=null&&s.formDue<=tick(s)){const gains=apply(s,{contact:6,morale:5});notes.push(`교정한 타격폼에 적응했다. 컨택 +${gains.contact} · 자신감 +${gains.morale}`);s.formDue=null;}
    else if(!s.systems&&s.round===3&&s.flags.rebuild){const gains=apply(s,{contact:6,morale:5});notes.push(`바꾼 타격폼이 몸에 익었다. 컨택 +${gains.contact} · 자신감 +${gains.morale}`);}
    const schedule=gamesPerRound(s);
    let g=clamp(Math.round((8+st.trust/15)*schedule/16*role(s))+(o.appearances||0)+(s.flags.versatile?1:0),Math.min(3,schedule),schedule);
    if(role(s)<.8&&s.round===0)notes.push('현재 능력으로는 주전 경쟁에서 밀려 출전이 줄었다. 능력을 끌어올리면 다시 기회가 온다.');
    let injured=false;
    const energyBefore=st.energy,condition=fitness(st.energy),risk=condition.risk;
    if(random(s)<risk){injured=true;const missed=Math.min(4,Math.max(1,g-1));g-=missed;notes.push(`피로 누적으로 ${missed}경기 결장. 회복 훈련을 고려하자.`);}
    const line={games:g,pa:0,ab:0,h:0,doubles:0,triples:0,hr:0,bb:0,rbi:0,sb:0};
    const hitChance=clamp(.087+st.contact*.0021+st.morale*.00035-condition.penalty+(o.performance||0),.12,.37);
    for(let i=0;i<g*4;i++){
      line.pa++;
      if(random(s)<.035+st.eye*.001){line.bb++;continue;}
      line.ab++;
      if(random(s)<hitChance){line.h++;const p=random(s);if(p<.025+st.power*.0017){line.hr++;line.rbi+=1+Math.floor(random(s)*3);}else{if(p<.29)line.doubles++;else if(p<.31)line.triples++;if(random(s)<.24)line.rbi++;}}
    }
    line.rbi+=o.rbiBonus||0;line.sb=Math.floor(random(s)*st.speed/18);
    for(const k of Object.keys(line))s.totals[k]+=line[k];
    if(s.rival){const rab=schedule*3;s.rival.ab+=rab;for(let i=0;i<rab;i++)if(random(s)<.29){s.rival.h++;if(random(s)<.12)s.rival.hr++;}}
    let wins=0;for(let i=0;i<schedule;i++)if(random(s)<.48+(line.h/(line.ab||1)-.25)*.3+(o.teamBonus||0))wins++;
    s.team.wins+=wins;s.team.losses+=schedule-wins;
    L.round(s,wins,schedule);
    const teamImpact=(line.h/(line.ab||1)-.25)*.3+(o.teamBonus||0);
    notes.push(`팀 승리 확률 기여: 타격 ${((line.h/(line.ab||1)-.25)*30).toFixed(1)}%p · 팀 선택 +${((o.teamBonus||0)*100).toFixed(1)}%p. 기준 48%에서 ${(48+teamImpact*100).toFixed(1)}%로 반영 (승리 보장 아님).`);
    const exertion=Math.ceil((s.age>=40?12:s.age>=35?10:8)*g/schedule),recovery=s.flags.dh?7:5;
    apply(s,{energy:-exertion+recovery+(injured?4:0),morale:line.h/Math.max(1,line.ab)>=.28?3:-2,trust:line.h/Math.max(1,line.ab)>=.26?3:-2});
    notes.push(`경기 전 체력 ${energyBefore}: 안타 확률 -${(condition.penalty*100).toFixed(1)}%p, 구간 결장 위험 ${Math.round(risk*100)}%. 경기 소모 -${exertion}, 일정 중 회복 +${recovery}${injured?' · 결장 중 회복 +4':''}.`);
    const result={round:s.round,title:stages[s.round],month:months[s.round],line,wins,losses:schedule-wins,notes,injured,choice:s.pending.choice,training:trainings[s.training].name,changes:s.pending.changes,energyBefore,energyAfter:st.energy,teamImpact};
    s.history.push(result);s.phase='result';return result;
  }
  function advance(s){if(s.phase!=='result')return false;s.round++;s.pending=null;s.training=null;if(s.round>=8)finishSeason(s);else {s.phase='train';prepareRound(s);}return true;}
  function rates(t){return{avg:t.ab?(t.h/t.ab).toFixed(3).replace(/^0/,''):'.000',obp:t.pa?((t.h+t.bb)/t.pa).toFixed(3).replace(/^0/,''):'.000',ops:t.ab&&t.pa?((t.h+t.bb)/t.pa+(t.h+t.doubles+2*t.triples+3*t.hr)/t.ab).toFixed(3):'0.000'};}
  function ending(s){const t=s.totals,st=s.stats;const score=t.h*.45+t.hr*2+st.trust*.35+st.field*.13;return{title:score>115?'내일의 중심 타자':score>92?'이제는 당당한 주전':'가능성을 보여준 첫 시즌',grade:score>115?'A':score>92?'B+':'B',salary:Math.round((3200+score*32+(s.flags.fans?500:0))/100)*100,body:score>115?'더그아웃 끝에서 시작한 신인이, 내년 타선의 중심으로 거론된다. 너의 첫 시즌이 다음 이야기를 열었다.':score>92?'매일의 훈련과 선택이 출전 기회로 돌아왔다. 이제 팬들은 선발 명단에서 네 이름을 찾는다.':'처음부터 완벽한 시즌은 없다. 프로의 속도를 배웠고, 무엇을 더 키워야 할지도 알게 되었다.'};}
  function finishSeason(s){
    const t=s.totals,awards=[];
    const league=L.finish(s);
    if(league){
      awards.push(...league.awards.filter(a=>a.playerId==='user').map(a=>a.title));
      if(league.regularChampion===s.club)awards.push('정규시즌 우승');
      if(league.champion===s.club)awards.push('한국시리즈 우승');
    }
    s.awards.push(...awards.map(title=>({year:s.year,title})));
    s.earnings+=s.salary;s.contract=Math.max(0,s.contract-1);
    s.seasons.push({year:s.year,age:s.age,club:s.club,level:s.level||'pro',league:s.league||'국내 프로',salary:s.salary,position:s.position,leagueSnapshot:league?JSON.parse(JSON.stringify(league)):null,totals:{...t},team:{...s.team},awards,stats:{...s.stats},history:s.history.map(h=>({...h})),journal:s.journal.map(j=>({...j}))});
    awaken(s,awards);
    s.phase='offseason';
    if(s.contract===0&&((s.level||'pro')==='pro'&&offers(s).length===0&&!transferOptions(s).some(o=>o.id==='return-kbo')||s.level==='minor'&&routeOffers(s).length===0)){s.phase='retired';s.retirementReason='no-offers';}
  }
  // A standout season lifts the ceiling of the skill the player actually trained.
  function awaken(s,awards){
    s.lastAwakening=null;const p=s.potential,t=s.totals;if(!p||t.pa<120||s.age>=34)return;
    const major=awards.some(a=>/MVP|타격왕|홈런왕|골든글러브|최다안타|OPS/.test(a));
    if(!major)return;
    const counts={};for(const h of s.history){const id=Object.keys(trainings).find(k=>trainings[k].name===h.training);if(id&&id!=='rest')counts[id]=(counts[id]||0)+1;}
    const focus=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];if(!focus)return;
    const targets=focus==='field'?['field','speed']:[focus];
    const gains={};for(const k of targets){const used=p.awakened[k]||0;if(used>=6||p[k]>=99||s.stats[k]<p[k]-4)continue;const gain=Math.min(1,6-used,99-p[k]);p[k]+=gain;p.awakened[k]=used+gain;gains[k]=gain;}
    if(Object.keys(gains).length)s.lastAwakening={year:s.year,gains};
  }
  function market(s){const t=s.totals;return Math.round((3000+t.h*45+t.hr*330+s.stats.trust*35+(s.flags.fans?700:0))*(s.age>=34?.7:1)*(s.league==='MLB'?5:1)/100)*100;}
  function offers(s){
    const current=Number(rates(s.totals).ops),previous=s.seasons.at(-2);
    const recent=previous?current*.75+Number(rates(previous.totals).ops)*.25:current;
    const injuries=s.history.filter(h=>h.injured).length;
    // Clubs keep young players whose ceiling is still above their current level.
    const p=s.potential,upside=p&&s.age<26?Math.max(0,['contact','power','eye'].reduce((n,k)=>n+p[k]-s.stats[k],0)/3)*.6+(26-s.age)*.8:0;
    const value=upside+recent*65+s.totals.games*.12+s.stats.field*.06+Math.max(0,27-s.age)*.7-Math.max(0,s.age-32)*1.6-injuries*1.5;
    return [{id:'stay',threshold:65-(s.stats.trust-50)*.06,years:s.age>=36?2:3},{id:'short',threshold:61,years:1},{id:'move',threshold:69,years:s.age>=38?1:2}].filter(o=>value>=o.threshold);
  }
  function offseason(s,deal,international){
    if(s.phase!=='offseason')return false;
    const news=[];
    if(['posting-mlb','posting-minor','return-kbo'].includes(deal))return transfer(s,deal);
    if(deal==='retire'&&s.age>=30){s.phase='retired';s.retirementReason='voluntary';return ['스파이크를 내려놓기로 했다.'];}
    if(deal==='retire')return false;
    if(s.level&&s.level!=='pro')return routeNext(s,deal);
    if(s.contract===0){
      const offer=offers(s).find(o=>o.id===deal);if(!offer)return false;
      const base=market(s);
      if(deal==='move'){s.club=s.league==='MLB'?(s.club==='시애틀 코메츠'?'캘리포니아 선버즈':'시애틀 코메츠'):L.clubs[(L.clubs.indexOf(s.club)+1+(s.year%9))%L.clubs.length];s.salary=Math.round(base*1.22/100)*100;s.contract=offer.years;apply(s,{trust:-15,morale:7});news.push(`${s.club}와 ${offer.years}년 계약. 연봉 ${money(s.salary)}.`);}
      else if(deal==='short'){s.salary=Math.round(base*1.12/100)*100;s.contract=1;news.push(`1년 승부를 택했다. 연봉 ${money(s.salary)}.`);}
      else{s.salary=base;s.contract=offer.years;apply(s,{trust:5});news.push(`익숙한 팀과 ${offer.years}년 재계약. 연봉 ${money(s.salary)}.`);}
    }else news.push(`계약 ${s.contract}년 잔여. 다음 시즌 연봉 ${money(s.salary)}.`);
    applyAging(s,news);
    if(s.year%4===0&&s.stats.trust>=60&&international){
      const medal=random(s)<.35;s.international++;apply(s,{energy:-16,eye:2,morale:5});
      if(medal)s.awards.push({year:s.year,title:'국제대회 우승'});
      news.push(medal?'국가대표로 국제대회 우승! 선구안 +2 · 체력 -16.':'국가대표 대회 참가. 새로운 투수를 경험했다. 선구안 +2 · 체력 -16.');
    }
    resetSeason(s,news);return news;
  }
  function applyAging(s,news){
    const recovery=s.history.filter(h=>h.training===trainings.rest.name).length;
    const wear=s.history.filter(h=>h.injured).length;
    // Longevity shifts the decline curve: some players stay elite past 40.
    const age=s.age-(s.potential?.longevity||0);
    const baseLoss=age>=40?12+(age-40)*2:age>=35?6+(age-35):age>=32?3:age>=30?1:0;
    const loss=baseLoss?Math.max(1,baseLoss+(wear>=3?2:0)-(recovery>=3?1:0)):0;
    const speedLoss=age>=35?loss+3:age>=29?2:0;
    apply(s,{contact:-loss,power:-loss,speed:-speedLoss,field:-Math.floor(speedLoss*.7),eye:s.age>=32?1:0,energy:100-s.stats.energy,morale:Math.max(0,65-s.stats.morale)});
    if(loss)news.push(`비시즌 변화: 컨택·장타 -${loss}, 주루 -${speedLoss}, 선구안 +1. 회복 훈련과 결장 이력이 신체 변화를 좌우한다.`);
  }
  function autoSeason(s){
    let guard=0;while(['train','event','ready','result'].includes(s.phase)&&guard++<40){
      if(s.phase==='train'){const skills=['contact','power','eye','field'];train(s,s.stats.energy<45?'rest':s.advice?.recommend||skills[(s.round+s.year)%4]);}
      else if(s.phase==='event'){const ev=event(s);choose(s,ev.options[0].id);}
      else if(s.phase==='ready')simulate(s);else advance(s);
    }return s.phase;
  }
  function career(s){const totals={games:0,pa:0,ab:0,h:0,doubles:0,triples:0,hr:0,bb:0,rbi:0,sb:0};for(const y of s.seasons)for(const k of Object.keys(totals))totals[k]+=y.totals[k];const best=s.seasons.reduce((a,b)=>!a||b.totals.h+b.totals.hr*3>a.totals.h+a.totals.hr*3?b:a,null);return{totals,best,title:totals.h>=2500?'한 시대를 대표한 타자':totals.hr>=300?'담장 너머에 새긴 이름':s.seasons.length>=15?'오래도록 사랑받은 베테랑':'자신만의 발자취를 남긴 선수'};}
  function money(n){return n>=10000?`${(n/10000).toFixed(2).replace(/0+$/,'').replace(/\.$/,'')}억 원`:`${n.toLocaleString()}만 원`;}
  function tick(s){return (s.year-1)*8+s.round;}
  function gamesPerRound(s){return s.level==='high'?4:s.level==='college'?6:16;}
  function stageLabel(s){return s.level==='high'?'고교 3학년':s.level==='college'?`대학 ${s.stageYear}학년`:s.level==='minor'?`마이너리그 ${s.stageYear}년 차`:`${s.league||'국내 프로'} · ${s.seasons.filter(y=>(y.level||'pro')==='pro'&&(y.league||'국내 프로')===(s.league||'국내 프로')).length+(['offseason','retired'].includes(s.phase)?0:1)}년 차`;}
  function handLabel(s){return `${s.throws==='L'?'좌':'우'}투${s.bats==='S'?'양':s.bats==='L'?'좌':'우'}타`;}
  // Amateur teams always play their prospect; pros earn playing time with ability.
  function role(s){if(!['pro','minor'].includes(s.level||'pro'))return 1;const st=s.stats,rating=st.contact*.45+st.power*.25+st.eye*.15+st.field*.15;return clamp(.3+(rating-57)/20,.3,1);}
  function fitness(energy){return energy>=60?{name:'양호',risk:.02,penalty:0}:energy>=40?{name:'피로',risk:.06,penalty:.01}:energy>=25?{name:'과로',risk:.14,penalty:.025}:{name:'위험',risk:.28,penalty:.045};}
  // Advice is sampled once per round, persisted, and reused on render/reload.
  function prepareRound(s){
    s.systems=3;s.adviceMemory??={};s.advice=null;s.roundEvent=null;
    const now=tick(s),st=s.stats,last=s.history.at(-1),recent=s.history.slice(-2);
    const ab=recent.reduce((n,h)=>n+h.line.ab,0),hits=recent.reduce((n,h)=>n+h.line.h,0),bb=recent.reduce((n,h)=>n+h.line.bb,0);
    const eligible=(id)=>now-(s.adviceMemory[id]??-100)>=4;
    const pool=[];
    const add=(id,weight,person,title,body,recommend,options)=>{if(eligible(id))pool.push({id,weight,person,title,body,recommend,options,tag:'DUGOUT VOICES'});};
    if(st.energy<55)add('fatigue',st.energy<25?100:7,'이서연 · 트레이너','몸이 보내는 신호를 먼저 보자',`현재 체력은 ${st.energy}. ${st.energy<25?'지금은 피로 결장 위험이 높은 상태야.':'최근 일정이 몸에 쌓였어.'} 훈련을 줄이고 회복할 시간을 만들자.`,'rest',[option('restplan','출전도 조금 조절한다','이번 구간 출전 감소 · 체력 +12',{energy:12},{appearances:-1}),option('push','중요한 일정까지 버텨본다','체력 -5 · 감독 신뢰 +3',{energy:-5,trust:3})]);
    if(ab>=20&&hits/ab<.23){
      if(st.energy>=55&&bb/(ab+bb)>=.1)add('patience',5,'윤태오 · 주장','공 보는 눈까지 의심하지 마',`최근 ${ab}타수 ${hits}안타지만 볼넷은 ${bb}개야. 무리한 스윙보다는 지금의 판단을 믿어보자.`,'eye',[option('believe','접근법을 유지한다','자신감 +6 · 선구안 +2',{morale:6,eye:2}),option('adjust','코치와 스윙을 점검한다','체력 -3 · 컨택 +2',{energy:-3,contact:2})]);
      else if(st.energy>=40)add('slump',6,'박성훈 · 타격 코치','타격을 함께 점검해보자',`최근 ${ab}타수 ${hits}안타. ${st.energy<60?'피로도 영향을 줄 수 있어.':'한 번의 부진만으로 전부 바꿀 필요는 없어.'} 기본 타격 훈련으로 감각을 먼저 찾자.`,'contact',[option('rebuild','타격폼을 조금 교정한다','이번 구간 안타 확률 -2%p · 다음 구간 컨택 성장',{energy:-3},{performance:-.02}),option('keep','익숙한 스윙을 다듬는다','컨택 +2 · 자신감 +3',{contact:2,morale:3})]);
    }
    if(last&&last.line.ab>=10&&last.line.h/last.line.ab>=.35)add('hot',3,'김도현 · 감독','좋은 감각, 오래 가져가자',`지난 구간 ${last.line.h}안타. 타격이 좋을수록 회복과 기본기가 중요해. 다음 일정에서도 기회를 주겠다.`,'eye',[option('routine','지금의 루틴을 지킨다','선구안 +2 · 신뢰 +3',{eye:2,trust:3}),option('challenge','장타에도 도전한다','장타 +3 · 체력 -4',{power:3,energy:-4})]);
    if(last&&last.line.games<gamesPerRound(s)*.7&&last.line.h/Math.max(1,last.line.ab)>=.27)add('opportunity',6,'김도현 · 감독','기회를 넓히는 방법',`공격은 괜찮은데 출전은 ${last.line.games}경기에 그쳤다. 다른 포지션도 준비해볼래?`,'field',[option('versatile','수비 범위를 넓힌다','수비 +3 · 신뢰 +6 · 체력 -2',{field:3,trust:6,energy:-2},{flag:'versatile'}),option('own','원래 자리에서 경쟁한다','컨택 +2 · 자신감 +3',{contact:2,morale:3})]);
    if(recent.length===2&&recent.every(h=>['타격 케이지','웨이트 트레이닝'].includes(h.training)))add('overwork',4,'이서연 · 트레이너','계속 더하는 것만이 훈련은 아니야','최근 두 구간 모두 강한 훈련을 했네. 이번에는 몸이 적응할 여유를 주자.','rest',[option('ease','이번 일정은 가볍게','체력 +8',{energy:8}),option('maintain','훈련 강도를 유지한다','장타 +2 · 체력 -4',{power:2,energy:-4})]);
    if(s.age>=30)add('veteran',2,'김도현 · 감독','오래 뛰기 위한 역할 조정','지명타자를 병행하면 수비 부담을 줄일 수 있어. 타석에서의 경험은 여전히 필요하다.','rest',[option('dh','지명타자를 병행한다','이번 시즌 구간 회복 +2 · 체력 +5',{energy:5},{flag:'dh'}),option('fieldleader','수비에서도 팀을 이끈다','수비 +2 · 신뢰 +3',{field:2,trust:3})]);
    if(st.energy>=40)add('teammate',1,s.age>=29?'이준서 · 후배':'윤태오 · 주장',s.age>=29?'후배가 훈련을 부탁했다':'같이 훈련하면 보이는 것들','함께 수비 호흡을 맞추자는 제안이 왔다. 개인 훈련과 팀 훈련 사이에서 시간을 나눠보자.','field',[option('mentor','함께 훈련한다','수비 +3 · 신뢰 +4',{field:3,trust:4},{flag:'mentor'}),option('solo','개인 타격에 집중한다','컨택 +2 · 장타 +2 · 체력 -3',{contact:2,power:2,energy:-3})]);
    if(s.rival?.ab>=20)add('rival',2,'이도윤 · 고교 동기','동기의 소식이 도착했다',`이도윤은 이번 시즌 ${s.rival.h}안타, ${s.rival.hr}홈런. “우리 각자 있는 곳에서 끝까지 해보자.” 비교가 자극이 될 수도, 부담이 될 수도 있다.`,'contact',[option('inspired','자극을 훈련에 쓴다','컨택 +2 · 자신감 +3',{contact:2,morale:3}),option('mypace','내 페이스에 집중한다','체력 +5 · 선구안 +1',{energy:5,eye:1})]);
    if(s.round===0&&s.year===1){s.roundEvent={id:'intro',tag:'FIRST CHAPTER',person:'박성훈 · 타격 코치',title:'어떤 타자가 되고 싶니?',body:'첫 시즌이 시작된다. 네가 잘하는 것을 먼저 보여주자. 타격에서 무엇을 우선할지 정해보자.',options:[option('patient','출루로 기회를 만들겠습니다','선구안 +3 · 신뢰 +4',{eye:3,trust:4}),option('slugger','장타로 존재감을 보여준다','장타 +4 · 자신감 +4',{power:4,morale:4})]};return;}
    const urgent=st.energy<25;
    if(!pool.length&&!urgent)return;
    if(!urgent&&random(s)>.6)return;
    let chosen=urgent?pool.find(a=>a.id==='fatigue'):null;
    if(urgent&&!chosen){chosen={id:'critical',person:'이서연 · 트레이너',title:'휴식이 필요한 상태야',body:`체력 ${st.energy}. 구간 결장 위험 28%. 회복 훈련을 먼저 고려하자.`,recommend:'rest'};s.advice=chosen;return;}
    if(!chosen){let roll=random(s)*pool.reduce((n,a)=>n+a.weight,0);chosen=pool.find(a=>(roll-=a.weight)<0)||pool.at(-1);}
    s.advice=chosen;s.roundEvent=chosen;s.adviceMemory[chosen.id]=now;
    if(s.previousAdvice&&now-s.previousAdvice.tick<=2&&last){const improved=last.line.h/Math.max(1,last.line.ab)>=.27;s.advice.followup=`지난번 “${s.previousAdvice.choice}” 이후 ${improved?'타석 내용이 좋아졌어.':'아직 결과가 아쉽지만 한 구간만으로 단정하지는 말자.'}`;}
  }
  function event(s){return s.systems===3?s.roundEvent:legacyEvent(s);}
  function migrate(s){
    if(!valid(s))return null;
    s.number??=27;s.throws??='R';s.bats??='R';s.startAge??=19;s.level??='pro';s.league??='국내 프로';s.stageYear??=s.year;s.adviceMemory??={};s.rival??={name:'이도윤',ab:0,h:0,hr:0};
    if(s.systems!==3){if(s.phase==='event')s.roundEvent=legacyEvent(s);s.systems=3;if(s.phase==='train')prepareRound(s);}
    s.club=L.normalize(s.club);s.preferredClub=L.normalize(s.preferredClub)||L.clubs[0];s.position??='RF';s.worldSeed??=s.seed;if(!s.potential){s.potential=rollPotential(s,s.worldSeed);for(const k of skills)s.potential[k]=Math.max(s.potential[k],s.stats[k]);s.growthCarry={};}s.careerId??=`career-${s.worldSeed}-${encodeURIComponent(s.name)}`;
    if(!['offseason','retired'].includes(s.phase))L.ensure(s);
    return s;
  }
  function resetSeason(s,news){if(s.rival){s.rival.ab=0;s.rival.h=0;s.rival.hr=0;}s.age++;s.year++;s.stageYear=(s.stageYear??1)+1;s.round=0;s.phase='train';s.totals={games:0,pa:0,ab:0,h:0,doubles:0,triples:0,hr:0,bb:0,rbi:0,sb:0};s.team={wins:0,losses:0};s.flags={};s.history=[];s.journal=[{round:0,title:'새로운 시즌',body:news.join(' '),changes:{}}];s.training=null;s.pending=null;s.leagueState=null;prepareRound(s);L.ensure(s);}
  function domesticInterest(s){return Number(rates(s.totals).ops)*65+s.totals.games*.12+s.stats.field*.06>=48;}
  function postingStatus(s){
    const years=s.seasons.filter(y=>(y.level||'pro')==='pro'&&(y.league||'국내 프로')==='국내 프로'&&y.totals.games>=80).length;
    if(s.level!=='pro'||s.league!=='국내 프로')return {eligible:false,reason:'국내 프로 선수의 해외 진출 경로입니다.'};
    if(years<6)return {eligible:false,reason:'데모 포스팅 조건: 80경기 이상 출전한 국내 프로 시즌 6회. 현재 '+years+' / 6회.'};
    if(s.stats.trust<60)return {eligible:false,reason:'구단이 포스팅을 거부했습니다. 감독 신뢰 60 이상이 필요합니다.'};
    const ops=Number(rates(s.totals).ops);
    if(ops<.65)return {eligible:false,reason:'구단 승인은 가능하지만 현재 성적으로는 미국 구단의 계약 제안이 없습니다.'};
    return {eligible:true,reason:'구단이 해외 도전을 승인했습니다. 미국 구단의 제안을 선택할 수 있습니다.',target:ops>=.78?'mlb':'minor'};
  }
  function transferOptions(s){
    if(s.level!=='pro')return [];
    if(s.league==='MLB')return s.contract===0&&domesticInterest(s)?[{id:'return-kbo',name:'KBO 복귀 · LG 트윈스',desc:'국내 구단의 2년 계약 제안. 시즌 종료 후 계약 만료 때 선택합니다.'}]:[];
    const status=postingStatus(s);
    return status.eligible?[{id:'posting-'+status.target,name:status.target==='mlb'?'포스팅 신청 · MLB 계약':'포스팅 신청 · 마이너 계약',desc:status.reason}]:[];
  }
  function transfer(s,id){
    if(s.phase!=='offseason'||!transferOptions(s).some(o=>o.id===id))return false;
    const news=[];
    if(id==='return-kbo'){s.league='국내 프로';s.club=L.clubs[0];s.contract=2;s.salary=market(s);news.push('미국 생활을 마치고 KBO로 복귀했다. LG 트윈스와 2년 계약.');}
    else {s.league=id==='posting-mlb'?'MLB':'마이너';s.level=id==='posting-mlb'?'pro':'minor';s.club=id==='posting-mlb'?'캘리포니아 선버즈':'선버즈 산하팀';s.contract=id==='posting-mlb'?3:0;s.salary=id==='posting-mlb'?100000:2400;news.push('구단 승인과 미국 구단 제안을 받아 포스팅으로 '+s.league+'에 진출했다.');}
    s.stageYear=0;apply(s,{trust:-15});applyAging(s,news);resetSeason(s,news);return news;
  }
  function routeOffers(s){
    const rating=Number(rates(s.totals).ops)*50+(s.stats.contact+s.stats.power+s.stats.eye)/6;
    if(s.level==='minor'&&s.age>=25&&offers(s).length===0)return domesticInterest(s)?[{id:'domestic',name:'국내 구단으로 돌아온다',desc:'미국 잔류 제안은 없지만 LG 트윈스가 계약을 제안했습니다.'}]:[];
    if(s.level==='minor')return [{id:'minor',name:'마이너리그에서 계속 도전',desc:'경험과 능력을 쌓아 다음 승격 기회를 기다립니다.'},...(rating>=68?[{id:'mlb',name:'MLB 승격 제안 수락',desc:'상위 리그에서 새롭게 주전 경쟁을 시작합니다.'}]:[]),...(domesticInterest(s)?[{id:'domestic',name:'국내 구단으로 돌아온다',desc:'LG 트윈스의 계약 제안을 받아들입니다.'}]:[])];
    const clubs=L.clubs;
    const preferred=s.preferredClub||clubs[0],club=rating>=65?preferred:clubs[(s.year+s.type.length)%clubs.length];
    const round=rating>=78?1:rating>=68?2:rating>=58?4:8;
    const list=[];
    if(rating>=45||s.level==='college'&&s.stageYear>=4)list.push({id:'draft',club,round,name:`${club} · ${round}라운드 지명`,desc:`입단 계약금 ${money(Math.round(rating*180/100)*100)}. 국내 프로에서 시작합니다.`});
    if(s.level==='high'||s.stageYear<4)list.push({id:'college',name:s.level==='high'?'대학에 진학한다':'대학에서 다음 학년을 준비한다',desc:'대학 무대에서 성장하고 다음 드래프트를 노립니다.'});
    if(rating>=72)list.push({id:'usa',name:'미국 구단과 국제 아마추어 계약',desc:'캘리포니아 선버즈 산하 마이너리그에서 시작합니다. 계약금과 별개로 승격 경쟁이 필요합니다.'});
    return list;
  }
  function routeNext(s,id){
    const offer=routeOffers(s).find(o=>o.id===id);if(!offer)return false;
    const news=[offer.name];
    if(id==='college'){if(s.level==='high'){s.stageYear=0;s.level='college';s.league='대학';s.club='한빛대';}}
    else if(id==='usa'){s.level='minor';s.league='마이너';s.club='선버즈 산하팀';s.stageYear=0;s.salary=2400;s.contract=0;s.earnings+=12000;news.push('해외 계약금 1.2억 원 수령.');}
    else if(id==='mlb'){s.level='pro';s.league='MLB';s.club='캘리포니아 선버즈';s.stageYear=0;s.salary=100000;s.contract=3;apply(s,{trust:-20});}
    else if(id==='draft'||id==='domestic'){s.level='pro';s.league='국내 프로';s.club=offer.club||'LG 트윈스';s.stageYear=0;s.salary=3200;s.contract=3;apply(s,{trust:-15});if(id==='draft'){const rating=Number(rates(s.totals).ops)*50+(s.stats.contact+s.stats.power+s.stats.eye)/6;const bonus=Math.round(rating*180/100)*100;s.earnings+=bonus;news.push(`계약금 ${money(bonus)} 수령.`);}}
    if(s.level==='minor'||id==='mlb'||id==='domestic')applyAging(s,news);
    apply(s,{energy:100-s.stats.energy,morale:5});resetSeason(s,news);return news;
  }
  function valid(s){return !!(s&&s.version===2&&types[s.type]&&Number.isInteger(s.age)&&s.age>=(s.startAge||19)&&s.year===s.age-(s.startAge||19)+1&&Array.isArray(s.seasons)&&Array.isArray(s.awards)&&Number.isInteger(s.round)&&s.round>=0&&s.round<=8&&['train','event','ready','result','offseason','retired'].includes(s.phase)&&((s.round===8)===['offseason','retired'].includes(s.phase))&&typeof s.name==='string'&&Number.isInteger(s.seed)&&s.stats&&Object.keys(labels).every(k=>Number.isFinite(s.stats[k])&&s.stats[k]>=0&&s.stats[k]<=100)&&s.totals&&['games','pa','ab','h','doubles','triples','hr','bb','rbi','sb'].every(k=>Number.isFinite(s.totals[k])&&s.totals[k]>=0)&&s.team&&Number.isFinite(s.team.wins)&&Number.isFinite(s.team.losses)&&s.flags&&Array.isArray(s.history)&&Array.isArray(s.journal)&&(!['ready','result'].includes(s.phase)||s.pending?.option)&& (s.phase!=='result'||s.history.length>0));}
  const api={clubs:L.clubs,positions:L.positions,KEY,labels,stages,months,types,trainings,create,train,event,choose,simulate,advance,rates,ending,valid,offseason,autoSeason,market,offers,scout,role,potentialGrade,canReroll,reroll,limit,career,money,preview,trainingEffect,fitness,gamesPerRound,stageLabel,handLabel,migrate,prepareRound,routeOffers,postingStatus,transferOptions};
  if(typeof module!=='undefined')module.exports=api;else root.CareerEngine=api;
})(typeof window!=='undefined'?window:globalThis);
