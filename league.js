(function(root){
  'use strict';
  const clubs=['LG 트윈스','한화 이글스','SSG 랜더스','삼성 라이온즈','NC 다이노스','KT 위즈','롯데 자이언츠','KIA 타이거즈','두산 베어스','키움 히어로즈'];
  const positions={C:'포수','1B':'1루수','2B':'2루수','3B':'3루수',SS:'유격수',LF:'좌익수',CF:'중견수',RF:'우익수',DH:'지명타자'};
  const legacy={'서울 그린웨이브':clubs[0],'부산 블루하버':clubs[6],'수원 레드폭스':clubs[5]};
  const normalize=club=>legacy[club]||club;
  const blank=()=>({games:0,pa:0,ab:0,h:0,doubles:0,triples:0,hr:0,bb:0,rbi:0,sb:0});
  const rng=s=>{s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;};
  const avg=t=>t.ab?t.h/t.ab:0;
  const ops=t=>(t.pa?(t.h+t.bb)/t.pa:0)+(t.ab?(t.h+t.doubles+2*t.triples+3*t.hr)/t.ab:0);
  const score=p=>p.totals.h+p.totals.hr*3+p.totals.rbi*.35+p.totals.bb*.5+p.totals.sb*.25;
  function create(s){
    const l={version:1,year:s.year,seed:((s.worldSeed||s.seed)^Math.imul(s.year,2654435761))>>>0,days:0,teams:[],players:[],awards:[],postseason:[],champion:null};
    const family=['김','이','박','최','정','강','조','윤','장','임'];
    const given=['민준','서진','도현','현우','지훈','건우','시윤','준영','태민','승재','우진','지호','민성','진우','성현','동하','재윤','유찬'];
    clubs.forEach((club,t)=>{
      l.teams.push({club,wins:0,losses:0,strength:.42+rng(l)*.16});
      Object.keys(positions).forEach((position,i)=>{
        const mine=club===s.club&&position===(s.position||'RF');
        l.players.push({id:mine?'user':`npc-${t}-${i}`,name:mine?s.name:family[t]+given[(t*9+i)%given.length],club,position,field:mine?s.stats.field:45+Math.floor(rng(l)*45),rookie:mine?!s.seasons.some(y=>(y.level||'pro')==='pro'):(t+i)%9===0,ability:{hit:.22+rng(l)*.095,power:.06+rng(l)*.15,eye:.06+rng(l)*.065},totals:blank()});
      });
    });
    return l;
  }
  // Nine rotating matchdays; five games per day. Each win has an opposing loss.
  function pairs(day){const ring=Array.from({length:10},(_,i)=>i);for(let i=0;i<day%9;i++)ring.splice(1,0,ring.pop());return Array.from({length:5},(_,i)=>[ring[i],ring[9-i]]);}
  function playRound(l,club,wins,count){
    let remaining=wins;
    for(let d=0;d<count;d++){
      const userWin=rng(l)<remaining/(count-d);if(userWin)remaining--;
      for(const [a,b] of pairs(l.days+d)){
        const x=l.teams[a],y=l.teams[b];
        const xWins=x.club===club?userWin:y.club===club?!userWin:rng(l)<.5+(x.strength-y.strength);
        (xWins?x:y).wins++;(xWins?y:x).losses++;
      }
    }
    for(const p of l.players){
      if(p.id==='user')continue;
      const t=p.totals,g=Math.max(1,count-Math.floor(rng(l)*3));t.games+=g;
      for(let i=0;i<g*4;i++){
        t.pa++;if(rng(l)<p.ability.eye){t.bb++;continue;}t.ab++;
        if(rng(l)<p.ability.hit){t.h++;const hit=rng(l);if(hit<p.ability.power){t.hr++;t.rbi+=1+Math.floor(rng(l)*3);}else {if(hit<.29)t.doubles++;else if(hit<.31)t.triples++;if(rng(l)<.24)t.rbi++;}}
      }
      t.sb+=Math.floor(rng(l)*4);
    }
    l.days+=count;
  }
  function sync(s){const p=s.leagueState?.players.find(p=>p.id==='user');if(p){p.totals={...s.totals};p.field=s.stats.field;}}
  function ensure(s){
    if(s.level!=='pro'||s.league!=='국내 프로')return null;
    if(!s.leagueState||s.leagueState.year!==s.year){
      s.leagueState=create(s);
      for(const h of s.history)playRound(s.leagueState,s.club,h.wins,h.wins+h.losses);
      s.leagueState.reconstructed=s.history.length>0;
    }
    sync(s);return s.leagueState;
  }
  function round(s,wins,count){const l=ensure(s);if(!l)return;playRound(l,s.club,wins,count);sync(s);}
  function standings(l){return [...l.teams].sort((a,b)=>b.wins-a.wins||a.losses-b.losses||clubs.indexOf(a.club)-clubs.indexOf(b.club));}
  function leaders(l,metric){
    const qualified=['avg','ops'].includes(metric),minimum=Math.ceil(l.days*3.1);
    const value=p=>metric==='avg'?avg(p.totals):metric==='ops'?ops(p.totals):p.totals[metric];
    const list=l.players.filter(p=>!qualified||(p.totals.pa>=minimum&&p.totals.ab>0));
    list.sort((a,b)=>value(b)-value(a)||b.totals.h-a.totals.h||a.id.localeCompare(b.id));
    let rank=0,previous=null;return list.map((p,i)=>{const n=value(p);if(n!==previous)rank=i+1;previous=n;return {...p,rank,value:n};});
  }
  function finish(s){
    const l=ensure(s);if(!l||l.champion)return l;
    const table=standings(l);
    const award=(title,p)=>l.awards.push({title,playerId:p.id,name:p.name,club:p.club,position:p.position});
    for(const [metric,title] of [['avg','타격왕'],['h','최다안타왕'],['hr','홈런왕'],['rbi','타점왕'],['sb','도루왕'],['ops','OPS 1위']]){
      for(const p of leaders(l,metric).filter(p=>p.rank===1))award(title,p);
    }
    const sorted=[...l.players].sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));
    award('시즌 MVP',sorted[0]);const rookie=sorted.find(p=>p.rookie);if(rookie)award('신인상',rookie);
    const gloveScore=p=>score(p)+p.field*.5;
    for(const position of ['C','1B','2B','3B','SS','DH']){
      const p=l.players.filter(p=>p.position===position).sort((a,b)=>gloveScore(b)-gloveScore(a))[0];award(`골든글러브 · ${positions[position]}`,p);
    }
    l.players.filter(p=>['LF','CF','RF'].includes(p.position)).sort((a,b)=>gloveScore(b)-gloveScore(a)).slice(0,3).forEach(p=>award('골든글러브 · 외야수',p));
    const series=(title,a,b,target,advantage=0)=>{
      let aw=advantage,bw=0;
      while(aw<target&&bw<target){if(rng(l)<.5+(a.wins-b.wins)/256)aw++;else bw++;}
      const winner=aw>bw?a:b;l.postseason.push({title,a:a.club,b:b.club,aWins:aw,bWins:bw,advantage,winner:winner.club});return winner;
    };
    let winner=series('와일드카드',table[3],table[4],2,1);
    winner=series('준플레이오프',table[2],winner,3);
    winner=series('플레이오프',table[1],winner,3);
    winner=series('한국시리즈',table[0],winner,4);
    l.champion=winner.club;l.regularChampion=table[0].club;
    return l;
  }
  const api={clubs,positions,normalize,blank,create,ensure,round,standings,leaders,finish,score};
  if(typeof module!=='undefined')module.exports=api;else root.BaseballLeague=api;
})(typeof window!=='undefined'?window:globalThis);
