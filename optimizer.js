/* Working-range search and editable, constrained result cards. */
window.DriftOptimizer={mount(hooks){
  'use strict';
  const T=DriftTuning,M=DriftModel,S=DriftScenarios,D=DriftDynamics,$=id=>document.getElementById(id);
  const f=(v,n=1)=>Number.isFinite(v)?v.toLocaleString('ru-RU',{minimumFractionDigits:n,maximumFractionDigits:n}):'—';
  const sign=(v,n=1)=>(v>0?'+':'')+f(v,n),kind=T.ackType;
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
    <div id="op-driver-row" class="op-driver-row" hidden><label>Driver control<select id="op-driver"><option value="feedback">Feedback · реагирует на машину</option><option value="program">Fixed program · руль по таймеру</option></select></label><p id="op-driver-note"></p></div>
    <details id="op-protocol" class="op-protocol"><summary>Как проверяется желаемое поведение</summary><p id="op-protocol-text"></p><div id="op-program"></div><p>Rear drive — запрос тяговой силы, не положение педали. Trail сохранён; руль задаётся водителем, поэтому подбор не оценивает Self-steering. Шины и задняя ось приближённые.</p></details>
    <div class="op-ack-range"><strong>Ackermann offset</strong><label>From <input id="op-ack-min" type="number" min="-9" max="9" step="1.5" value="-9"> mm</label><label>To <input id="op-ack-max" type="number" min="-9" max="9" step="1.5" value="9"> mm</label><span>Шаг 1,5 mm · − внутрь / + наружу</span><p id="op-current-ack"></p></div>
  `);
  $('tn-options').insertAdjacentHTML('afterend','<section id="op-preview" hidden aria-label="Сравнение выбранного результата"></section>');
  $('tn-goal').parentElement.firstChild.textContent='Contact target';
  function invalidate(){generation++;cardJob++;editTimers.forEach(clearTimeout);choices=[];previewIndex=-1;$('tn-options').innerHTML='';if($('op-ranking'))$('op-ranking').innerHTML='';$('op-preview').hidden=true;$('tn-search').disabled=false;$('tn-search-status').textContent='Нажмите «Подобрать сочетания», чтобы проверить текущие условия.';context()}
  function context(){
    const s=hooks.getSetup();
    $('op-description').textContent=config.kind==='transition'&&config.driver==='program'?'Одинаковое движение руля по таймеру. Такой манёвр не реагирует на отклик машины и может не завершить перекладку.':S.presets[config.kind].description;
    $('op-targets').hidden=config.kind==='contact';$('op-protocol').hidden=config.kind==='contact';
    $('op-radius').disabled=config.kind==='transition';
    $('op-driver-row').hidden=config.kind!=='transition';
    $('op-driver-note').textContent=config.driver==='feedback'?'Учебный регулятор: сравнивает желаемый и фактический Drift angle и скорость его изменения; корректирует Steering angle. Один алгоритм для всех Ackermann, но движения руля получаются разными. Rear drive не меняется.':'Контрольный опыт без реакции на автомобиль: руль меняет сторону по расписанию, даже если кузов ещё не перешёл. Такой опыт может провалить перекладку; это не модель водителя.';
    $('op-current-ack').textContent=`Сейчас: ${kind(s)} · ${sign(s.ack)} mm. ${s.rackSide===1?'Рычаг перед осью: наружу → Positive.':'Рычаг за осью: внутрь → Positive.'}`;
    $('op-start').textContent=config.kind==='contact'?'From / To ниже — диапазон Central steering angle для оценки контакта.':`Старт: Steering angle ${sign(s.steer)}° · Drift angle ${sign(s.beta)}° · Speed ${f(s.speed,0)} km/h · Yaw rate ${sign(s.yaw)}°/s. Выбор сценария задаёт старт и Working range; числа Target задают только желаемый результат. Старт можно изменить через «Условия». Ax рассчитывается из сил: заданный Longitudinal acceleration здесь не применяется.`;
    $('op-start').textContent+=` Contact sweep Ax ${sign(s.longitudinalG??0,2)} g · Front anti-dive ${f(s.frontAntiDive??0,0)}% · Rear anti-squat ${f(s.rearAntiSquat??0,0)}%. Anti % и жёсткости сохраняются при подборе.`;
    $('op-protocol-text').textContent=config.kind==='transition'?`2 s: ${config.driver==='feedback'?'одинаковая цель по Drift angle: плавный переход с 0,1 до 1,6 s; Steering angle подбирается по отклику машины':'одинаковая программа Central steering angle'}, постоянная тяга. Цель — противоположный угол ±10° в конце, его изменение не быстрее 15°/s и первое удержание диапазона не менее 0,15 s до 1,6 s. Проход через ноль сам по себе не считается удачной перекладкой. Contact target для обоих колёс: их роли меняются.`:'0,6 s без коррекции водителя: один Central steering angle для всех Ackermann. На участке 0,2–0,6 s проверяем Target radius ±20% и Target drift angle ±5°. Это первый отклик, не доказательство устойчивости на всей длинной дуге. Radius вычисляется по изгибу траектории, а не по Yaw rate.';
    const program=config.driver==='program'?S.program(s,config):null;
    $('op-program').innerHTML=program?`<p>Steering program: ${program.map(p=>`${f(p.t,2)} s → ${sign(p.steer)}°`).join(' · ')}</p>`:config.kind==='transition'?'<p>Feedback — идеализированный регулятор, не обученный водитель. Предел Central steering angle ±55°, скорость его изменения до 120°/s, постоянная времени 0,1 s. Регулятор следит за Drift angle, но не удерживает заданный Radius. Он может не справиться; результат проверяется по фактическому движению.</p>':'';
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
  $('op-driver').onchange=e=>{config.driver=e.target.value;invalidate()};
  for(const id of ['op-ack-min','op-ack-max'])$(id).oninput=e=>{if(e.target.value!==''&&e.target.validity.valid){if(id==='op-ack-min')ackMin=+e.target.value;else ackMax=+e.target.value;invalidate()}};
  $('tn-goal').onchange=e=>{goal=e.target.value;invalidate()};
  for(const [id,key] of [['tn-retention','retention'],['tn-variation','variation']])$(id).oninput=e=>{if(e.target.value!==''&&e.target.validity.valid){if(key==='retention')retention=+e.target.value;else variation=+e.target.value;invalidate()}};
  $('tn-search').onclick=async()=>{
    const id=++generation;cardJob++;base={...hooks.getSetup()};choices=[];previewIndex=-1;$('op-preview').hidden=true;if($('op-ranking'))$('op-ranking').innerHTML='';
    const candidates=T.candidates(base,offsets()),ranked=[];$('tn-search').disabled=true;$('tn-options').innerHTML='';
    try{
      let yielded=performance.now();
      for(let n=0;n<candidates.length;n++){
        if(id!==generation)return;const r=range(candidates[n]);delete r.points;ranked.push(r);
        if(performance.now()-yielded>16||n===0){$('tn-search-status').textContent=`Contact patch: ${n+1} / ${candidates.length}…`;await tick();yielded=performance.now()}
      }
      ranked.sort(sort);
      // Keep each Ackermann represented: a contact-only shortlist must not discard its sign.
      const short=offsets().flatMap(ack=>ranked.filter(r=>r.setup.ack===ack).slice(0,3));
      const evaluated=[];
      for(let n=0;n<short.length;n++){
        if(id!==generation)return;const r=range(short[n].setup,.5);if(config.kind!=='contact')r.motion=S.evaluate(r.setup,config);evaluated.push(r);
        $('tn-search-status').textContent=`${config.kind==='contact'?'Уточняю контакт':'Driving target'}: ${n+1} / ${short.length}…`;await tick();
      }
      if(id!==generation)return;evaluated.sort(sort);
      // Show the best of EACH TYPE, rather than three almost identical offsets of one type.
      choices=T.selectAckTypes(evaluated).map(r=>({...r,original:{...r.setup},locks:{},editNote:''}));
      const absent=['Reverse','Zero','Positive'].filter(name=>!choices.some(r=>kind(r.setup)===name));
      $('tn-search-status').textContent=`Проверено ${candidates.length} сочетаний. Уточнено ${short.length}: до трёх на каждый offset, шаг Contact sweep 0,5°. Ниже лучший проверенный вариант каждого типа Ackermann; порядок карточек — Reverse / Zero / Positive, не рейтинг. ${config.kind==='contact'?'Driving target не выбран: оценка только контакта, без рекомендации по траектории.':'Движение проверено для всех уточнённых вариантов.'} ${absent.length?'В заданном диапазоне нет '+absent.join(' / ')+'. ':''}Это поиск по сетке, не глобальный оптимум. Trail ${f(base.trail)} mm сохранён.`;
      renderCards();if(choices.length)showPreview(choices.indexOf([...choices].sort(sort)[0]));
    }catch(error){$('tn-search-status').textContent='Не удалось завершить расчёт. Измените условия и повторите.';console.error(error)}
    finally{if(id===generation)$('tn-search').disabled=false}
  };
  function motionText(r){
    if(!r.motion)return '';
    const q=r.motion,end=q.run.frames.at(-1),reverse=q.radius!==null&&q.radius*Math.sign(r.setup.yaw)<0;
    return `<div class="op-motion"><strong>${q.ok?'Driving target в пределах цели':'Driving target: компромисс'}</strong><p>${config.kind==='transition'?`Zero crossing ${q.firstZero===null?'не достигнут':f(q.firstZero,2)+' s'} · Opposite angle ${q.reachedAt===null?'не удержан':f(q.reachedAt,2)+' s'}`:`Radius ${q.radius===null?'прямая':f(Math.abs(q.radius),0)+' m'}${reverse?' · изгиб в другую сторону':''}`} · Drift angle ${sign(end.beta)}°</p><p>Δ Speed ${sign(-q.speedLoss)} km/h · Time ${f(q.run.duration,2)} s${q.run.reason?' · '+q.run.reason:''}</p>${!q.ok?`<p>${config.kind==='transition'?'Завершение перекладки в заданных пределах не подтверждено.':`Max angle error ${f(q.angleWorst)}° · Max radius error ${Number.isFinite(q.radiusWorst)?f(q.radiusWorst*100,0)+'%':'смена стороны изгиба'}`}</p>`:''}</div>`;
  }
  function card(r,n){const i=hooks.getWheel(),a=r.stats[i],b=r.stats[1-i],ws=M.calculate(r.setup).wheels;
    return `<article class="tn-option" data-op-card="${n}"><span>${valid(r)?'В пределах цели':'Компромисс'} · ${r.editNote?'после изменения':'лучший проверенный'} ${kind(r.setup)}</span>
      <h3>Ackermann ${kind(r.setup)} · ${sign(r.setup.ack)} mm</h3><p>Wheel angle LF ${sign(ws[0].delta)}° / RF ${sign(ws[1].delta)}°</p>
      <div class="op-card-fields">${Object.entries(bounds).map(([key,[min,max,step]])=>`<div><label>${labels[key]}<span>${key==='kpi'?`<select data-op-edit="${key}" aria-label="${labels[key]}: вариант ${n+1}">${[8,10,12].map(v=>`<option value="${v}" ${v===r.setup[key]?'selected':''}>${v}°</option>`).join('')}</select>`:`<input type="number" data-op-edit="${key}" aria-label="${labels[key]}: вариант ${n+1}" min="${min}" max="${max}" step="${step}" value="${r.setup[key]}"> °`}</span></label><label class="op-lock"><input type="checkbox" data-op-lock="${key}" ${key in r.locks?'checked':''}> Fixed</label></div>`).join('')}</div>
      <p class="op-edit-hint">Измените значение: оно станет Fixed, остальные подберутся заново. Ackermann этой карточки сохранён.</p>
      <p class="op-edit-status" role="status">${r.editNote||'Можно зафиксировать несколько параметров. Снимите Fixed, чтобы снова включить параметр в подбор.'}</p>
      ${r.editNote?`<div class="op-mini-curve">${curve(r,r.original)}<p>Dynamic camber · LF / RF · пунктир — эта карточка до редактирования</p></div>`:''}
      <p>Contact target ${goal==='both'?'LF + RF':i?'RF':'LF'} ${validContact(r)?'✓':'не достигнут'}<br>${i?'RF':'LF'} · Min area ${f(a.minArea,0)} cm² · Retention ${f(a.minRetention)}% · Variation ${f(a.variation)}%</p>
      <p>${i?'LF':'RF'} · Min area ${f(b.minArea,0)} cm² · Retention ${f(b.minRetention)}% · Variation ${f(b.variation)}%<br>Средний |Fy| ${f(b.meanForce/1000,2)} kN · |Yaw moment| ${f(b.meanMoment,0)} N·m</p>
      ${motionText(r)}${config.kind==='transition'?`<p>End drift rate ${sign(r.motion.endBetaRate)}°/s · цель |dβ/dt| ≤ 15°/s</p>`:''}<p>Target wheel |Steering torque| ${f(a.meanTorque)} N·m · Trail ${f(r.setup.trail)} mm</p>
      <div class="op-card-buttons"><button data-op-preview="${n}">График и траектория</button><button data-op-apply="${n}">Применить</button></div></article>`;
  }
  function renderCards(){
    $('tn-options').innerHTML=choices.map(card).join('');
    paintRanking();
  }
  function paintRanking(){
    let explanation=$('op-ranking');if(!explanation){$('tn-options').insertAdjacentHTML('beforebegin','<div id="op-ranking" class="op-ranking"></div>');explanation=$('op-ranking')}
    const best=[...choices].sort(sort)[0],i=hooks.getWheel();
    if(!best){explanation.textContent='';return}
    explanation.innerHTML=`<strong>${config.kind==='contact'?'Почему этот вариант выше по контакту':'Почему этот вариант выше для выбранной цели'}</strong><p>${kind(best.setup)} ${sign(best.setup.ack)} mm: ${goal==='both'?'сравниваются оба колеса':'Target wheel '+(i?'RF':'LF')}. ${config.kind==='contact'?'Radius, удержание Drift angle и перекладка в этом режиме не оценивались.':'Сначала проверяются ограничения контакта и Driving target, затем общий показатель: 35% контакт + 65% движение.'}</p><div>${choices.map(r=>`<span><b>${kind(r.setup)}</b> Retention ${f(r.stats[i].minRetention)}% · Variation ${f(r.stats[i].variation)}%<br>Contact score ${f(r.score,2)}${r.motion?' · Driving score '+f(r.motion.score,2):''}</span>`).join('')}</div><p>Contact score учитывает сохранение площади и её разброс; в режиме меньшего влияния второго колеса — также |Fy| и |Yaw moment|. Небольшая разница не означает универсальное преимущество этого Ackermann. ${valid(best)?'Есть вариант в пределах выбранных ограничений.':'Все показанные варианты — компромиссы.'}</p>`;
  }
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
    node.outerHTML=card(choices[n],n);paintRanking();showPreview(n);
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
    const scale=Math.min(220/(maxX-minX),440/(maxY-minY)),x=v=>290-(v-(minY+maxY)/2)*scale,y=v=>165-((v-(minX+maxX)/2)*scale);
    let body='';
    for(const [ps,c,dash,label] of [[old,'#ffa66b',true,'A'],[now,'#c6f36b',false,'B']]){
      const path=pts=>pts.map((p,j)=>(j?'L':'M')+x(p.y)+' '+y(p.x)).join(' ');
      body+=`<path d="${path(ps)}" fill="none" stroke="${c}" stroke-width="1.5" opacity=".2"/><path d="${path(ps.filter(p=>p.t<=t+.0001))}" fill="none" stroke="${c}" stroke-width="2.5" ${dash?'stroke-dasharray="5 4"':''}/>`;
      const z=ps.filter(p=>p.t<=t).at(-1)||ps[0],cx=x(z.y),cy=y(z.x),heading=z.psi+Math.atan2(z.v,z.u),ex=cx-Math.sin(heading)*42,ey=cy-Math.cos(heading)*42;
      body+=`<g transform="translate(${cx} ${cy}) rotate(${-z.psi*M.deg})"><path d="M-7 13V-11Q0 -20 7 -11V13Z" fill="#172229" stroke="${c}" stroke-width="2"/>${z.wheels.slice(0,2).map((w,i)=>`<g transform="translate(${i?10:-10} -10) rotate(${-w.delta})"><path d="M0 -5V5" stroke="${c}" stroke-width="2.5"/></g>`).join('')}</g>`;
      const ax=ex-cx,ay=ey-cy,len=Math.hypot(ax,ay),ux=ax/len,uy=ay/len;
      body+=`<path d="M${cx} ${cy}L${ex} ${ey}m${-ux*7-uy*4} ${-uy*7+ux*4}L${ex} ${ey}l${-ux*7+uy*4} ${-uy*7-ux*4}" fill="none" stroke="#65d8ef" stroke-width="2"/>`;
      const bx=cx-Math.sin(z.psi)*27,by=cy-Math.cos(z.psi)*27,vx=cx-Math.sin(heading)*27,vy=cy-Math.cos(heading)*27;
      body+=`<path d="M${bx} ${by}A27 27 0 0 ${z.beta<0?1:0} ${vx} ${vy}" fill="none" stroke="${c}" stroke-width="1.5"/><text x="${cx+(label==='A'?-29:19)}" y="${cy+29}" style="fill:${c};font-weight:700">${label}</text>`;
    }
    body+=`<text x="20" y="24">Time ${f(t,2)} s · A — до подбора · B — вариант</text><text x="20" y="317">Голубая стрелка — Velocity · дуга у кузова — Drift angle β</text>`;
    return `<svg viewBox="0 0 580 335" role="img" aria-label="Траектории A и B с направлением скорости и углом заноса каждого кузова">${body}</svg>`;
  }
  function betaPlot(r,baseline,t){
    const end=Math.min(r.motion.run.duration,baseline.run.duration),a=baseline.run.frames.filter(p=>p.t<=end),b=r.motion.run.frames.filter(p=>p.t<=end),values=[...a,...b].flatMap(p=>[p.beta,p.commandedSteer]),target=-Math.sign(r.setup.beta)*config.angle;
    const lo=Math.floor(Math.min(-5,...values,target-10)/10)*10,hi=Math.ceil(Math.max(5,...values,target+10)/10)*10,x=v=>45+v/Math.max(.001,end)*490,y=v=>142-(v-lo)/(hi-lo)*116;
    let out='';for(let j=0;j<=4;j++){const v=lo+(hi-lo)*j/4;out+=`<path d="M45 ${y(v)}H535" stroke="#30434d"/><text x="39" y="${y(v)+4}" text-anchor="end">${f(v,0)}°</text>`}
    if(config.kind==='transition')out+=`<rect x="45" y="${y(target+10)}" width="490" height="${y(target-10)-y(target+10)}" fill="#c6f36b" opacity=".06"/>`;
    out+=`<path d="M45 ${y(0)}H535" stroke="#91a6b3" stroke-dasharray="2 3"/>`;
    const third=config.kind==='transition'&&config.driver==='feedback'?'driverTarget':'commandedSteer';
    for(const [points,key,color,dash] of [[a,'beta','#ffa66b',true],[b,'beta','#c6f36b',false],[b,third,'#65d8ef',true]])out+=`<path d="${points.map((p,j)=>(j?'L':'M')+x(p.t)+' '+y(p[key])).join(' ')}" fill="none" stroke="${color}" stroke-width="2" ${dash?'stroke-dasharray="5 4"':''}/>`;
    out+=`<path d="M${x(t)} 23V145" stroke="#e0edf2" opacity=".65"/>`;
    [0,end/2,end].forEach(v=>out+=`<text x="${x(v)}" y="164" text-anchor="middle">${f(v,2)} s</text>`);
    return `<svg viewBox="0 0 580 178" role="img" aria-label="Drift angle обоих автомобилей и ${third==='driverTarget'?'цель регулятора':'Steering angle'} по времени">${out}</svg>`;
  }
  function axlePlot(z,color){
    let out='<text x="135" y="17" text-anchor="middle">Перед кузова ↑</text><path d="M50 74H220" stroke="#42565e"/>';
    z.wheels.slice(0,2).forEach((w,i)=>{
      const x=i?210:60,angle=w.direction*M.rad,ex=x-Math.sin(angle)*42,ey=74-Math.cos(angle)*42;
      out+=`<g transform="translate(${x} 74) rotate(${-w.delta})"><rect x="-6" y="-20" width="12" height="40" rx="3" fill="#132128" stroke="${color}" stroke-width="2"/><path d="M0 11V-32m-4 6l4 -6 4 6" fill="none" stroke="${color}" stroke-width="2"/></g><path d="M${x} 74L${ex} ${ey}" stroke="#65d8ef" stroke-width="2" stroke-dasharray="3 2"/><circle cx="${ex}" cy="${ey}" r="3" fill="#65d8ef"/><text x="${x}" y="129" text-anchor="middle">${w.name} δ ${sign(w.delta)}°</text><text x="${x}" y="148" text-anchor="middle">Slip angle ${sign(w.alpha)}°</text>`;
    });
    return `<svg viewBox="0 0 270 160" role="img" aria-label="Передняя ось относительно кузова: угол каждого колеса и локальное направление движения">${out}</svg>`;
  }
  function runMetrics(r,baseline,t){
    return [[baseline,'A · До подбора','#ffa66b'],[r.motion,'B · Вариант','#c6f36b']].map(([q,label,color])=>{
      const z=D.frameAt(q.run,t),k=D.curvature(z),opposite=-Math.sign(q.run.setup.beta)*z.beta;
      let status='Свободный отклик при удерживаемом руле.';
      if(config.kind==='transition')status=t>=q.run.duration-.01?(q.ok?'Противоположный угол достигнут и удержан.':'Перекладка не удержана в целевом диапазоне.'):(opposite<-.5?'Ещё исходная сторона заноса.':Math.abs(z.beta)<3?'Проход через ноль — угол ещё не удержан.':`Противоположная сторона: ${f(opposite)}° из цели ${f(config.angle,0)}°.`);
      return `<div style="--run-color:${color}"><strong>${label}</strong><b>Drift angle β ${sign(z.beta)}°</b><span>Steering angle δ ${sign(z.commandedSteer)}°</span>${z.driverTarget!==undefined?`<span>Driver target β ${sign(z.driverTarget)}° · Steering command ${sign(z.driverCommand)}°</span>`:''}${axlePlot(z,color)}<span>Цветная стрелка — куда смотрит колесо; голубой пунктир — куда движется его центр.</span><span>Front / Rear pitch travel ${sign(z.pitch.frontTravel)} / ${sign(z.pitch.rearTravel)} mm · Body pitch ${sign(z.pitch.pitch)}°</span><span>Speed ${f(z.speed)} km/h · Radius ${Math.abs(k)<1e-6?'∞':f(Math.abs(1/k),0)+' m '+(k>0?'влево':'вправо')}</span><p>${status}${q.run.reason&&t>=q.run.duration-.01?' '+q.run.reason+'.':''}</p></div>`;
    }).join('');
  }
  function showPreview(n){
    const r=choices[n];if(!r)return;previewIndex=n;
    let baseline=null,end=0;if(r.motion){baseline=S.evaluate(base,config);end=Math.min(baseline.run.duration,r.motion.run.duration)}
    const node=$('op-preview');node.hidden=false;const feedback=config.kind==='transition'&&config.driver==='feedback';
    node.innerHTML=`<div class="tn-range-heading"><h3>Вариант ${n+1} · ${kind(r.setup)} ${sign(r.setup.ack)} mm</h3><span>Caster ${f(r.setup.caster)}° · Camber ${f(r.setup.camber,2)}° · KPI ${f(r.setup.kpi,0)}°</span></div><div class="op-preview-grid"><div><h4>Dynamic camber / Steering angle</h4>${curve(r)}<p>LF фиолетовый · RF зелёный · пунктир — настройки до подбора. Условия движения для этого графика фиксированы.</p></div>${r.motion?`<div><h4>${feedback?'Перекладка · Feedback':config.kind==='transition'?'Перекладка · Fixed program':'Свободный отклик без коррекций'}</h4><p>Drift angle β — угол от продольной оси кузова к Velocity. Steering angle δ — колёса относительно кузова: «+» влево, «−» вправо. Это разные углы.</p><div id="op-motion-plot">${motionPlot(r,baseline,end)}</div><label class="op-scrub">Comparison time <input id="op-time" type="range" min="0" max="${end}" step=".01" value="${end}"></label><div id="op-run-metrics" class="op-run-metrics">${runMetrics(r,baseline,end)}</div><h4>Drift angle β / Time</h4><div id="op-beta-plot">${betaPlot(r,baseline,end)}</div><p>A — оранжевый · B — зелёный · ${feedback?'Driver target β':'Steering angle δ'} — голубой пунктир. ${config.kind==='transition'?'Подсветка — желаемый противоположный угол ±10°.':''}</p><p>${feedback?'Одинаковая цель и один алгоритм Feedback; фактические движения руля разные. Steering command — запрос регулятора, Steering angle — уже достигнутое положение.':'Руль движется одинаково в обоих прогонах; на фактическое положение кузова программа не реагирует.'} Сравнение до ${f(end,2)} s, до первой остановки модели. Кузова увеличены.${baseline.run.reason?' A: '+baseline.run.reason+'.':''}${r.motion.run.reason?' B: '+r.motion.run.reason+'.':''}</p></div>`:''}</div>`;
    if(r.motion)$('op-time').oninput=e=>{const t=+e.target.value;$('op-motion-plot').innerHTML=motionPlot(r,baseline,t);$('op-run-metrics').innerHTML=runMetrics(r,baseline,t);$('op-beta-plot').innerHTML=betaPlot(r,baseline,t)};
  }
  function reset(){
    config={...S.defaults};goal='leading';retention=95;variation=10;ackMin=-9;ackMax=9;
    for(const [id,value] of Object.entries({'op-scenario':config.kind,'op-driver':config.driver,'op-radius':config.radius,'op-angle':config.angle,'op-drive':config.drive,'op-grip':config.rearGrip,'tn-goal':goal,'tn-retention':retention,'tn-variation':variation,'op-ack-min':ackMin,'op-ack-max':ackMax}))$(id).value=value;
    invalidate();
  }
  context();return {invalidate,context,reset};
}};
