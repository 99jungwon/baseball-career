(function(root){
  'use strict';
  const KEY='last-inning-collection-v1';
  const positions=['C','1B','2B','3B','SS','LF','CF','RF','DH'];
  const empty=()=>({version:1,players:[],lineup:positions.map(position=>({position,playerId:null}))});
  function valid(c){return !!(c&&c.version===1&&Array.isArray(c.players)&&Array.isArray(c.lineup)&&c.lineup.length===9&&new Set(c.players.map(p=>p.id)).size===c.players.length&&c.players.every(p=>typeof p.id==='string'&&typeof p.name==='string'&&p.totals&&p.best&&p.best.totals&&Array.isArray(p.seasons))&&new Set(c.lineup.map(x=>x.position)).size===9&&c.lineup.every(x=>positions.includes(x.position)&&(x.playerId===null||c.players.some(p=>p.id===x.playerId)))&&new Set(c.lineup.filter(x=>x.playerId).map(x=>x.playerId)).size===c.lineup.filter(x=>x.playerId).length);}
  function archive(c,s,career){
    if(s.phase!=='retired'||!s.careerId||!career.best)return false;
    if(c.players.some(p=>p.id===s.careerId))return true;
    c.players.push({id:s.careerId,name:s.name,number:s.number,position:s.position||'RF',bats:s.bats,throws:s.throws,age:s.age,title:career.title,totals:{...career.totals},awards:s.awards.map(a=>({...a})),best:{year:career.best.year,club:career.best.club,league:career.best.league,totals:{...career.best.totals},stats:{...career.best.stats}},seasons:s.seasons.map(y=>({year:y.year,age:y.age,club:y.club,league:y.league,totals:{...y.totals},awards:[...y.awards]}))});
    return true;
  }
  function assign(c,index,id){
    if(!Number.isInteger(index)||index<0||index>8||id!==''&&!c.players.some(p=>p.id===id))return false;
    if(id&&c.lineup.some((slot,i)=>i!==index&&slot.playerId===id))return false;
    c.lineup[index].playerId=id||null;return true;
  }
  function move(c,index,direction){const next=index+direction;if(!Number.isInteger(index)||![-1,1].includes(direction)||index<0||index>8||next<0||next>8)return false;[c.lineup[index],c.lineup[next]]=[c.lineup[next],c.lineup[index]];return true;}
  const api={KEY,empty,valid,archive,assign,move};if(typeof module!=='undefined')module.exports=api;else root.CareerCollection=api;
})(typeof window!=='undefined'?window:globalThis);
