(() => {
  'use strict';
  const T=DriftTuning,D=DriftDynamics,L='#c6f36b',P='#d5afff',C='#65d8ef',O='#ffa66b',G='#94a8b4';
  let active=false,task='camber',saved={...state},savedLock=true,wheel=1,holdCamber=false,targetCamber=0,holdLead=true,leadTarget=state.steer;
  let from=-45,to=-25,time=0,playing=false,startTime=0,runPair=null,runKey='',raf=0,searchId=0,choices=[],solveStatus='',viewPath=true,pathDetail=false;
  let inputs={...D.defaults,drive:.7,rearGrip:.6},searchGoal='leading',retentionGoal=95,variationGoal=10;
  let linkParameter='ack';
  let linkMatchView=false,matchMetric='moment',ackMatch=null;
  const linkParams={ack:['Ackermann offset',-9,9,1.5,'mm'],caster:['Caster',4,6.5,.1,'°'],camber:['Static camber',-5,-3,.1,'°'],trail:['Mechanical trail',0,80,1,'mm']};
  const f=(v,n=1)=>Number.isFinite(v)?fmt(v,n):'—',signed=(v,n=1)=>Number.isFinite(v)?sgn(v,n):'—';
  const svg=(body,label,box='0 0 600 300')=>`<svg viewBox="${box}" role="img" aria-label="${label}">${body}</svg>`;
  const tx=(x,y,t,c=G,n=16,anchor='start')=>`<text x="${x}" y="${y}" fill="${c}" font-size="${n}" text-anchor="${anchor}">${t}</text>`;
  const ln=(x,y,xx,yy,c=G,w=2,dash='')=>`<path d="M${x} ${y}L${xx} ${yy}" stroke="${c}" stroke-width="${w}" fill="none" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
  const ar=(x,y,xx,yy,c)=>{const a=Math.atan2(yy-y,xx-x);return ln(x,y,xx,yy,c,3)+`<path d="M${xx-8*Math.cos(a-.5)} ${yy-8*Math.sin(a-.5)}L${xx} ${yy}L${xx-8*Math.cos(a+.5)} ${yy-8*Math.sin(a+.5)}" fill="none" stroke="${c}" stroke-width="3"/>`};
  const role=i=>T.leading(state)===null?'':T.leading(state)===i?'Leading':'Trailing';
  const field=(key,label,min,max,step,unit)=>`<label class="tn-field"><span>${label} <output id="tn-${key}-out"></output></span><div><input id="tn-${key}" data-tn-key="${key}" type="range" min="${min}" max="${max}" step="${step}" aria-label="${label}"><input id="tn-${key}-num" data-tn-key="${key}" type="number" min="${min}" max="${max}" step="${step}" aria-label="${label}: точно"><small>${unit}</small></div></label>`;
  document.querySelector('.mode-switch').insertAdjacentHTML('afterbegin','<button id="tuning-mode" aria-pressed="false">Настроить</button>');
  document.querySelector('main').insertAdjacentHTML('afterbegin',`<section id="tuning-lab" hidden aria-label="Связанные настройки">
    <div class="tn-heading"><div><p class="eyebrow">НАСТРОЙКА → ИЗМЕНЕНИЕ → РЕЗУЛЬТАТ</p><h1 id="tn-title">Caster / Camber</h1></div><button id="tn-help">Как работает</button></div>
    <div class="tn-tabs"><button data-tn-task="camber" aria-pressed="true">Caster / Camber</button><button data-tn-task="ack" aria-pressed="false">Ackermann / Path</button><button data-tn-task="links" aria-pressed="false">Связи</button></div>
    <div class="tn-workspace"><div class="tn-stage">
      <div class="tn-stage-top"><strong id="tn-stage-caption"></strong><button id="tn-view" hidden>Передняя ось</button></div>
      <div id="tn-visual"></div><div id="tn-live" class="tn-live" aria-live="off"></div><p id="tn-explain" class="tn-explain"></p>
      <div id="tn-playback" hidden><div><button id="tn-play" class="primary">Сравнить 3 секунды</button><output id="tn-time"></output><button id="tn-start">В начало</button></div><input id="tn-timeline" type="range" min="0" max="3" step=".01" value="0" aria-label="Comparison time"></div>
      <div class="tn-stage-foot"><span class="tn-dot current"></span>Сейчас <span class="tn-dot before"></span>Было <button id="tn-save">Запомнить</button><button id="tn-restore">Вернуть</button></div>
    </div><aside class="tn-controls"><p id="tn-mobile-explain" class="tn-mobile-explain"></p>
      <div id="tn-camber-controls">
        <div class="tn-line"><label for="tn-wheel">Target wheel</label><select id="tn-wheel"><option value="1">RF · Leading</option><option value="0">LF · Trailing</option></select></div>
        ${field('steer','Steering angle',-55,55,.5,'°')}
        <label class="tn-check"><input id="tn-hold-camber" type="checkbox"> Hold dynamic camber <small>подбирать Static camber</small></label>
        <div class="tn-line" id="tn-target-row" hidden><label for="tn-target">Target dynamic camber</label><input id="tn-target" type="number" min="-8" max="5" step=".1" value="0"><span>°</span></div>
        ${field('caster','Caster',4,6.5,.1,'°')}${field('camber','Static camber',-5,-3,.05,'°')}${field('kpi','KPI',8,12,.5,'°')}
        <div class="tn-presets">${[12,10,8].map(v=>`<button data-tn-kpi="${v}">KPI ${v}°</button>`).join('')}</div>
        <p id="tn-solve" class="tn-notice" role="status"></p>
        <label class="tn-check"><input id="tn-trail-lock" type="checkbox" checked> Hold mechanical trail</label>
      </div>
      <div id="tn-ack-controls" hidden>
        ${field('ack','Ackermann offset',-9,9,1.5,'mm')}
        <div class="tn-presets"><button data-tn-ack="-6">Reverse</button><button data-tn-ack="0">Zero</button><button data-tn-ack="6">Positive</button></div>
        <p id="tn-ack-kind"></p>
        <label class="tn-check"><input id="tn-path-detail" type="checkbox"> Разница траекторий крупно</label>
        <label class="tn-check"><input id="tn-hold-lead" type="checkbox" checked> Hold leading angle <small>одинаковый угол на старте</small></label>
        <label class="tn-field"><span id="tn-lead-label">Leading wheel angle</span><div><input id="tn-lead-angle" type="range" min="-50" max="50" step=".5" aria-label="Leading wheel angle"><input id="tn-lead-number" type="number" min="-50" max="50" step=".5" aria-label="Leading wheel angle: точно"><small>°</small></div></label>
        <p id="tn-steer-status" class="tn-notice" role="status"></p>
        <div class="tn-line"><span>Start</span><button id="tn-mirror">Зеркальный занос</button><button id="tn-conditions">Условия</button></div>
        <p class="tn-small">Одинаковые начальные Speed, Drift angle и Yaw rate. Руль и педали удерживаются; скрытой коррекции водителем нет.</p>
      </div>
      <div id="tn-link-controls" hidden>
        <p class="tn-small">Выберите параметр. Схема покажет, через что он влияет на оба колеса. Руль удерживается на заданном угле.</p>
        <div class="tn-link-keys">${Object.entries(linkParams).map(([k,p])=>`<button data-tn-link="${k}">${p[0]}<strong id="tn-link-${k}-value"></strong></button>`).join('')}</div>
        <label class="tn-field"><span id="tn-link-label"></span><div><input id="tn-link-range" type="range"><input id="tn-link-number" type="number"><small id="tn-link-unit"></small></div></label>
        <label class="tn-field"><span>Steering angle <output id="tn-link-angle-out"></output></span><div><input id="tn-link-angle" type="range" min="-55" max="55" step=".5" aria-label="Steering angle: связи"><input id="tn-link-angle-number" type="number" min="-55" max="55" step=".5" aria-label="Steering angle: связи точно"><small>°</small></div></label>
        <label class="tn-check"><input id="tn-link-lock" type="checkbox" checked> Hold mechanical trail</label>
        <p id="tn-link-hint" class="tn-notice"></p>
        <div class="tn-match-box"><label for="tn-match-metric">Same effect</label><select id="tn-match-metric"><option value="moment">Trailing yaw moment</option><option value="torque">Steering torque</option><option value="force">Trailing lateral force</option></select><p id="tn-match-result" role="status"></p><button id="tn-match-apply">Применить ближайший Ackermann</button><p class="tn-small">Подбор по одному показателю при одинаковом Leading angle. Совпадение траектории или Self-steering не гарантируется.</p></div>
        <button id="tn-link-release">Показать Self-steering в симуляторе</button>
      </div>
      <p id="tn-context" class="tn-context"></p><button id="tn-more">Условия и Mechanical trail</button>
    </aside></div>
    <section id="tn-range" class="tn-range"><div class="tn-range-heading"><h2>Working range</h2><span>Подбор по всему участку</span></div>
      <div class="tn-range-settings"><label>From <input id="tn-from" type="number" min="-55" max="55" step=".5" value="-45">°</label><label>To <input id="tn-to" type="number" min="-55" max="55" step=".5" value="-25">°</label><button id="tn-range-mirror">Зеркально</button></div>
      <div id="tn-curve"></div><p class="tn-small">Dynamic camber · LF фиолетовый / RF зелёный · пунктир — было · голубая линия — выбранный Steering angle</p>
      <div class="tn-search-settings"><label>Target<select id="tn-goal"><option value="leading">Стабильный контакт Target wheel</option><option value="both">Хороший контакт обоих колёс</option><option value="quiet">Меньше влияния второго колеса</option></select></label><label>Min area retention <span><input id="tn-retention" type="number" min="50" max="100" step="1" value="95"> %</span></label><label>Max area variation <span><input id="tn-variation" type="number" min="0" max="100" step="1" value="10"> %</span></label><button id="tn-search" class="primary">Подобрать сочетания</button></div>
      <p id="tn-search-status" role="status">Caster 4–6,5° · Static camber −3…−5° · KPI 8 / 10 / 12°. Mechanical trail сохраняется при подборе.</p><div id="tn-options"></div>
    </section>
    <p class="tn-model-note">Учебная модель. Contact patch — оценка геометрии контакта, не процент сцепления. Траектория рассчитывается только в Ackermann / Path; остальные экраны исследуют заданное движение.</p>
    <dialog id="tn-dialog" aria-labelledby="tn-dialog-title"><div class="tn-dialog-head"><h2 id="tn-dialog-title"></h2><button id="tn-close" autofocus>Закрыть</button></div><div id="tn-dialog-body"></div></dialog>
  </section>`);

  function stop(){playing=false;$('tn-play').textContent='Сравнить 3 секунды';$('tn-play').setAttribute('aria-pressed','false')}
  function invalidateSearch(){searchId++;choices=[];$('tn-options').innerHTML='';$('tn-search').disabled=false;$('tn-search-status').textContent='Подбор обновляется по кнопке для текущих настроек и диапазона.'}
  function schedule(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;if(active)paint()})}
  window.addEventListener('resize',schedule);
  function open(){
    $('learn-mode').click();active=true;document.body.classList.add('tuning-mode');$('explorer').hidden=true;$('tuning-lab').hidden=false;
    $('learn-mode').setAttribute('aria-pressed','false');$('tuning-mode').setAttribute('aria-pressed','true');
    wheel=T.leading(state)??wheel;leadTarget=M.calculate(state).wheels[wheel].delta;runKey='';stop();time=0;paint();window.scrollTo(0,0);
  }
  document.addEventListener('geometry-mode',()=>{active=false;stop();document.body.classList.remove('tuning-mode');$('tuning-lab').hidden=true;$('tuning-mode').setAttribute('aria-pressed','false')});
  const oldRender=render;render=function(){if(active)schedule();else oldRender()};
  const oldReset=$('reset').onclick;$('reset').onclick=()=>{oldReset();if(active){saved={...state};lockTrail=true;savedLock=true;holdCamber=false;targetCamber=0;holdLead=true;wheel=1;leadTarget=M.calculate(state).wheels[1].delta;from=-45;to=-25;solveStatus='';inputs={...D.defaults,drive:.7,rearGrip:.6};runKey='';time=0;stop();invalidateSearch();paint()}};
  $('tuning-mode').onclick=open;
  function capture(){saved={...state};savedLock=lockTrail;runKey='';time=0;stop();paint()}
  function compensate(){if(!holdCamber)return;const solved=T.solveCamber(state,wheel,targetCamber);state.camber=solved.value;solveStatus=solved.reached?`Dynamic camber ${signed(solved.actual,2)}° сохранён. Static camber → ${signed(solved.value,2)}°.`:`Цель ${signed(targetCamber)}° недостижима в Static camber −5…−3°. На границе: ${signed(solved.actual,2)}°. Измените KPI или рабочий угол.`}
  function change(key,value){
    stop();time=0;invalidateSearch();solveStatus='';setValue(key,value);
    if(holdCamber&&['caster','kpi','steer'].includes(key))compensate();
    if(task==='ack'&&key==='ack'&&holdLead){const i=T.leading(state);if(i!==null)state.steer=T.solveSteer(state,i,leadTarget).value}
    sync();schedule();
  }
  document.querySelectorAll('[data-tn-key]').forEach(el=>el.oninput=()=>{if(el.value!==''&&el.validity.valid)change(el.dataset.tnKey,+el.value)});
  document.querySelectorAll('[data-tn-task]').forEach(el=>el.onclick=()=>{task=el.dataset.tnTask;history.replaceState(null,'','#'+task);stop();time=0;holdCamber=false;solveStatus='';runKey='';leadTarget=M.calculate(state).wheels[T.leading(state)??wheel].delta;paint()});
  document.querySelectorAll('[data-tn-kpi]').forEach(el=>el.onclick=()=>change('kpi',+el.dataset.tnKpi));
  document.querySelectorAll('[data-tn-ack]').forEach(el=>el.onclick=()=>change('ack',+el.dataset.tnAck*state.rackSide));
  $('tn-wheel').onchange=e=>{wheel=+e.target.value;invalidateSearch();compensate();sync();paint()};
  $('tn-hold-camber').onchange=e=>{holdCamber=e.target.checked;solveStatus='';invalidateSearch();compensate();sync();paint()};
  $('tn-target').oninput=e=>{if(e.target.value!==''&&e.target.validity.valid){targetCamber=+e.target.value;invalidateSearch();compensate();sync();paint()}};
  $('tn-trail-lock').onchange=e=>{lockTrail=e.target.checked;sync();paint()};
  $('tn-hold-lead').onchange=e=>{holdLead=e.target.checked;leadTarget=holdLead?M.calculate(state).wheels[T.leading(state)??wheel].delta:state.steer;runKey='';stop();time=0;paint()};
  function changeLead(value){leadTarget=value;const i=T.leading(state);if(holdLead&&i!==null)change('steer',T.solveSteer(state,i,value).value);else change('steer',value)}
  for(const id of ['tn-lead-angle','tn-lead-number'])$(id).oninput=e=>{if(e.target.value!==''&&e.target.validity.valid)changeLead(+e.target.value)};
  $('tn-save').onclick=capture;
  $('tn-restore').onclick=()=>{state={...saved};lockTrail=savedLock;holdCamber=false;solveStatus='';leadTarget=M.calculate(state).wheels[T.leading(state)??wheel].delta;stop();time=0;runKey='';invalidateSearch();sync();paint()};
  $('tn-view').onclick=()=>{if(task==='links')linkMatchView=!linkMatchView;else viewPath=!viewPath;paint()};
  $('tn-path-detail').onchange=e=>{pathDetail=e.target.checked;viewPath=true;paint()};
  $('tn-start').onclick=()=>{stop();time=0;paint()};
  $('tn-timeline').oninput=e=>{stop();time=+e.target.value;paintFrame()};
  $('tn-play').onclick=()=>{if(playing){stop();return}if(!runPair)return;playing=true;time=0;startTime=performance.now();$('tn-play').textContent='Пауза';$('tn-play').setAttribute('aria-pressed','true');requestAnimationFrame(animate)};
  function animate(now){if(!playing||!active||task!=='ack')return;time=Math.min(runPair.end,(now-startTime)/1000);paintFrame();if(time>=runPair.end)stop();else requestAnimationFrame(animate)}
  function mirror(){state.beta=-state.beta;state.yaw=-state.yaw;state.steer=-state.steer;[state.wheelTravelLF,state.wheelTravelRF]=[state.wheelTravelRF,state.wheelTravelLF];saved.beta=-saved.beta;saved.yaw=-saved.yaw;saved.steer=-saved.steer;[saved.wheelTravelLF,saved.wheelTravelRF]=[saved.wheelTravelRF,saved.wheelTravelLF];leadTarget=-leadTarget;wheel=1-wheel;[from,to]=[-to,-from];invalidateSearch();stop();time=0;runKey='';sync();paint()}
  $('tn-mirror').onclick=mirror;$('tn-range-mirror').onclick=()=>{[from,to]=[-to,-from];invalidateSearch();paint()};
  document.querySelectorAll('[data-tn-link]').forEach(el=>el.onclick=()=>{linkParameter=el.dataset.tnLink;paint()});
  for(const id of ['tn-link-range','tn-link-number'])$(id).oninput=e=>{if(e.target.value!==''&&e.target.validity.valid)change(linkParameter,+e.target.value)};
  for(const id of ['tn-link-angle','tn-link-angle-number'])$(id).oninput=e=>{if(e.target.value!==''&&e.target.validity.valid)change('steer',+e.target.value)};
  $('tn-link-lock').onchange=e=>{lockTrail=e.target.checked;sync();paint()};
  $('tn-match-metric').onchange=e=>{matchMetric=e.target.value;linkMatchView=true;paint()};
  $('tn-match-apply').onclick=()=>{if(!ackMatch?.best||!ackMatch.baselineReachable)return;const best=ackMatch.best;state.ack=best.ack;state.steer=best.setup.steer;holdCamber=false;linkParameter='ack';invalidateSearch();sync();paint()};
  $('tn-link-release').onclick=()=>{$('full-mode').click();view='course';free=true;steerVelocity=0;releasedFrom=state.steer;running=true;sync();render();window.scrollTo(0,0)};
  for(const id of ['tn-from','tn-to'])$(id).oninput=e=>{if(e.target.value!==''&&e.target.validity.valid){if(id==='tn-from')from=+e.target.value;else to=+e.target.value;invalidateSearch();paintCurve()}};
  $('tn-goal').onchange=e=>{searchGoal=e.target.value;invalidateSearch()};
  for(const id of ['tn-retention','tn-variation'])$(id).oninput=e=>{if(e.target.value!==''&&e.target.validity.valid){if(id==='tn-retention')retentionGoal=+e.target.value;else variationGoal=+e.target.value;invalidateSearch()}};

  function patchShape(p,cx,cy,scale,color){
    const points=[];for(let j=0;j<=28;j++){const y=p.yMin+(p.yMax-p.yMin)*j/28,x=Math.sqrt(Math.max(0,2*p.R*(p.z-y*y/(2*p.Rc)+p.tilt*y)));points.push([cx+y*scale,cy-x*scale])}for(let j=28;j>=0;j--){const y=p.yMin+(p.yMax-p.yMin)*j/28,x=Math.sqrt(Math.max(0,2*p.R*(p.z-y*y/(2*p.Rc)+p.tilt*y)));points.push([cx+y*scale,cy+x*scale])}
    return `<path d="${points.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' ')}Z" fill="${color}" fill-opacity=".3" stroke="${color}" stroke-width="2"/>`;
  }
  function camberVisual(now,before){
    let a=tx(110,25,'Caster · сбоку',G,16,'middle')+ln(28,160,192,160,G,1);
    a+=`<circle cx="110" cy="111" r="49" stroke="${G}" fill="#1d2c36" stroke-width="2"/>`;
    for(const [s,c,d]of [[saved,O,'5 4'],[state,L,'']]){const base=110+s.trail*.45;a+=ln(base,160,base-Math.tan(s.caster*M.rad)*135*2,30,c,3,d)}
    a+=tx(110,194,`${f(saved.caster)}° → ${f(state.caster)}°`,L,19,'middle')+tx(110,222,`Trail ${f(state.trail)} mm`,G,15,'middle')+tx(110,249,'Наклон оси ×2',G,13,'middle');
    now.wheels.forEach((w,i)=>{const x=315+i*180,c=i?L:P,sg=i?1:-1,old=before.wheels[i];a+=tx(x,25,`${w.name} · ${role(i)}`,c,17,'middle')+ln(x-52,142,x+52,142,G,1)+ln(x,49,x,142,G,1,'3 4');
      a+=`<g transform="rotate(${old.camber*sg*2} ${x} 142)">${ln(x,142,x,55,O,3,'5 4')}</g><g transform="rotate(${w.camber*sg*2} ${x} 142)"><rect x="${x-12}" y="55" width="24" height="87" rx="4" fill="${c}" fill-opacity=".15" stroke="${c}" stroke-width="3"/></g>`;
      a+=tx(x,171,`${signed(w.camber)}°`,c,25,'middle')+patchShape(w.patch,x,221,.37,c)+tx(x,271,`${f(w.area,0)} cm²`,c,18,'middle');
    });
    return svg(a,'Caster сбоку; Dynamic camber и Contact patch обоих колёс спереди. Наклон колёс увеличен вдвое.');
  }
  function paintCamber(){
    const now=T.at(state),before=T.at({...saved,steer:state.steer,beta:state.beta,yaw:state.yaw,speed:state.speed}),w=now.wheels[wheel],old=before.wheels[wheel];
    $('tn-visual').innerHTML=camberVisual(now,before);
    $('tn-live').innerHTML=now.wheels.map((w,i)=>`<div style="--accent:${i?L:P}"><span>${w.name} · ${role(i)}</span><strong>${signed(w.camber)}°</strong><small>Area ${f(w.area,0)} cm² · ${f(w.retention,0)}% от Camber 0°</small></div>`).join('');
    $('tn-explain').innerHTML=`<b>${w.name}:</b> Static camber ${signed(state.camber)}° + Steering contribution ${signed(w.steeringCamberDelta)}° + Body roll contribution ${signed(w.rollCamberDelta)}° = <b>${signed(w.camber)}°</b>. ${Math.abs(state.caster-saved.caster)>.01?`Caster ${f(saved.caster)}° → ${f(state.caster)}°; Dynamic camber ${signed(old.camber)}° → ${signed(w.camber)}°.`:'Включите Hold dynamic camber и меняйте Caster: Static camber будет компенсировать изменение на выбранном угле.'}`;
    $('tn-stage-caption').textContent=`Steering angle ${signed(state.steer)}° · KPI ${f(state.kpi)}°`;
    paintCurve();
  }
  function paintCurve(){
    if(!active||task!=='camber')return;
    const lo=Math.min(from,to),hi=Math.max(from,to),aa=T.angles(lo,hi,1),series=[saved,state].map(s=>aa.map(steer=>({steer,w:M.calculate({...s,steer,beta:state.beta,yaw:state.yaw,speed:state.speed}).wheels})));
    const values=series.flatMap(row=>row.flatMap(p=>p.w.map(w=>w.camber))),low=Math.floor(Math.min(-1,...values))-1,high=Math.ceil(Math.max(1,...values))+1;
    const x=v=>55+(v-lo)/Math.max(.5,hi-lo)*510,y=v=>180-(v-low)/(high-low)*150;
    let a='';for(let i=0;i<=4;i++){const v=low+(high-low)*i/4;a+=ln(55,y(v),565,y(v),'#283d48',1)+tx(45,y(v)+5,f(v)+'°',G,14,'end');const v2=lo+(hi-lo)*i/4;a+=tx(x(v2),209,f(v2,0)+'°',G,15,'middle')}
    series.forEach((row,j)=>[0,1].forEach(i=>{a+=`<path d="${row.map((p,k)=>(k?'L':'M')+x(p.steer)+' '+y(p.w[i].camber)).join(' ')}" fill="none" stroke="${i?L:P}" stroke-width="${j?3:2}" ${j?'':'stroke-dasharray="6 5" opacity=".5"'}/>`}));
    if(state.steer>=lo&&state.steer<=hi)a+=ln(x(state.steer),25,x(state.steer),183,C,2,'3 4');
    $('tn-curve').innerHTML=svg(a,'Dynamic camber обоих колёс в выбранном Working range','0 0 600 225');
  }
  function prepareRuns(){
    const i=T.leading(state),common={beta:state.beta,yaw:state.yaw,speed:state.speed};
    let a={...saved,...common},b={...state};
    let status='Руль удерживается на одном центральном Steering angle в обоих прогонах.';
    if(holdLead&&i!==null){const old=T.solveSteer(a,i,leadTarget),now=T.solveSteer(b,i,leadTarget);a.steer=old.value;b.steer=now.value;state.steer=now.value;status=old.reached&&now.reached?`${i?'RF':'LF'} на старте ${signed(leadTarget)}° в обоих прогонах. Далее руль удерживается; Bump steer может менять углы.`:`Leading angle недостижим при центральном δ ±55°: было ${signed(old.actual)}°, сейчас ${signed(now.actual)}°.`}
    else{a.steer=state.steer;if(holdLead&&i===null)status='При Drift angle около 0° Leading не определено. Сравнивается одинаковый центральный Steering angle.'}
    $('tn-steer-status').textContent=status;
    const key=JSON.stringify([a,b,inputs]);if(key!==runKey){stop();time=0;runKey=key;const before=D.simulate(a,inputs),now=D.simulate(b,inputs);runPair={before,now,end:Math.min(before.duration,now.duration)}}
  }
  function roadPoints(s){const z=D.initial(s),pts=[];for(let t=0;t<=3.001;t+=.05){const r=z.r;pts.push(Math.abs(r)<1e-7?{t,x:z.u*t,y:z.v*t}:{t,x:(z.u*Math.sin(r*t)+z.v*(Math.cos(r*t)-1))/r,y:(z.u*(1-Math.cos(r*t))+z.v*Math.sin(r*t))/r})}return pts}
  function pathVisual(a,b){
    const road=roadPoints(state),end=runPair.end,old=runPair.before.frames.filter(p=>p.t<=end),now=runPair.now.frames.filter(p=>p.t<=end);
    const recent=p=>p.t>=Math.max(0,time-.35)&&p.t<=Math.min(end,time+.2),all=pathDetail?[...old.filter(recent),...now.filter(recent),a,b]:[...road,...old,...now],pad=pathDetail?1.5:3;
    const minX=Math.min(...all.map(p=>p.x))-pad,maxX=Math.max(...all.map(p=>p.x))+pad,minY=Math.min(...all.map(p=>p.y))-pad,maxY=Math.max(...all.map(p=>p.y))+pad,scale=Math.min(510/(maxY-minY),320/(maxX-minX));
    const x=v=>300-((minY+maxY)/2-v)*-scale,y=v=>210-((minX+maxX)/2-v)*-scale;
    const path=pts=>pts.map((p,i)=>(i?'L':'M')+x(p.y)+' '+y(p.x)).join(' ');
    let out=`<path d="${path(road)}" stroke="#24343e" stroke-width="28" fill="none"/><path d="${path(road)}" stroke="#526671" stroke-dasharray="8 8" fill="none"/>`;
    for(const [row,c,d]of [[old,O,'7 5'],[now,L,'']]){out+=`<path d="${path(row)}" stroke="${c}" stroke-opacity=".25" stroke-width="2" fill="none"/><path d="${path(row.filter(p=>p.t<=time+.001))}" stroke="${c}" stroke-width="3" fill="none" ${d?`stroke-dasharray="${d}"`:''}/>`}
    for(const [z,c,d]of [[a,O,true],[b,L,false]]){
      out+=`<g transform="translate(${x(z.y)} ${y(z.x)}) rotate(${-z.psi*M.deg})"><path d="M-11 23L-11 -19Q0 -30 11 -19L11 23Z" fill="#101a21" fill-opacity=".3" stroke="${c}" stroke-width="2" ${d?'stroke-dasharray="4 3"':''}/><path d="M-8 -12H8L6 -3H-6Z" fill="${c}" fill-opacity=".3"/>`;
      z.wheels.forEach((w,i)=>{out+=`<g transform="translate(${i%2?16:-16} ${i<2?-15:16}) rotate(${-w.delta})"><rect x="-3" y="-8" width="6" height="16" rx="1" fill="${i<2?c:G}"/></g>`});out+='</g>';
    }
    const dir=b.psi+Math.atan2(b.v,b.u);out+=ar(x(b.y),y(b.x),x(b.y)-Math.sin(dir)*52,y(b.x)-Math.cos(dir)*52,C);
    out+=ln(x(a.y),y(a.x),x(b.y),y(b.x),C,2,'3 4')+tx(20,27,`Δ Path ${f(Math.hypot(b.x-a.x,b.y-a.y),2)} m`,C,20)+tx(20,392,pathDetail?'Крупный план текущего участка · расстояния в метрах':'Дорога — исходная дуга · следы — расчёт · кузов увеличен',G,15);
    return svg(out,'Две траектории от сил четырёх шин: сейчас зелёная, было оранжевая; серая дуга — ориентир','0 0 600 410');
  }
  function axleVisual(a,b){
    let out=tx(300,24,'Перед машины ↑ · направления к кузову',G,17,'middle');
    b.wheels.slice(0,2).forEach((w,i)=>{const x=170+i*270,y=153,c=i?L:P,old=a.wheels[i];out+=ln(x,55,x,195,G,1,'3 5');
      for(const [v,co,dash]of [[old,O,'5 4'],[w,c,'']])out+=`<g transform="translate(${x} ${y}) rotate(${-v.delta})"><rect x="-14" y="-36" width="28" height="72" rx="4" fill="#192933" stroke="${co}" stroke-width="3" ${dash?`stroke-dasharray="${dash}"`:''}/></g>`;
      const angle=w.direction*M.rad,d=w.delta*M.rad;out+=ar(x,y,x-Math.sin(angle)*104,y-Math.cos(angle)*104,C)+ar(x,y,x-Math.cos(d)*M.clamp(w.Fy/55,-85,85),y-Math.sin(d)*M.clamp(w.Fy/55,-85,85),O);
      const currentRole=Math.abs(b.beta)<.5?'':(b.beta<0?1:0)===i?'Leading':'Trailing';
      out+=tx(x,221,`${w.name} · ${currentRole}`,c,19,'middle')+tx(x,249,`δ ${signed(w.delta)}° · α ${signed(w.alpha)}°`,c,18,'middle')+tx(x,278,`Fy ${signed(w.Fy/1000,2)} kN`,G,17,'middle');
    });return svg(out,'Углы и силы передних колёс: Velocity голубая; Lateral force оранжевая');
  }
  function paintFrame(){
    if(!runPair)return;time=Math.min(time,runPair.end);const a=D.frameAt(runPair.before,time),b=D.frameAt(runPair.now,time),i=T.leading(state),trail=i===null?0:1-i;
    $('tn-visual').innerHTML=viewPath?pathVisual(a,b):axleVisual(a,b);
    $('tn-live').innerHTML=[['Drift angle',`${signed(b.beta)}°`,`было ${signed(a.beta)}° · Δ ${signed(b.beta-a.beta)}°`],['Speed',`${f(b.speed)} km/h`,`было ${f(a.speed)} · Yaw rate ${signed(b.yaw)}°/s`]].map(([name,v,sub])=>`<div><span>${name}</span><strong>${v}</strong><small>${sub}</small></div>`).join('');
    const w=b.wheels[trail],old=a.wheels[trail],grow=Math.abs(b.beta)-Math.abs(state.beta);
    const status=time===0?'Поверните Ackermann offset и запустите сравнение.':Math.sign(b.beta)!==Math.sign(state.beta)?'Знак Drift angle сменился.':Math.abs(grow)<.2?'Drift angle почти не изменился.':grow>0?'Модуль Drift angle вырос.':'Модуль Drift angle уменьшился.';
    const reason=runPair.before.duration<=runPair.now.duration?runPair.before.reason:runPair.now.reason;
    $('tn-explain').innerHTML=`<b>${w.name}${i===null?'':' · Trailing на старте'}:</b> Wheel angle ${signed(old.delta)}° → ${signed(w.delta)}°; Slip angle ${signed(old.alpha)}° → ${signed(w.alpha)}°. Yaw moment ${signed(w.moment,0)} N·m. <b>${status}</b>${runPair.end<2.999?` Сравнение до ${f(runPair.end,2)} s: ${reason}. Дальше модель не продолжает расчёт.`:''}`;
    $('tn-stage-caption').textContent=`${ackType(state)} · ${signed(state.ack)} mm · ${f(time,2)} s`;
    $('tn-time').textContent=`${f(time,2)} / ${f(runPair.end,2)} s`;$('tn-timeline').max=runPair.end;$('tn-timeline').value=time;
    $('tn-mobile-explain').innerHTML=$('tn-explain').innerHTML;
  }
  function paintLinks(){
    const now=T.at(state),old=T.at({...saved,steer:state.steer,beta:state.beta,yaw:state.yaw,speed:state.speed}),i=T.leading(state)??wheel,w=now.wheels[i],b=old.wheels[i];
    const node=(x,y,label,value,extra,color=G)=>`<rect x="${x}" y="${y}" width="174" height="63" rx="9" stroke="${color}" fill="#17262e"/>`+tx(x+87,y+19,label,color,14,'middle')+tx(x+87,y+41,value,'#e5eff3',18,'middle')+(extra?tx(x+87,y+57,extra,G,11,'middle'):'');
    let out=ar(105,76,105,113,C)+ar(300,76,300,113,C)+ar(477,76,389,113,C)+ar(192,148,210,148,C)+ar(105,181,105,224,C)+ar(300,181,300,224,C)+ar(495,181,495,224,C);
    out+=`<path d="M105 292V316H495V296" fill="none" stroke="${O}" stroke-width="2"/>`+ar(495,315,495,294,O);
    if(!lockTrail)out+=`<path d="M387 43Q408 79 475 111" fill="none" stroke="${L}" stroke-width="2" stroke-dasharray="4 3"/>`;
    out+=node(18,13,'Ackermann offset',`${signed(state.ack)} mm`,ackType(state),linkParameter==='ack'?L:G);
    out+=node(213,13,'Caster',`${f(state.caster)}°`,`KPI ${f(state.kpi)}°`,linkParameter==='caster'?L:G);
    out+=node(408,13,'Static camber',`${signed(state.camber)}°`,'Исходный наклон',linkParameter==='camber'?L:G);
    out+=node(18,117,'Wheel angles',`${signed(now.wheels[0].delta)}° / ${signed(now.wheels[1].delta)}°`,'LF / RF',C);
    out+=node(213,117,'Dynamic camber',`${signed(b.camber)}° → ${signed(w.camber)}°`,`${w.name} · ${role(i)} + Body roll`,C);
    out+=node(408,117,'Mechanical trail',`${f(state.trail)} mm`,`Trail lever сейчас ${f(w.mechTrail*1000)} mm`,linkParameter==='trail'?L:G);
    out+=node(18,229,'Slip angle → Force',`${signed(w.alpha)}° / ${signed(w.Fy/1000,2)} kN`,'Fy зависит также от Camber и Fz',O);
    out+=node(213,229,'Contact patch',`${f(w.area,0)} cm²`,`было ${f(b.area,0)} cm²`,P);
    out+=node(408,229,'Steering torque',`${signed(now.result.torque)} N·m`,'Сумма моментов LF + RF',L);
    out+=tx(300,344,'Руль отпущен → момент меняет Steering angle → связи повторяются',G,13,'middle');
    ackMatch=T.matchAck(state,saved,i,matchMetric);
    $('tn-visual').innerHTML=linkMatchView?matchChart(ackMatch):window.matchMedia('(max-width:760px)').matches?mobileLinks(now,old,i):svg(out,'Связи Ackermann, Caster, Static camber и Mechanical trail через углы, контакт и момент на руле','0 0 600 355');
    $('tn-live').innerHTML=now.wheels.map((v,j)=>`<div style="--accent:${j?L:P}"><span>${v.name} · ${role(j)} · Wheel angle ${signed(v.delta)}°</span><strong>Camber ${signed(v.camber)}°</strong><small>Area ${f(v.area,0)} cm² · Steering torque ${signed(v.torque)} N·m</small></div>`).join('');
    const notes={ack:'Ackermann меняет δ каждого колеса. Поэтому одновременно меняются Dynamic camber, Slip angle, силы и плечи на вывороте.',caster:lockTrail?'Caster меняет ось поворота и Camber на вывороте. Trail сейчас зафиксирован: его влияние отделено от изменения наклона колеса.':'Caster меняет Camber и Mechanical trail при прежнем эквивалентном смещении ступицы. Оба эффекта видны одновременно.',camber:'Static camber задаёт исходный наклон. На вывороте к нему добавляются изменения от Caster, KPI и крена. Меняются контакт и силы шины.',trail:'При удерживаемом руле независимое изменение Trail не меняет углы колёс и Camber. Меняется плечо силы, а значит момент на руле. Если руль отпустить, изменится и выворот.'};
    $('tn-explain').textContent=notes[linkParameter];$('tn-stage-caption').textContent=`${w.name} · ${role(i)||'Target wheel'} · Steering angle ${signed(state.steer)}°`;
    $('tn-link-hint').textContent='Стрелки показывают связи. Площадь контакта здесь рассчитывается отдельно от силы; меньшая площадь не равна меньшему моменту.';
    document.querySelectorAll('[data-tn-link]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.tnLink===linkParameter));
    Object.entries(linkParams).forEach(([k,p])=>$('tn-link-'+k+'-value').textContent=`${signed(state[k])} ${p[4]}`);
    const p=linkParams[linkParameter];$('tn-link-label').textContent=p[0];$('tn-link-unit').textContent=p[4];
    for(const id of ['tn-link-range','tn-link-number']){const el=$(id);el.min=p[1];el.max=p[2];el.step=p[3];el.setAttribute('aria-label',p[0]+': связи'+(id.endsWith('number')?' точно':''));if(document.activeElement!==el)el.value=Number(state[linkParameter].toFixed(3))}
    for(const id of ['tn-link-angle','tn-link-angle-number'])if(document.activeElement!==$(id))$(id).value=state.steer;
    $('tn-link-angle-out').textContent=signed(state.steer)+'°';$('tn-link-lock').checked=lockTrail;
    const best=ackMatch.best,unit=matchMetric==='force'?'N':'N·m';
    $('tn-match-result').textContent=!ackMatch.baselineReachable?'Сохранённые настройки не достигают текущего Leading angle. Сравнение недоступно.':!best?'Нет достижимого сочетания в пределах выворота.':`Цель «Было»: ${signed(ackMatch.target,0)} ${unit}. Ближайший offset ${signed(best.ack)} mm (${ackType(best.setup)}): ${signed(best.value,0)} ${unit}; отклонение ${f(best.error,0)} ${unit}.`;
    $('tn-match-apply').disabled=!best||!ackMatch.baselineReachable;
  }
  function mobileLinks(now,old,i){
    const w=now.wheels[i],b=old.wheels[i],p=linkParams[linkParameter],trail=linkParameter==='trail';
    const node=(x,y,title,value,note,color)=>`<rect x="${x}" y="${y}" width="174" height="85" rx="9" fill="#182830" stroke="${color}"/>`+tx(x+87,y+22,title,color,14,'middle')+tx(x+87,y+49,value,'#edf3f5',20,'middle')+tx(x+87,y+70,note,G,12,'middle');
    let a=ar(186,54,211,54,C)+ar(301,100,301,128,C);
    if(!trail)a+=`<path d="M225 97L185 114L118 114L100 129" fill="none" stroke="${P}" stroke-width="2"/>`;
    a+=node(12,12,p[0],`${signed(state[linkParameter])} ${p[4]}`,linkParameter==='ack'?ackType(state):lockTrail?'Trail фиксирован':'Trail связан с Caster',L);
    a+=linkParameter==='ack'?node(214,12,'Wheel angles',`${signed(now.wheels[0].delta)}° / ${signed(now.wheels[1].delta)}°`,'LF / RF',C):trail?node(214,12,'Trail lever',`${f(w.mechTrail*1000)} mm`,`${w.name} · на вывороте`,C):node(214,12,'Dynamic camber',`${signed(b.camber)}° → ${signed(w.camber)}°`,`${w.name} · ${role(i)}`,C);
    a+=node(12,132,trail?'Camber сохраняется':'Contact patch',`${f(w.area,0)} cm²`,`${w.name} · Camber ${signed(w.camber)}°`,P)+node(214,132,'Steering torque',`${signed(now.result.torque)} N·m`,'Силы × плечи + jacking',L);
    a+=tx(200,246,'Руль отпущен → меняется Steering angle',G,14,'middle');
    return svg(a,'Выбранный параметр, изменение геометрии, контакт и момент на руле','0 0 400 260');
  }
  function matchChart(match){
    const values=match.points.filter(p=>p.reachable).map(p=>p.value).concat(match.target),low=Math.min(...values),high=Math.max(...values),padding=Math.max(10,(high-low)*.15),lo=low-padding,hi=high+padding;
    const x=v=>65+(v+9)/18*475,y=v=>260-(v-lo)/(hi-lo)*190,unit=match.metric==='force'?'N':'N·m',label={moment:'Trailing yaw moment',force:'Trailing lateral force',torque:'Steering torque'}[match.metric];
    let a=tx(300,23,`${label} · ${unit}`,L,19,'middle')+tx(300,46,`Leading angle ${signed(match.targetAngle)}° сохраняется`,G,14,'middle');
    for(let j=0;j<=4;j++){const v=lo+(hi-lo)*j/4;a+=ln(65,y(v),540,y(v),'#2b414c',1)+tx(55,y(v)+5,f(v,0),G,14,'end')}
    let pen=false;const path=match.points.map(p=>{if(!p.reachable){pen=false;return ''}const part=(pen?'L':'M')+x(p.ack)+' '+y(p.value);pen=true;return part}).join(' ');
    a+=ln(65,y(match.target),540,y(match.target),O,2,'5 4')+`<path d="${path}" fill="none" stroke="${C}" stroke-width="3"/>`;
    match.points.filter(p=>p.reachable).forEach(p=>{a+=`<circle cx="${x(p.ack)}" cy="${y(p.value)}" r="${p===match.best?7:3}" fill="${p===match.best?L:C}"/>`});
    [-9,-6,-3,0,3,6,9].forEach(v=>a+=tx(x(v),286,signed(v,0),G,15,'middle'));
    a+=tx(300,311,'Ackermann offset · mm · − внутрь / + наружу',G,15,'middle')+tx(300,338,'Пунктир — прежний эффект · зелёная точка — ближайший',O,14,'middle');
    return svg(a,'Какой Ackermann приближает прежний эффект после изменения Caster и Trail; перебор шагом 1,5 мм','0 0 600 355');
  }
  function paint(){
    const isCamber=task==='camber',isAck=task==='ack';$('tuning-lab').classList.toggle('tn-ack',isAck);$('tuning-lab').classList.toggle('tn-links',task==='links');$('tn-title').textContent=isCamber?'Caster / Camber':isAck?'Ackermann / Path':'Ackermann · Trail · Caster · Camber';
    document.querySelectorAll('[data-tn-task]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tnTask===task));
    $('tn-camber-controls').hidden=!isCamber;$('tn-ack-controls').hidden=!isAck;$('tn-link-controls').hidden=task!=='links';$('tn-range').hidden=!isCamber;$('tn-view').hidden=isCamber;$('tn-playback').hidden=!isAck;
    $('tn-view').textContent=task==='links'?(linkMatchView?'Схема связей':'Подбор Ackermann'):(viewPath?'Передняя ось':'Траектория');
    if(isCamber)paintCamber();else if(isAck){prepareRuns();paintFrame()}else paintLinks();
    document.querySelectorAll('[data-tn-key]').forEach(el=>{if(document.activeElement!==el)el.value=Number(state[el.dataset.tnKey].toFixed(3))});
    for(const k of ['steer','caster','camber','kpi','ack'])$('tn-'+k+'-out').textContent=signed(state[k],k==='camber'?2:1);
    $('tn-hold-camber').checked=holdCamber;$('tn-target-row').hidden=!holdCamber;$('tn-camber').disabled=holdCamber;$('tn-camber-num').disabled=holdCamber;
    if(document.activeElement!==$('tn-target'))$('tn-target').value=targetCamber;$('tn-solve').textContent=solveStatus;
    $('tn-trail-lock').checked=lockTrail;$('tn-hold-lead').checked=holdLead;
    $('tn-wheel').value=wheel;[...$('tn-wheel').options].forEach(o=>o.textContent=`${+o.value?'RF':'LF'} · ${role(+o.value)||'роль не задана'}`);
    for(const id of ['tn-lead-angle','tn-lead-number'])if(document.activeElement!==$(id))$(id).value=Number((holdLead?leadTarget:state.steer).toFixed(3));
    $('tn-lead-label').textContent=holdLead?'Leading wheel angle':'Central steering angle';
    $('tn-ack-kind').textContent=`${ackType(state)} · ${offsetLabel(state.ack)} · ${state.rackSide===1?'рычаг перед осью':'рычаг за осью'}`;
    $('tn-context').textContent=`Drift angle ${signed(state.beta)}° · Speed ${f(state.speed,0)} km/h · Yaw rate ${signed(state.yaw)}°/s · Trail ${f(state.trail)} mm · 235/45 R17${state.tyreWidth!==235||state.tyreAspect!==45||state.rimDiameter!==17?' → '+state.tyreWidth+'/'+state.tyreAspect+' R'+state.rimDiameter:''}`;
    for(const id of ['tn-from','tn-to'])if(document.activeElement!==$(id))$(id).value=id==='tn-from'?from:to;
    $('tn-mobile-explain').innerHTML=$('tn-explain').innerHTML;
  }

  function eligible(r){const indexes=searchGoal==='both'?[0,1]:[wheel];return indexes.every(i=>r.stats[i].minRetention>=retentionGoal&&r.stats[i].variation<=variationGoal)}
  $('tn-search').onclick=async()=>{
    const id=++searchId,base={...state},candidate=T.candidates(base),ranked=[];$('tn-search').disabled=true;$('tn-options').innerHTML='';
    for(let n=0;n<candidate.length;n++){
      if(id!==searchId)return;ranked.push(T.range(candidate[n],from,to,wheel,searchGoal,2));
      if(n%9===0){$('tn-search-status').textContent=`Сравниваю сочетания: ${n+1} / ${candidate.length}…`;await new Promise(resolve=>setTimeout(resolve,0))}
    }
    ranked.sort((a,b)=>Number(eligible(b))-Number(eligible(a))||b.score-a.score);
    choices=ranked.slice(0,8).map(r=>T.range(r.setup,from,to,wheel,searchGoal,.5)).sort((a,b)=>Number(eligible(b))-Number(eligible(a))||b.score-a.score).slice(0,3);
    if(id!==searchId)return;$('tn-search').disabled=false;
    const good=choices.filter(eligible).length;
    $('tn-search-status').textContent=`Проверено ${candidate.length} сочетания. ${good?'Есть варианты в заданных пределах.':'Среди проверенных вариантов цели не достигнуты: ниже ближайшие компромиссы.'} Лучшие варианты уточнены с шагом Steering angle 0,5°. Trail ${f(base.trail)} mm сохранён; рейтинг учебный, без данных реальной шины.`;
    $('tn-options').innerHTML=choices.map((r,n)=>{const a=r.stats[wheel],b=r.stats[1-wheel];return `<article class="tn-option"><span>${eligible(r)?'В пределах цели':'Компромисс'} · ${n+1}</span><h3>Caster ${f(r.setup.caster)}° · Camber ${signed(r.setup.camber,2)}° · KPI ${r.setup.kpi}°</h3><p>${wheel?'RF':'LF'}: Min area ${f(a.minArea,0)} cm² · Retention ${f(a.minRetention)}% · Variation ${f(a.variation)}%</p><p>${wheel?'LF':'RF'}: средний |Fy| ${f(b.meanForce/1000,2)} kN · |Yaw moment| ${f(b.meanMoment,0)} N·m</p><p>Target wheel |Steering torque| ${f(a.meanTorque)} N·m · Mechanical trail ${f(r.setup.trail)} mm</p><button data-tn-apply="${n}">Применить и сравнить</button></article>`}).join('');
  };
  $('tn-options').onclick=e=>{const b=e.target.closest('[data-tn-apply]');if(!b)return;const choice=choices[+b.dataset.tnApply];if(!choice)return;state={...choice.setup};holdCamber=false;lockTrail=true;solveStatus='Применено сочетание. Пунктир сохраняет настройки «Было».';invalidateSearch();sync();paint()};

  function help(){
    $('tn-dialog-title').textContent=task==='camber'?'Caster → Camber → Contact patch':'Ackermann → силы → траектория';
    $('tn-dialog-body').innerHTML=task==='camber'?`<p>Caster поворачивает колесо вокруг наклонной оси. На контррулении Leading может получать больше положительного Dynamic camber: тогда для того же положения к дороге нужен более отрицательный Static camber. У второго колеса изменение иное.</p><p>Выберите Target wheel и Steering angle. Включите <b>Hold dynamic camber</b>: при смене Caster, KPI или Steering angle приложение подберёт Static camber в пределах −5…−3°. Если цели достичь нельзя, будет показана граница. Совпадение Camber в одной точке не означает одинаковую кривую на всём вывороте.</p><p>При <b>Hold mechanical trail</b> плечо сохраняется. Если снять фиксацию, смена Caster меняет Trail при прежнем эквивалентном смещении ступицы. Один и тот же Trail не гарантирует одинаковый Self-steering: меняются силы и другие моменты.</p><p>График сравнивает обе настройки при одинаковых текущих Speed, Drift angle, Yaw rate и Steering angle. Пятна рассчитаны для каждого Camber и нагрузки; они не измеряют сцепление реальной шины.</p><h3>Подбор Working range</h3><p>Перебор: Caster 4…6,5° шаг 0,5°; Static camber −5…−3° шаг 0,25°; KPI 8/10/12°. Вначале участок проверяется с шагом не более 2°, восемь лучших уточняются до 0,5°. Глобальный оптимум не гарантируется.</p><p>Рейтинг Target wheel: Min area retention − 0,35 × Area variation. Для двух колёс берётся среднее. В режиме меньшего влияния второго колеса добавлены штрафы за средние |Fy| относительно capacity и |Yaw moment| относительно μFz·a. Площадь не используется как сила. Настройки задней оси в этом подборе не участвуют.</p><p>Проверяйте контакт в диапазоне вместе со Slip angle и моментами. Уменьшение Caster само по себе не обещает устойчивость всего автомобиля.</p>`:`<p>Зелёная машина — текущие настройки, оранжевая — сохранённые. Серый поворот показывает исходную дугу при постоянных Speed и Yaw rate; рассчитанные траектории могут с неё уйти.</p><p><b>Hold leading angle</b> задаёт одинаковый фактический угол Leading на старте. При смене Ackermann пересчитывается положение рулевого механизма. Так виднее вклад Trailing. Во время прогона руль удерживается; Bump steer может изменить фактические углы. При β около нуля роль Leading не назначается.</p><p>Обе машины стартуют с одинаковыми скоростью, углом заноса и вращением кузова. Rear drive, Brake input и Rear grip одинаковы. Автоматической коррекции рулём или газом нет. Поэтому исходный дрифт не обязан сохраняться три секунды.</p><p>Рассчитываются силы четырёх шин, перемещение кузова и его вращение. Передние колёса используют геометрию MacPherson. Задние направлены вдоль кузова; Rear drive — постоянный запрос тяговой силы как доля доступной силы, а не положение педали газа. Совместная продольная и боковая сила ограничена кругом трения.</p><p>Масса 1250 kg, передняя развесовка 55%, CG height 0,52 m, Yaw inertia 2100 kg·m². Перенос нагрузки приближённый; его сглаживание 0,15 s — допущение, не расчёт амортизаторов. Нет двигателя, дифференциала, нагрева, реальной характеристики шин и полной кинематики подвески.</p><p>Прогон прекращается при Speed &lt; 8 km/h, |Drift angle| &gt; 80°, |Yaw rate| &gt; 150°/s или нулевой нагрузке колеса. Два результата сравниваются в один и тот же момент до первой границы модели.</p><p>Positive / Reverse не задают исход заранее: результат зависит от сил обеих осей. Это учебное сравнение, а не прогноз конкретной машины.</p><p><a href="https://www.mathworks.com/help/vdynblks/ref/vehiclebody3dof.html" target="_blank" rel="noopener">Уравнения плоского движения кузова с четырьмя колёсами</a> · <a href="https://www.wisefab.com/resources/everything-you-need-to-know-about-ackermann-in-drifting" target="_blank" rel="noopener">Wisefab: Ackermann в дрифте</a></p>`;
    if(task==='links'){
      $('tn-dialog-title').textContent='Как связаны четыре настройки';
      $('tn-dialog-body').innerHTML=`<p><b>Ackermann → Wheel angles.</b> Он задаёт разницу углов передних колёс. Поэтому при одном положении рулевого механизма LF и RF получают разные Steering angle.</p><p><b>Wheel angles + Caster + KPI + Static camber → Dynamic camber.</b> Колесо поворачивается вокруг наклонной оси. Изменение Camber зависит от стороны, выворота и крена. На Leading в контррулении меньший Caster может позволить меньше отрицательного Static camber для того же контакта; это проверяется для выбранного колеса и диапазона.</p><p><b>Caster ↔ Mechanical trail.</b> При неизменном смещении ступицы больший Caster увеличивает геометрическое плечо. Но Trail можно менять отдельно конструкцией кулака. Включённый Hold mechanical trail разделяет эти эффекты; реализуемость такой независимой регулировки зависит от деталей подвески.</p><p><b>Trail + силы шины → Steering torque.</b> При удерживаемом Steering angle изменение только Trail не меняет Camber в этой модели. Оно меняет момент на руле. На вывороте фактическое плечо отличается от Trail при прямых колёсах: это Trail lever на схеме.</p><p><b>Свободный руль замыкает связь.</b> Момент поворачивает колёса; меняются углы, Camber и силы, а затем снова момент. Больше Trail не означает одинаково больше Self-steering при любых Slip angle: влияют нагрузка, Pneumatic trail, KPI, геометрический подъём и демпфирование.</p><p>Contact patch — отдельная оценка. В этой модели площадь не подставляется напрямую в формулу силы; Fy учитывает Slip angle, Camber и Fz. Схема не выдаёт маленькое пятно за гарантированно слабое вмешательство Trailing.</p><p><a href="https://www.wisefab.com/resources/everything-you-need-to-know-about-ackermann-in-drifting" target="_blank" rel="noopener">Wisefab: различие углов и их влияние в дрифте</a></p>`;
      $('tn-dialog-body').insertAdjacentHTML('beforeend','<h3>Нужен ли более Positive Ackermann?</h3><p>Универсальной компенсации нет. Same effect сравнивает один выбранный показатель с «Было»: суммарный Steering torque, Yaw moment второго колеса или его Fy. Все варианты держат текущий Leading angle; начальные Speed, Drift angle и Yaw rate одинаковы. Caster, Static camber, Trail и прочая геометрия остаются текущими.</p><p>Перебор Offset −9…+9 mm с шагом 1,5 mm показывает ближайший результат и оставшееся отклонение. Совпадение одного показателя в одной точке не означает одинаковую траекторию, устойчивость или движение свободного руля. Static camber в этом подборе автоматически не компенсируется.</p><p><a href="https://www.wisefab.com/nissan-s14-s15-front-v2-drift-angle-lock-kit-with-rack-relocation" target="_blank" rel="noopener">Wisefab: Self-alignment зависит от сочетания параметров и Trail, а не только Caster</a>.</p>');
    }
    $('tn-dialog-body').insertAdjacentHTML('beforeend','<p>Steering torque приведён к центральному углу δ рулевого механизма. Это не момент на ободе рулевого колеса: передаточное отношение и усилитель руля не рассчитаны.</p>');
    $('tn-dialog').showModal();
  }
  function conditions(){
    $('tn-dialog-title').textContent='Условия сравнения';
    const fields=[['beta','Drift angle',-55,55,1,'°'],['speed','Speed',8,110,1,'km/h'],['yaw','Yaw rate',-40,40,1,'°/s'],['trail','Mechanical trail',-10,100,1,'mm'],['tyrePressure','Tire pressure',1.4,3,.1,'bar']];
    $('tn-dialog-body').innerHTML=fields.map(([k,n,min,max,step,u])=>`<label class="tn-condition">${n}<span><input data-tn-condition="${k}" type="number" min="${min}" max="${max}" step="${step}" value="${state[k]}"> ${u}</span></label>`).join('')+`<label class="tn-condition">Steering arm position<select id="tn-side"><option value="1">Перед осью</option><option value="-1">За осью</option></select></label><p>Изменение условий пересчитывает сравнение. Ackermann offset по-прежнему означает смещение наружу (+) или внутрь (−) на обоих кулаках.</p>`+(task==='ack'?`<h3>Задняя ось и педали</h3>${[['drive','Rear drive',0,.95,.05],['rearGrip','Rear grip factor',.4,1.3,.05],['brake','Brake input',0,.6,.05],['brakeBias','Front brake bias',0,1,.05]].map(([k,n,min,max,step])=>`<label class="tn-condition">${n}<input data-tn-drive="${k}" type="number" min="${min}" max="${max}" step="${step}" value="${inputs[k]}"></label>`).join('')}<p>Rear drive и Brake input — нормированные запросы силы, не проценты положения педалей. Эти условия одинаковы в обоих прогонах.</p>`:'');
    $('tn-side').value=state.rackSide;$('tn-side').onchange=e=>change('rackSide',+e.target.value);
    $('tn-dialog-body').querySelectorAll('[data-tn-condition]').forEach(el=>el.oninput=()=>{if(el.value!==''&&el.validity.valid){change(el.dataset.tnCondition,+el.value);if(el.dataset.tnCondition==='beta'){wheel=T.leading(state)??wheel;leadTarget=M.calculate(state).wheels[wheel].delta}schedule()}});
    $('tn-dialog-body').querySelectorAll('[data-tn-drive]').forEach(el=>el.oninput=()=>{if(el.value!==''&&el.validity.valid){inputs[el.dataset.tnDrive]=+el.value;stop();time=0;runKey='';schedule()}});
    $('tn-dialog').showModal();
  }
  $('tn-close').onclick=()=>$('tn-dialog').close();$('tn-help').onclick=help;$('tn-more').onclick=conditions;$('tn-conditions').onclick=conditions;
  // Expose the requested workflows from existing views without replacing those views.
  document.querySelector('.sw-heading-actions').insertAdjacentHTML('afterbegin','<button id="tn-from-sweep">Связать Caster / Camber</button>');
  $('tn-from-sweep').onclick=()=>{task='camber';open()};
  $('lessons').insertAdjacentHTML('afterbegin','<article class="lesson"><div class="index">НОВОЕ</div><h3>Ackermann / Path</h3><p>Сравните траектории от сил четырёх шин при одинаковом Leading angle на старте.</p><button id="tn-from-course">Сравнить траектории</button></article>');
  $('tn-from-course').onclick=()=>{task='ack';open()};
  const initialTask=location.hash.slice(1);if(['camber','ack','links'].includes(initialTask))task=initialTask;
  lockTrail=true;savedLock=true;open();
})();
