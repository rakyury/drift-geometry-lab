/* Working-range search and editable, constrained result cards. */
window.DriftOptimizer={mount(hooks){
  'use strict';
  const T=DriftTuning,M=DriftModel,S=DriftScenarios,D=DriftDynamics,$=id=>document.getElementById(id);
  const f=(v,n=1)=>Number.isFinite(v)?v.toLocaleString('ru-RU',{minimumFractionDigits:n,maximumFractionDigits:n}):'—';
  const sign=(v,n=1)=>(v>0?'+':'')+f(v,n),kind=s=>Math.abs(s.ack)<.01?'Zero':s.ack*s.rackSide>0?'Positive':'Reverse';
  const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
  let generation=0,choices=[],base=null,config={...S.defaults},goal='leading',retention=95,variation=10,ackMin=-9,ackMax=9,previewIndex=-1,cardJob=0;
  const cardJobs=[0,0,0];
  const editTimers=[0,0,0];
  const bounds={caster:[4,6.5,.5],camber:[-5,-3,.25],kpi:[8,12,2]};
  const labels={caster:'Caster',camber:'Static camber',kpi:'KPI'};
  $('tn-range-settings-placeholder')?.remove();
  $('tn-range').querySelector('.tn-range-settings').insertAdjacentHTML('beforebegin',`
    <div class="op-intro"><h3>Какого поведения вы хотите?</h3><p>Выберите Driving target, затем подберите Ackermann и контакт вместе. Ни один знак Ackermann заранее не назначается победителем.</p></div>
    <div class="op-goal"><label>Driving target<select id="op-scenario">${Object.entries(S.presets).map(([id,p])=>`<option value="${id}">${p.name}</option>`).join('')}</select></label><p id="op-description"></p></div>
    <div id="op-targets" class="op-targets" hidden>
      <label>Target radius <span><input id="op-radius" type="number" min="15" max="200" step="1" value="80"> m</span></label>
      <label>Target drift angle <span><input id="op-angle" type="number" min="10" max="55" step="1" value="25"> °</span></label>
      <label>Rear drive <span><input id="op-drive" type="number" min="0" max=".95" step=".05" value=".7"></span></label>
      <label>Rear grip factor <span><input id="op-grip" type="number" min=".4" max="1.3" step=".05" value=".6"></span></label>
    </div>
    <p id="op-start" class="tn-small"></p>
    <details id="op-protocol" class="op-protocol"><summary>Как проверяется желаемое поведение</summary><p id="op-protocol-text"></p><div id="op-program"></div><p>Rear drive — запрос тяговой силы, не положение педали. Trail сохранён; руль задаётся водителем, поэтому подбор не оценивает Self-steering. Шины и задняя ось приближённые.</p></details>
    <div class="op-ack-range"><strong>Ackermann offset</strong><label>From <input id="op-ack-min" type="number" min="-9" max="9" step="1.5" value="-9"> mm</label><label>To <input id="op-ack-max" type="number" min="-9" max="9" step="1.5" value="9"> mm</label><span>Шаг 1,5 mm · − внутрь / + наружу</span><p id="op-current-ack"></p></div>
  `);
  $('tn-options').insertAdjacentHTML('afterend','<section id="op-preview" hidden aria-label="Сравнение выбранного результата"></section>');
  $('tn-goal').parentElement.firstChild.textContent='Contact target';
  function invalidate(){generation++;cardJob++;editTimers.forEach(clearTimeout);choices=[];previewIndex=-1;$('tn-options').innerHTML='';$('op-preview').hidden=true;$('tn-search').disabled=false;$('tn-search-status').textContent='Нажмите «Подобрать сочетания», чтобы проверить текущие условия.';context()}
  function context(){
    const s=hooks.getSetup();
    $('op-description').textContent=S.presets[config.kind].description;
    $('op-targets').hidden=config.kind==='contact';$('op-protocol').hidden=config.kind==='contact';
    $('op-radius').disabled=config.kind==='transition';
    $('op-current-ack').textContent=`Сейчас: ${kind(s)} · ${sign(s.ack)} mm. ${s.rackSide===1?'Рычаг перед осью: наружу → Positive.':'Рычаг за осью: внутрь → Positive.'}`;
    $('op-start').textContent=config.kind==='contact'?'From / To ниже — диапазон Central steering angle для оценки контакта.':`Старт: Steering angle ${sign(s.steer)}° · Drift angle ${sign(s.beta)}° · Speed ${f(s.speed,0)} km/h · Yaw rate ${sign(s.yaw)}°/s. Выбор сценария задаёт старт и Working range; числа Target задают только желаемый результат. Старт можно изменить через «Условия».`;
    $('op-protocol-text').textContent=config.kind==='transition'?'2 s: одинаковая программа Central steering angle и постоянная тяга. Цель — противоположный угол ±10° в конце и первое удержание целевого диапазона не менее 0,15 s до 1,6 s. Переход через ноль сам по себе не считается удачной перекладкой. Contact target автоматически выбран для обоих колёс: их роли меняются.':'0,6 s без коррекции водителя: один Central steering angle для всех Ackermann. На участке 0,2–0,6 s проверяем Target radius ±20% и Target drift angle ±5°. Это первый отклик, не доказательство устойчивости на всей длинной дуге. Radius вычисляется по изгибу траектории, а не по Yaw rate.';
    const program=S.program(s,config);
    $('op-program').innerHTML=program?`<p>Steering program: ${program.map(p=>`${f(p.t,2)} s → ${sign(p.steer)}°`).join(' · ')}</p>`:'';
  }
  function validContact(r){const indexes=goal==='both'?[0,1]:[hooks.getWheel()];return indexes.every(i=>r.stats[i].minRetention>=retention&&r.stats[i].variation<=variation)}
  const valid=r=>validContact(r)&&(!r.motion||r.motion.ok);
  const score=r=>r.motion?.score!==undefined ? .35*r.score+.65*r.motion.score : r.score;
  const sort=(a,b)=>Number(valid(b))-Number(valid(a))||score(b)-score(a);
  function offsets(){const lo=Math.min(ackMin,ackMax),hi=Math.max(ackMin,ackMax),out=[];for(let v=Math.ceil(lo/1.5)*1.5;v<=hi+1e-8;v+=1.5)out.push(v);return out}
  function range(s,step=2){const r=hooks.getRange();return T.range(s,r.from,r.to,hooks.getWheel(),goal,step)}
  $('op-scenario').onchange=e=>{
    config.kind=e.target.value;const p=S.presets[config.kind];
    if(config.kind!=='contact'){
      config.radius=p.radius;config.angle=p.angle;$('op-radius').value=p.radius;$('op-angle').value=p.angle;
      if(config.kind==='transition'){goal='both';$('tn-goal').value=goal}
      hooks.setScenario(p,config.kind);
    }
    invalidate();
  };
  for(const [id,key] of [['op-radius','radius'],['op-angle','angle'],['op-drive','drive'],['op-grip','rearGrip']])$(id).oninput=e=>{if(e.target.value!==''&&e.target.validity.valid){config[key]=+e.target.value;invalidate()}};
  for(const id of ['op-ack-min','op-ack-max'])$(id).oninput=e=>{if(e.target.value!==''&&e.target.validity.valid){if(id==='op-ack-min')ackMin=+e.target.value;else ackMax=+e.target.value;invalidate()}};
  $('tn-goal').onchange=e=>{goal=e.target.value;invalidate()};
  for(const [id,key] of [['tn-retention','retention'],['tn-variation','variation']])$(id).oninput=e=>{if(e.target.value!==''&&e.target.validity.valid){if(key==='retention')retention=+e.target.value;else variation=+e.target.value;invalidate()}};
  $('tn-search').onclick=async()=>{
    const id=++generation;cardJob++;base={...hooks.getSetup()};choices=[];previewIndex=-1;$('op-preview').hidden=true;
    const candidates=T.candidates(base,offsets()),ranked=[];$('tn-search').disabled=true;$('tn-options').innerHTML='';
    try{
      let yielded=performance.now();
      for(let n=0;n<candidates.length;n++){
        if(id!==generation)return;const r=range(candidates[n]);delete r.points;ranked.push(r);
        if(performance.now()-yielded>16||n===0){$('tn-search-status').textContent=`Contact patch: ${n+1} / ${candidates.length}…`;await tick();yielded=performance.now()}
      }
      ranked.sort(sort);
      // Keep each Ackermann represented: a contact-only shortlist must not discard its sign.
      const short=config.kind==='contact'?ranked.slice(0,12):offsets().flatMap(ack=>ranked.filter(r=>r.setup.ack===ack).slice(0,3));
      const evaluated=[];
      for(let n=0;n<short.length;n++){
        if(id!==generation)return;const r=range(short[n].setup,.5);if(config.kind!=='contact')r.motion=S.evaluate(r.setup,config);evaluated.push(r);
        $('tn-search-status').textContent=`${config.kind==='contact'?'Уточняю контакт':'Driving target'}: ${n+1} / ${short.length}…`;await tick();
      }
      if(id!==generation)return;evaluated.sort(sort);
      // Distinct offsets make the tradeoffs visible, then fill if a single offset was requested.
      const distinct=evaluated.filter((r,i,a)=>a.findIndex(v=>v.setup.ack===r.setup.ack)===i);
      choices=[...distinct,...evaluated.filter(r=>!distinct.includes(r))].slice(0,3).sort(sort).map(r=>({...r,original:{...r.setup},locks:{},editNote:''}));
      $('tn-search-status').textContent=`Проверено ${candidates.length} сочетаний контакта. ${config.kind==='contact'?`${short.length} лучших уточнены`:`Для движения проверены ${short.length} вариантов: до трёх лучших по контакту на каждый Ackermann`}. Contact sweep уточнён до 0,5°. ${choices.some(valid)?'Есть вариант в пределах обеих целей.':'Цели вместе не достигнуты — показаны компромиссы.'} Это поиск по сетке, не глобальный оптимум. Trail ${f(base.trail)} mm сохранён.`;
      renderCards();if(choices.length)showPreview(0);
    }catch(error){$('tn-search-status').textContent='Не удалось завершить расчёт. Измените условия и повторите.';console.error(error)}
    finally{if(id===generation)$('tn-search').disabled=false}
  };
  function motionText(r){
    if(!r.motion)return '';
    const q=r.motion,end=q.run.frames.at(-1),reverse=q.radius!==null&&q.radius*Math.sign(r.setup.yaw)<0;
    return `<div class="op-motion"><strong>${q.ok?'Driving target в пределах цели':'Driving target: компромисс'}</strong><p>${config.kind==='transition'?`Zero crossing ${q.firstZero===null?'не достигнут':f(q.firstZero,2)+' s'} · Opposite angle ${q.reachedAt===null?'не удержан':f(q.reachedAt,2)+' s'}`:`Radius ${q.radius===null?'прямая':f(Math.abs(q.radius),0)+' m'}${reverse?' · изгиб в другую сторону':''}`} · Drift angle ${sign(end.beta)}°</p><p>Δ Speed ${sign(-q.speedLoss)} km/h · Time ${f(q.run.duration,2)} s${q.run.reason?' · '+q.run.reason:''}</p>${!q.ok?`<p>${config.kind==='transition'?'Завершение перекладки в заданных пределах не подтверждено.':`Max angle error ${f(q.angleWorst)}° · Max radius error ${Number.isFinite(q.radiusWorst)?f(q.radiusWorst*100,0)+'%':'смена стороны изгиба'}`}</p>`:''}</div>`;
  }
  function card(r,n){const i=hooks.getWheel(),a=r.stats[i],b=r.stats[1-i],ws=M.calculate(r.setup).wheels;
    return `<article class="tn-option" data-op-card="${n}"><span>${valid(r)?'В пределах цели':'Компромисс'} · ${n+1}</span>
      <h3>Ackermann ${kind(r.setup)} · ${sign(r.setup.ack)} mm</h3><p>Wheel angle LF ${sign(ws[0].delta)}° / RF ${sign(ws[1].delta)}°</p>
      <div class="op-card-fields">${Object.entries(bounds).map(([key,[min,max,step]])=>`<div><label>${labels[key]}<span>${key==='kpi'?`<select data-op-edit="${key}" aria-label="${labels[key]}: вариант ${n+1}">${[8,10,12].map(v=>`<option value="${v}" ${v===r.setup[key]?'selected':''}>${v}°</option>`).join('')}</select>`:`<input type="number" data-op-edit="${key}" aria-label="${labels[key]}: вариант ${n+1}" min="${min}" max="${max}" step="${step}" value="${r.setup[key]}"> °`}</span></label><label class="op-lock"><input type="checkbox" data-op-lock="${key}" ${key in r.locks?'checked':''}> Fixed</label></div>`).join('')}</div>
      <p class="op-edit-hint">Измените значение: оно станет Fixed, остальные подберутся заново. Ackermann этой карточки сохранён.</p>
      <p class="op-edit-status" role="status">${r.editNote||'Можно зафиксировать несколько параметров. Снимите Fixed, чтобы снова включить параметр в подбор.'}</p>
      ${r.editNote?`<div class="op-mini-curve">${curve(r,r.original)}<p>Dynamic camber · LF / RF · пунктир — эта карточка до редактирования</p></div>`:''}
      <p>${i?'RF':'LF'} · Contact target ${validContact(r)?'✓':'не достигнут'}<br>Min area ${f(a.minArea,0)} cm² · Retention ${f(a.minRetention)}% · Variation ${f(a.variation)}%</p>
      <p>${i?'LF':'RF'} · Min area ${f(b.minArea,0)} cm² · Retention ${f(b.minRetention)}% · Variation ${f(b.variation)}%<br>Средний |Fy| ${f(b.meanForce/1000,2)} kN · |Yaw moment| ${f(b.meanMoment,0)} N·m</p>
      ${motionText(r)}<p>Target wheel |Steering torque| ${f(a.meanTorque)} N·m · Trail ${f(r.setup.trail)} mm</p>
      <div class="op-card-buttons"><button data-op-preview="${n}">График и траектория</button><button data-op-apply="${n}">Применить</button></div></article>`;
  }
  function renderCards(){ $('tn-options').innerHTML=choices.map(card).join('') }
  async function edit(n,key,value,locked=true){
    const old=choices[n];if(!old)return;
    clearTimeout(editTimers[n]);if(locked&&old.locks[key]===value)return;
    const id=generation,job=++cardJobs[n];const locks={...old.locks};if(locked)locks[key]=value;else delete locks[key];
    const node=$('tn-options').querySelector(`[data-op-card="${n}"]`);node.querySelector('.op-edit-status').textContent='Пересчитываю свободные параметры…';
    node.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);await tick();
    const seen=new Set(),candidates=T.candidates({...old.setup},[old.setup.ack]).map(s=>({...s,...locks})).filter(s=>{const k=[s.caster,s.camber,s.kpi].join(',');if(seen.has(k))return false;seen.add(k);return true});
    const ranked=[];
    for(let j=0;j<candidates.length;j++){if(generation!==id||job!==cardJobs[n])return;ranked.push(range(candidates[j]));if(j%3===0)await tick()}
    ranked.sort(sort);const refined=[];
    for(const row of ranked.slice(0,config.kind==='contact'?8:6)){if(generation!==id||job!==cardJobs[n])return;const r=range(row.setup,.5);if(config.kind!=='contact')r.motion=S.evaluate(r.setup,config);refined.push(r);await tick()}
    if(generation!==id||job!==cardJobs[n])return;refined.sort(sort);const best=refined[0];
    const changes=Object.keys(bounds).map(k=>`${labels[k]} ${f(old.setup[k],k==='camber'?2:1)}° → ${f(best.setup[k],k==='camber'?2:1)}°`).join(' · ');
    choices[n]={...best,original:old.original,locks,editNote:`${changes}. ${valid(best)?'Цели сохранены.':'В заданных пределах цель не достигнута; показан ближайший проверенный вариант.'}`};
    // Only replace the edited card; other result inputs retain their values and focus.
    node.outerHTML=card(choices[n],n);showPreview(n);
  }
  $('tn-options').onchange=e=>{const el=e.target,node=el.closest('[data-op-card]');if(!node)return;const n=+node.dataset.opCard;
    if(el.dataset.opEdit&&el.value!==''&&el.validity.valid)edit(n,el.dataset.opEdit,+el.value);
    if(el.dataset.opLock)edit(n,el.dataset.opLock,choices[n].setup[el.dataset.opLock],el.checked);
  };
  $('tn-options').oninput=e=>{const el=e.target,node=el.closest('[data-op-card]');if(!node||!el.dataset.opEdit)return;const n=+node.dataset.opCard;clearTimeout(editTimers[n]);const key=el.dataset.opEdit,value=+el.value;if(el.value!==''&&el.validity.valid&&choices[n]?.locks[key]===value){node.querySelectorAll('button').forEach(b=>b.disabled=false);return}node.querySelectorAll('button').forEach(b=>b.disabled=true);if(el.value!==''&&el.validity.valid)editTimers[n]=setTimeout(()=>edit(n,key,value),450)};
  $('tn-options').onclick=e=>{const p=e.target.closest('[data-op-preview]'),a=e.target.closest('[data-op-apply]');if(p){showPreview(+p.dataset.opPreview);$('op-preview').scrollIntoView({behavior:'smooth',block:'start'})}if(a){const r=choices[+a.dataset.opApply];if(r){hooks.applySetup(r.setup,config);context();a.textContent='Применено'}}};
  function curve(r,reference=base){
    const range=hooks.getRange(),old=T.range(reference,range.from,range.to,hooks.getWheel(),'leading',.5),points=r.points;
    let lo=Math.min(...[...old.points,...points].flatMap(p=>p.wheels.map(w=>w.camber)))-.5,hi=Math.max(...[...old.points,...points].flatMap(p=>p.wheels.map(w=>w.camber)))+.5;
    const min=Math.min(range.from,range.to),max=Math.max(range.from,range.to),x=v=>48+(v-min)/Math.max(.01,max-min)*500,y=v=>172-(v-lo)/(hi-lo)*135;
    let out='';for(let j=0;j<4;j++){const v=lo+(hi-lo)*j/3;out+=`<path d="M48 ${y(v)}H548" stroke="#31414b"/><text x="42" y="${y(v)+4}" text-anchor="end">${f(v)}°</text>`}
    for(const [ps,dash] of [[old.points,true],[points,false]])for(let i=0;i<2;i++)out+=`<path d="${ps.map((p,j)=>(j?'L':'M')+x(p.steer)+' '+y(p.wheels[i].camber)).join(' ')}" fill="none" stroke="${i?'#c6f36b':'#d5afff'}" stroke-width="2.5" ${dash?'stroke-dasharray="5 5" opacity=".5"':''}/>`;
    for(let j=0;j<5;j++){const v=min+(max-min)*j/4;out+=`<text x="${x(v)}" y="195" text-anchor="middle">${f(v,0)}°</text>`}
    return `<svg viewBox="0 0 580 210" role="img" aria-label="Dynamic camber: LF и RF, выбранный результат и исходные настройки">${out}</svg>`;
  }
  function motionPlot(r,baseline,t){
    const run=r.motion.run,end=Math.min(run.duration,baseline.run.duration),now=run.frames.filter(p=>p.t<=end),old=baseline.run.frames.filter(p=>p.t<=end),all=[...now,...old];
    const minX=Math.min(...all.map(p=>p.x))-2,maxX=Math.max(...all.map(p=>p.x))+2,minY=Math.min(...all.map(p=>p.y))-2,maxY=Math.max(...all.map(p=>p.y))+2;
    const scale=Math.min(245/(maxX-minX),480/(maxY-minY)),x=v=>285-(v-(minY+maxY)/2)*scale,y=v=>150-((v-(minX+maxX)/2)*scale);
    let body='';
    for(const [ps,c,dash] of [[old,'#ffa66b',true],[now,'#c6f36b',false]]){body+=`<path d="${ps.map((p,j)=>(j?'L':'M')+x(p.y)+' '+y(p.x)).join(' ')}" fill="none" stroke="${c}" stroke-width="2" ${dash?'stroke-dasharray="5 4"':''}/>`;const z=ps.filter(p=>p.t<=t).at(-1)||ps[0];body+=`<g transform="translate(${x(z.y)} ${y(z.x)}) rotate(${-z.psi*M.deg})"><path d="M-7 13V-11Q0 -20 7 -11V13Z" fill="#172229" stroke="${c}" stroke-width="2"/>${z.wheels.slice(0,2).map((w,i)=>`<g transform="translate(${i?10:-10} -10) rotate(${-w.delta})"><path d="M0 -5V5" stroke="${c}" stroke-width="2.5"/></g>`).join('')}</g>`}
    const z=D.frameAt(run,Math.min(t,end));body+=`<text x="20" y="24">Time ${f(t,2)} s · Drift angle ${sign(z.beta)}°</text><text x="20" y="294">Steering angle ${sign(z.commandedSteer)}° · Speed ${f(z.speed)} km/h</text>`;
    return `<svg viewBox="0 0 580 310" role="img" aria-label="Траектория: выбранный вариант зелёный, исходные настройки оранжевые">${body}</svg>`;
  }
  function showPreview(n){
    const r=choices[n];if(!r)return;previewIndex=n;
    let baseline=null,end=0;if(r.motion){baseline=S.evaluate(base,config);end=Math.min(baseline.run.duration,r.motion.run.duration)}
    const node=$('op-preview');node.hidden=false;
    node.innerHTML=`<div class="tn-range-heading"><h3>Вариант ${n+1} · ${kind(r.setup)} ${sign(r.setup.ack)} mm</h3><span>Caster ${f(r.setup.caster)}° · Camber ${f(r.setup.camber,2)}° · KPI ${f(r.setup.kpi,0)}°</span></div><div class="op-preview-grid"><div><h4>Dynamic camber / Steering angle</h4>${curve(r)}<p>LF фиолетовый · RF зелёный · пунктир — настройки до подбора. Условия движения для этого графика фиксированы.</p></div>${r.motion?`<div><h4>Driving target · одинаковое движение руля</h4><div id="op-motion-plot">${motionPlot(r,baseline,end)}</div><label class="op-scrub">Comparison time <input id="op-time" type="range" min="0" max="${end}" step=".01" value="${end}"></label><p>Зелёный — вариант ${n+1} · оранжевый — до подбора. Кузов увеличен. Сравнение до ${f(end,2)} s, до первой остановки модели.${baseline.run.reason?' Исходные настройки: '+baseline.run.reason+'.':''}</p></div>`:''}</div>`;
    if(r.motion)$('op-time').oninput=e=>$('op-motion-plot').innerHTML=motionPlot(r,baseline,+e.target.value);
  }
  context();return {invalidate,context};
}};
