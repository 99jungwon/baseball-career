// Short decision drills. No timing-bar repetition and no real-time penalty for reading.
function startMini(){
  mini={kind:selected==='field'?'running':'pitch',attempt:0,scores:[],waiting:false,feedback:''};
  nextDrill();
}
function nextDrill(){
  if(!mini)return;
  mini.waiting=false;mini.attempt++;
  if(mini.kind==='pitch'){
    const x=.08+Math.random()*.84,y=.08+Math.random()*.84;
    const strikes=Math.floor(Math.random()*3),balls=Math.floor(Math.random()*4);
    const inside=x>=.28&&x<=.72&&y>=.24&&y<=.76;
    mini.question={x,y,strikes,balls,inside,answer:inside?'swing':'take',speed:800+Math.random()*700,breakX:(Math.random()-.5)*90};
  }else{
    const scenarios=[
      {text:'우중간 깊숙한 타구. 외야수가 펜스 쪽에서 공을 잡는다.',distance:88},
      {text:'얕은 좌익수 앞 안타. 외야수가 앞으로 달려오며 잡는다.',distance:45},
      {text:'우익수 오른쪽으로 빠진 안타. 수비수가 돌아서서 송구한다.',distance:76},
      {text:'중견수 정면 안타. 수비수가 몸을 세우고 송구를 준비한다.',distance:57}
    ];
    const q=scenarios[Math.floor(Math.random()*scenarios.length)],arm=45+Math.floor(Math.random()*45),speed=state.stats.speed;
    const chance=Math.max(10,Math.min(95,Math.round(48+(q.distance-65)*1.25+(speed-arm)*.6)));
    const outs=Math.floor(Math.random()*3),threshold=outs===2?55:72;
    mini.question={...q,arm,speed,chance,outs,answer:chance>=threshold?'go':'hold'};
  }
  drawDrill();
}
function drawDrill(){
  const m=mini,q=m.question;
  const pitch=m.kind==='pitch';
  const scene=pitch?`<p class="muted">${q.balls}볼 ${q.strikes}스트라이크 · 도착 코스를 읽고 스윙할지 판단하세요.</p><div class="pitch-zone" aria-label="${q.inside?'스트라이크존 안':'스트라이크존 밖'}으로 들어오는 공"><div class="strike-zone"></div><span class="pitch-target" style="left:${q.x*100}%;top:${q.y*100}%;--flight:${q.speed}ms;--break:${q.breakX}px">⚾</span><span class="zone-label">STRIKE ZONE</span></div><p class="fine">공은 도착 지점에 멈춥니다. 존 안은 스윙, 존 밖은 참기.<br>속도와 궤적은 매번 달라지지만 반응 속도로 감점하지 않아요.</p>`:
  `<p class="muted">1루 주자 · ${q.outs}아웃 · 타자가 안타를 쳤습니다.</p><div class="running-scene"><span>1루 → 2루 → <b>3루?</b></span><p>${q.text}</p></div><div class="running-facts"><span>내 주력 <b>${q.speed}</b></span><span>외야수 송구 <b>${q.arm}</b></span><span>타구 거리 <b>${q.distance}m</b></span></div><p class="fine">${q.outs===2?'2아웃: 적극적인 진루로 득점 기회를 노려보세요.':'아웃 여유가 있어요. 확실한 기회인지 판단하세요.'}</p>`;
  const buttons=m.waiting?`<div class="drill-feedback" aria-live="polite">${esc(m.feedback)}</div><button class="btn primary wide" data-action="${m.attempt===5?'drill-finish':'drill-next'}">${m.attempt===5?'훈련 결과 반영하기':'다음 상황'} →</button>`:
    `<div class="button-row drill-buttons"><button class="btn primary" data-action="drill-answer" data-id="${pitch?'swing':'go'}">${pitch?'스윙한다':'3루까지 진루'}</button><button class="btn secondary" data-action="drill-answer" data-id="${pitch?'take':'hold'}">${pitch?'참는다':'2루에서 멈춘다'}</button></div>`;
  modal(`<div class="section-head"><span class="eyebrow">${pitch?'READ THE PITCH':'READ THE FIELD'} · ${m.attempt} / 5</span><button class="icon-button" data-action="mini-cancel" aria-label="훈련 나가기">×</button></div><h2>${pitch?'좋은 공을 골라라.':'한 베이스, 한 번의 판단.'}</h2>${scene}<div class="mini-dots">${m.scores.map(p=>`<span class="${p?'hit':'miss'}">${p?'✓':'×'}</span>`).join('')}${Array(5-m.scores.length).fill('<span>—</span>').join('')}</div>${buttons}<p class="fine">기본 성장 보장 · 좋은 판단은 추가 성장으로 이어져요.</p>`,true);
}
function answerDrill(id){
  if(!mini||mini.waiting)return;
  const q=mini.question,pitch=mini.kind==='pitch';
  if(!(pitch?['swing','take']:['go','hold']).includes(id))return;
  const correct=id===q.answer;
  mini.scores.push(correct?100:0);mini.waiting=true;
  mini.feedback=pitch?`${correct?'좋은 판단!':'아쉬운 판단.'} ${q.inside?'존 안에 들어온 공은 적극적으로 공략하자.':'존 밖의 공을 참아 출루 기회를 지키자.'}`:`${correct?'좋은 판단!':'다음에는 이 단서를 보자.'} 예상 진루 성공률 ${q.chance}%. ${q.outs===2?'2아웃에서는 성공률 55% 이상이면 도전하도록 훈련한다.':'0~1아웃에서는 성공률 72% 이상일 때 도전하도록 훈련한다.'}`;
  drawDrill();
}
function finishMini(){
  if(!mini||mini.scores.length!==5)return;
  const score=Math.round(mini.scores.reduce((a,b)=>a+b,0)/5),training=mini.kind==='pitch'?'contact':'field';
  closeModal();const ch=E.train(state,training,score);save();render();
  modal(`<span class="eyebrow">TRAINING COMPLETE</span><h2>좋은 판단 ${score/20} / 5회</h2><p class="muted">훈련 결과가 반영되었습니다.</p><div class="change-list">${changes(ch)}</div><button class="btn primary wide" data-action="close">시즌으로 →</button>`);
}
