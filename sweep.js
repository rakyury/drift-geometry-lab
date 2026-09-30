(() => {
  'use strict';
  const S=DriftSweep,colors=['#d5afff','#c6f36b'];
  const metrics={camber:['Dynamic camber','°'],area:['Contact patch','cm²'],retention:['Area retention','%'],slip:['Slip angle','°'],force:['Lateral force','kN'],moment:['Yaw moment','N·m'],torque:['Steering torque','N·m']};
  const tuning=['kpi','camber','caster','trail','ack','rc','tyrePressure','tyreCompliance','springRate','scrub','beta','yaw','speed'];
  let active=false,limit=30,from=-30,to=0,metric='camber',parameter='kpi',saved={...state},savedLock=lockTrail,showSaved=true;
  let curve,oldCurve,curveKey='',oldKey='',chartKey='',summaryKey='',sweepPlaying=false,animationTime=0,animationPhase=0,pointer=null;
  const scales=new Map(),n=(v,d=1)=>Number.isFinite(v)?fmt(v,d):'—',sign=(v,d=1)=>Number.isFinite(v)?sgn(v,d):'—';
  const dfn=k=>definitions.find(d=>d[0]===k),setupKey=s=>JSON.stringify({...s,steer:0}),label=i=>i?'RF':'LF';
  const role=i=>S.leading(state)===null?'роль не определена':S.leading(state)===i?'Leading':'Trailing';
  const text=(x,y,t,color='#99acb8',size=16,anchor='start')=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}">${t}</text>`;
  const line=(x1,y1,x2,y2,c='#354751',dash='')=>`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${c}" ${dash?'stroke-dasharray="'+dash+'"':''}/>`;
  document.querySelector('.mode-switch').insertAdjacentHTML('afterbegin','<button id="sweep-mode" aria-pressed="false">Графики</button>');
  document.querySelector('main').insertAdjacentHTML('afterbegin',`<section id="sweep-lab" hidden aria-label="Camber sweep">
    <div class="sw-heading"><div><h1>Camber sweep</h1><p>Оба колеса · весь диапазон руления</p></div><div class="sw-heading-actions"><button id="sw-help">Справка</button><button id="sw-results">Итоги диапазона</button></div></div>
    <div class="sw-layout"><div class="sw-main">
      <div class="sw-top"><label for="sw-limit">Steering angle limit <span>± <input id="sw-limit" type="number" min="1" max="55" step="1" value="30"> °</span></label><label for="sw-metric" class="sr-only">Показатель графика</label><select id="sw-metric">${Object.entries(metrics).map(([k,v])=>`<option value="${k}">${v[0]}</option>`).join('')}</select></div>
      <div id="sw-legend" class="sw-legend"></div><div id="sw-plots" class="sw-plots"></div>
      <div id="sw-point" class="sw-point" aria-label="Значения в выбранной точке"></div>
      <div class="sw-cursor-control"><div><label for="sw-angle">Steering angle δ</label><output id="sw-angle-value"></output><button id="sw-play">Пройти диапазон</button></div><input id="sw-angle" type="range" min="-30" max="30" step="0.5" value="-28"><div class="sw-endpoints"><button id="sw-negative">−30°</button><button id="sw-zero">0°</button><button id="sw-positive">+30°</button></div></div>
    </div><aside class="sw-settings">
      <div class="sw-tune-shortcuts">${['kpi','camber','caster'].map(k=>`<button data-sw-key="${k}"></button>`).join('')}</div>
      <div class="sw-tune-heading"><label for="sw-parameter" class="sr-only">Изменяемый параметр</label><select id="sw-parameter">${tuning.map(k=>`<option value="${k}">${dfn(k)[1]}</option>`).join('')}</select><output id="sw-tune-value"></output></div>
      <div class="sw-tune-input"><button id="sw-minus" aria-label="Уменьшить настройку">−</button><input id="sw-tune" type="range"><button id="sw-plus" aria-label="Увеличить настройку">+</button><input id="sw-tune-number" type="number" aria-label="Точное значение настройки"></div>
      <label class="sw-lock" id="sw-lock-wrap"><input id="sw-lock" type="checkbox"> Сохранять Mechanical trail</label>
      <div class="sw-actions"><button id="sw-save">Запомнить</button><button id="sw-restore">Вернуть</button><label><input id="sw-compare" type="checkbox" checked> Было</label><button id="sw-options">Условия</button></div>
      <div class="sw-window"><p>Working range <span id="sw-window-value"></span></p><div class="sw-window-inputs"><label for="sw-from">От <input id="sw-from" type="number" step="0.5" value="-30">°</label><label for="sw-to">До <input id="sw-to" type="number" step="0.5" value="0">°</label></div><div class="sw-window-buttons"><button data-sw-window="negative">Вправо</button><button data-sw-window="positive">Влево</button><button data-sw-window="both">Обе стороны</button></div></div>
      <p id="sw-context" class="sw-context"></p><p class="sw-fixed">Движение кузова фиксировано. ±δ — поворот руля в одном заносе. Обратный ход проходит по той же кривой: гистерезис не моделируется.</p>
    </aside></div>
    <div id="sw-summary" class="sw-summary"></div>
    <p class="sw-limits">Contact patch — расчётная оценка площади, а не показатель сцепления. Lateral force и Yaw moment рассчитаны отдельной моделью: малая площадь сама по себе не гарантирует слабое влияние Trailing wheel. <button id="sw-model-info">Как читать результаты</button></p>
    <dialog id="sw-dialog" aria-labelledby="sw-dialog-title"><div class="sw-dialog-head"><h2 id="sw-dialog-title"></h2><button id="sw-dialog-close" autofocus>Закрыть</button></div><div id="sw-dialog-body"></div></dialog>
  </section>`);

  function setParameter(k){parameter=k;const d=dfn(k);$('sw-parameter').value=k;for(const id of ['sw-tune','sw-tune-number']){const el=$(id);el.min=d[2];el.max=d[3];el.step=id==='sw-tune-number'&&k!=='ack'?'any':d[4];el.setAttribute('aria-label',d[1]+(id.endsWith('number')?': точное значение':': график'))}renderSweep()}
  function stop(){sweepPlaying=false;$('sw-play').textContent='Пройти диапазон';$('sw-play').setAttribute('aria-pressed','false')}
  function setCursor(v,manual=true){if(manual)stop();setValue('steer',Math.round(M.clamp(v,-limit,limit)*2)/2)}
  function setLimit(v){if(!Number.isFinite(v))return;stop();const wasLimit=limit;limit=Math.round(M.clamp(v,1,55));from=from===-wasLimit?-limit:M.clamp(from,-limit,limit);to=to===wasLimit?limit:M.clamp(to,-limit,limit);$('sw-limit').value=limit;setCursor(state.steer)}
  function setWindow(a,b){if(!Number.isFinite(a)||!Number.isFinite(b))return;from=M.clamp(Math.min(a,b),-limit,limit);to=M.clamp(Math.max(a,b),-limit,limit);renderSweep()}
  function open(){ $('learn-mode').click();active=true;document.body.classList.add('sweep-mode');$('explorer').hidden=true;$('sweep-lab').hidden=false;$('sweep-mode').setAttribute('aria-pressed','true');$('learn-mode').setAttribute('aria-pressed','false');state.steer=M.clamp(state.steer,-limit,limit);sync();setParameter(parameter);window.scrollTo(0,0) }
  document.addEventListener('geometry-mode',()=>{active=false;stop();$('sweep-lab').hidden=true;document.body.classList.remove('sweep-mode');$('sweep-mode').setAttribute('aria-pressed','false')});
  const previousRender=render;render=function(){if(active){result=M.calculate(state);renderSweep()}else previousRender()};
  const previousReset=$('reset').onclick;$('reset').onclick=()=>{stop();previousReset();if(active){limit=30;from=-30;to=0;saved={...state};savedLock=lockTrail;oldKey='';chartKey='';renderSweep()}};
  $('sweep-mode').onclick=open;

  function chart(k,secondary){
    const currentValues=curve.points.flatMap(p=>p.wheels.map(w=>w[k])).filter(Number.isFinite),oldValues=showSaved?oldCurve.points.flatMap(p=>p.wheels.map(w=>w[k])).filter(Number.isFinite):[];
    let lo=Math.min(...currentValues,...oldValues),hi=Math.max(...currentValues,...oldValues);
    if(['area','retention'].includes(k))lo=0;else{lo=Math.min(lo,0);hi=Math.max(hi,0)}
    const pad=Math.max((hi-lo)*.08,k==='force'?.1:k==='area'?1:.3);hi+=pad;if(!['area','retention'].includes(k))lo-=pad;
    const x=v=>55+(v+limit)/(limit*2)*475,y=v=>202-(v-lo)/(hi-lo)*165;scales.set(k,{x,y,lo,hi});
    let h=`<rect x="${x(from)}" y="37" width="${Math.max(1,x(to)-x(from))}" height="165" fill="#76a657" opacity=".1"/>`;
    for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;h+=line(55,y(v),530,y(v),'#2a3b44')+text(46,y(v)+5,n(v,k==='force'?1:Math.abs(hi-lo)<4?1:0),'#94a8b3',15,'end')}
    for(const v of [-limit,-limit/2,0,limit/2,limit])h+=line(x(v),37,x(v),202,v===0?'#6a808c':'#283a43',v===0?'4 4':'')+text(x(v),226,sign(v,Number.isInteger(v)?0:1)+'°','#9bb0be',17,'middle');
    if(lo<0&&hi>0)h+=line(55,y(0),530,y(0),'#78939e','4 4');
    const path=(data,i,dashed)=>{let pen=false;const d=data.points.map(p=>{const v=p.wheels[i][k];if(!Number.isFinite(v)){pen=false;return ''}const segment=(pen?'L':'M')+x(p.angle).toFixed(2)+' '+y(v).toFixed(2);pen=true;return segment}).join(' ');return `<path d="${d}" fill="none" stroke="${colors[i]}" stroke-width="${S.leading(state)===i?3.5:2.5}" ${dashed?'stroke-dasharray="7 6" opacity=".45"':''}/>`};
    if(showSaved)for(let i=0;i<2;i++)h+=path(oldCurve,i,true);for(let i=0;i<2;i++)h+=path(curve,i,false);
    h+=`<g class="sw-plot-cursor" data-metric="${k}"></g>`+text(530,252,'Steering angle δ · °','#9bb0be',17,'end');
    return `<section class="sw-chart${secondary?' secondary':''}" data-metric="${k}"><h2>${metrics[k][0]} <span>${metrics[k][1]}</span></h2><svg viewBox="0 0 560 265" role="img" aria-label="${metrics[k][0]} обоих колёс от −${limit}° до +${limit}°; выделен рабочий диапазон"><title>${metrics[k][0]} по Steering angle</title>${h}</svg></section>`;
  }
  function miniPatch(p,i){
    const cx=42,cy=42,scale=.27,sg=i?1:-1;let dots='';const peak=Math.max(p.peakBar,.01);
    for(let y=-p.half;y<p.half;y+=12)for(let x=-p.length/2;x<p.length/2;x+=12){const q=M.contactPressure(p,x,y);if(q>0)dots+=`<rect x="${cx+sg*y*scale-1.7}" y="${cy+x*scale-1.7}" width="3.5" height="3.5" fill="hsl(${190-M.clamp(q*10/peak,0,1)*145} 75% 60%)"/>`}
    return `<svg viewBox="0 0 84 84" role="img" aria-label="Форма пятна ${label(i)} при выбранном угле; яркость относительно пика этого пятна">${dots}</svg>`;
  }
  function summaryHTML(){
    const now=S.summarize(curve,from,to),before=S.summarize(oldCurve,from,to);
    return `<h2>Working range: ${sign(from)}° … ${sign(to)}°</h2><p>Экстремумы по точкам с шагом не более 0,5°. Шире участок — больше виден разброс.</p><div class="sw-summary-grid">${now.map((v,i)=>`<article style="--wheel:${colors[i]}"><h3>${v.name} · ${role(i)}</h3><dl><div><dt>Dynamic camber</dt><dd>${sign(v.camber.min)}° … ${sign(v.camber.max)}°</dd></div><div><dt>Contact patch min</dt><dd>${n(v.area.min)} cm² <small>при δ ${sign(v.area.atMin)}°</small></dd></div><div><dt>Contact patch max</dt><dd>${n(v.area.max)} cm² <small>при δ ${sign(v.area.atMax)}°</small></dd></div><div><dt>Area variation</dt><dd>${n(v.variation)}% <small>${showSaved?'было '+n(before[i].variation)+'% · ':''}(max − min) / средняя</small></dd></div><div><dt>Area retention min</dt><dd>${n(v.retention?.min)}% <small>от пятна при Camber 0°, той же нагрузке и шине</small></dd></div></dl></article>`).join('')}</div><p>Для Leading сравнивайте и минимальную площадь, и её разброс: стабильно маленькое пятно тоже даст низкую Area variation. Для Trailing дополнительно смотрите Slip angle, Lateral force, Yaw moment и Steering torque.</p>`;
  }
  function syncControls(){
    for(const [id,v]of [['sw-limit',limit],['sw-from',from],['sw-to',to],['sw-tune-number',state[parameter]]])if(document.activeElement!==$(id))$(id).value=v;
    for(const id of ['sw-from','sw-to','sw-angle']){$(id).min=-limit;$(id).max=limit}
    $('sw-angle').value=state.steer;$('sw-angle-value').textContent=sign(state.steer)+'°';$('sw-negative').textContent='−'+limit+'°';$('sw-positive').textContent='+'+limit+'°';
    $('sw-tune').value=state[parameter];$('sw-tune-value').textContent=sign(state[parameter],dfn(parameter)[4]<.1?2:1)+' '+dfn(parameter)[5];
    $('sw-lock-wrap').hidden=!['caster','trail'].includes(parameter);$('sw-lock').checked=lockTrail;$('sw-compare').checked=showSaved;
    document.querySelectorAll('[data-sw-key]').forEach(b=>{const k=b.dataset.swKey;b.textContent=dfn(k)[1]+' '+n(state[k])+'°';b.classList.toggle('active',k===parameter);b.setAttribute('aria-pressed',k===parameter)});
    $('sw-window-value').textContent=sign(from,0)+'° … '+sign(to,0)+'°';
    $('sw-context').textContent=`Drift angle β ${sign(state.beta)}° · Yaw rate ${sign(state.yaw)}°/s · Speed ${n(state.speed,0)} km/h · Body roll ${sign(result.roll,2)}° · ${state.tyreWidth}/${state.tyreAspect} R${state.rimDiameter} · ${n(state.tyrePressure)} bar`;
  }
  function renderSweep(){
    if(!active)return;const key=setupKey(state)+'/'+limit,refKey=setupKey(saved)+'/'+limit;
    if(key!==curveKey){curve=S.build(state,limit);curveKey=key}if(refKey!==oldKey){oldCurve=S.build(saved,limit);oldKey=refKey}
    const nextChartKey=[curveKey,oldKey,metric,from,to,showSaved].join('|');
    if(nextChartKey!==chartKey){$('sw-plots').innerHTML=chart(metric,false)+chart(metric==='camber'?'area':'camber',true);chartKey=nextChartKey;summaryKey=''}
    const point=S.sample(state,state.steer),reference=S.sample(saved,state.steer);
    $('sw-legend').innerHTML=[0,1].map(i=>`<span style="color:${colors[i]}"><i style="background:${colors[i]}"></i>${label(i)} · ${role(i)}</span>`).join('')+`<small>${showSaved?'Пунктир — было · ':''}фон — Working range</small>`;
    document.querySelectorAll('.sw-plot-cursor').forEach(g=>{const k=g.dataset.metric,scale=scales.get(k),x=scale.x(state.steer);g.innerHTML=line(x,37,x,202,'#65d8ef','3 4')+point.wheels.map((w,i)=>Number.isFinite(w[k])?`<circle cx="${x}" cy="${scale.y(w[k])}" r="4.5" fill="${colors[i]}" stroke="#101820" stroke-width="1.5"/>`:'').join('')});
    $('sw-point').innerHTML=point.wheels.map((w,i)=>`<article style="--wheel:${colors[i]}">${miniPatch(w.patch,i)}<div><h3>${w.name} · ${role(i)}</h3><p>Camber <b>${sign(w.camber)}°</b> · Area <b>${n(w.area,0)} cm²</b></p><p>${metrics[metric][0]} <strong>${sign(w[metric],metric==='moment'?0:1)} ${metrics[metric][1]}</strong>${showSaved?` <small>было ${sign(reference.wheels[i][metric],1)}</small>`:''}</p><small>Wheel angle ${sign(w.delta)}° · Fz ${n(w.Fz/1000,2)} kN</small></div></article>`).join('');
    if(summaryKey!==nextChartKey){$('sw-summary').innerHTML=summaryHTML();summaryKey=nextChartKey;if($('sw-dialog').open&&$('sw-dialog').dataset.kind==='summary')$('sw-dialog-body').innerHTML=$('sw-summary').innerHTML}
    syncControls();
  }
  function showDialog(kind){
    $('sw-dialog').dataset.kind=kind;
    if(kind==='summary'){$('sw-dialog-title').textContent='Итоги диапазона';$('sw-dialog-body').innerHTML=$('sw-summary').innerHTML}
    else if(kind==='conditions'){
      $('sw-dialog-title').textContent='Условия и Working range';
      $('sw-dialog-body').innerHTML=`<p>Меняется угол руля при одном заданном движении кузова. Leading / Trailing определяются по направлению бокового скольжения, а не по знаку Steering angle. При |β| &lt; 0,5° роли не назначаются.</p><div class="sw-dialog-inputs">${['beta','yaw','speed','wheelTravelLF','wheelTravelRF'].map(k=>`<label>${dfn(k)[1]} <input data-sw-condition="${k}" type="number" min="${dfn(k)[2]}" max="${dfn(k)[3]}" step="any" value="${state[k]}"> ${dfn(k)[5]}</label>`).join('')}</div><label><input id="sw-dialog-roll" type="checkbox" ${state.bumpFromRoll?'checked':''}> Body roll → Bump steer</label><button id="sw-mirror">Зеркальный занос</button><p>Зеркало меняет знаки Drift angle и Yaw rate, меняет местами ручной Wheel input LF/RF. Руль и рабочий участок также зеркалятся.</p><div class="sw-dialog-inputs"><label>Working range from <input id="sw-dialog-from" type="number" step="0.5" min="${-limit}" max="${limit}" value="${from}">°</label><label>Working range to <input id="sw-dialog-to" type="number" step="0.5" min="${-limit}" max="${limit}" value="${to}">°</label></div><div class="sw-window-buttons"><button data-sw-window="negative">0…−${limit}°</button><button data-sw-window="positive">0…+${limit}°</button><button data-sw-window="both">Обе стороны</button></div>`;
      $('sw-dialog-roll').onchange=e=>setValue('bumpFromRoll',e.target.checked?1:0);
      $('sw-mirror').onclick=()=>{stop();state={...state,beta:-state.beta,yaw:-state.yaw,steer:-state.steer,wheelTravelLF:state.wheelTravelRF,wheelTravelRF:state.wheelTravelLF};const f=from;from=-to;to=-f;sync();render();showDialog('conditions')};
      for(const id of ['sw-dialog-from','sw-dialog-to']){const update=()=>{const a=$('sw-dialog-from'),b=$('sw-dialog-to');if(a.value!==''&&b.value!==''&&a.validity.valid&&b.validity.valid)setWindow(+a.value,+b.value)};$(id).oninput=update;$(id).onchange=()=>{update();$('sw-dialog-from').value=from;$('sw-dialog-to').value=to}};
    }else{
      $('sw-dialog-title').textContent='Как читать Camber sweep';
      $('sw-dialog-body').innerHTML=`<p>Задайте Steering angle limit: 30° строит кривые от −30° до +30°. Это центральный угол δ; реальные Wheel angle LF/RF отличаются из-за Ackermann и Bump steer.</p><p>Нажмите на график или переместите голубой ползунок, чтобы увидеть Camber, площадь и форму пятна в этой точке. «Пройти диапазон» показывает 0 → +limit → 0 → −limit → 0. Обратное руление идёт по той же кривой: люфт, гистерезис и переходные процессы шины не моделируются.</p><p>Working range выделяет нужный участок. Для Leading полезны высокая минимальная площадь и малый разброс. Для Trailing можно сравнить участок с меньшей площадью или с хорошим контактом, но площадь не определяет его силу.</p><p>Area retention = A / A при Camber 0° × 100% при одинаковой нагрузке, давлении и параметрах шины. Это геометрический ориентир, а не процент сцепления. При нулевой нагрузке нормированная площадь не определена.</p><p>Slip angle показывает рассогласование направления колеса и его локальной скорости. Lateral force — боковая сила в осях шины; Yaw moment — её момент относительно центра масс, «+» влево. Steering torque — вклад колеса в момент, приведённый к центральному δ.</p><p>Формула силы учитывает Camber, Slip angle и нагрузку отдельно от модели Contact patch; она не выводит силу из показанной площади. Для прогноза настройки нужны данные реальной шины. ${pointWarning()}</p><p>«Запомнить» сохраняет все текущие параметры модели для пунктирных кривых; «Вернуть» восстанавливает их. Кривые «было» и текущие сравниваются при одинаковом δ. Изменение KPI, Caster, Camber или условий сразу перестраивает диапазон.</p><p><button class="ack-guide-button" data-ack-guide>Как Trailing wheel меняет поведение машины</button></p><p><a href="https://simulation.michelin.com/tametire" target="_blank" rel="noopener">Michelin: факторы, определяющие силы и моменты шины</a></p>`;
    }
    if(!$('sw-dialog').open)$('sw-dialog').showModal();
  }
  function pointWarning(){return result?.overDemand?'Заданный режим превышает μg; достижимость такого заноса модель не подтверждает.':result?.lift?'Одно колесо разгружено до нуля: модель достигла границы применимости.':''}
  $('sw-limit').onchange=e=>{if(e.target.value!=='')setLimit(+e.target.value);else e.target.value=limit};
  $('sw-limit').oninput=e=>{if(e.target.value!==''&&e.target.validity.valid)setLimit(+e.target.value)};
  $('sw-metric').onchange=e=>{metric=e.target.value;renderSweep()};$('sw-parameter').onchange=e=>setParameter(e.target.value);
  $('sw-angle').oninput=e=>setCursor(+e.target.value);$('sw-zero').onclick=()=>setCursor(0);$('sw-negative').onclick=()=>setCursor(-limit);$('sw-positive').onclick=()=>setCursor(limit);
  $('sw-tune').oninput=e=>{stop();setValue(parameter,+e.target.value)};$('sw-tune-number').onchange=e=>{if(e.target.value!==''&&e.target.validity.valid){stop();setValue(parameter,+e.target.value)}e.target.value=state[parameter]};
  $('sw-tune-number').oninput=e=>{if(e.target.value!==''&&e.target.validity.valid){stop();setValue(parameter,+e.target.value)}};
  $('sw-minus').onclick=()=>{stop();setValue(parameter,Number((state[parameter]-dfn(parameter)[4]).toFixed(3)))};$('sw-plus').onclick=()=>{stop();setValue(parameter,Number((state[parameter]+dfn(parameter)[4]).toFixed(3)))};
  $('sw-lock').onchange=e=>{lockTrail=e.target.checked;sync()};$('sw-compare').onchange=e=>{showSaved=e.target.checked;renderSweep()};
  $('sw-save').onclick=()=>{saved={...state};savedLock=lockTrail;oldKey='';renderSweep()};$('sw-restore').onclick=()=>{stop();state={...saved,steer:M.clamp(saved.steer,-limit,limit)};lockTrail=savedLock;sync();render()};
  for(const id of ['sw-from','sw-to']){const update=()=>{const a=$('sw-from'),b=$('sw-to');if(a.value!==''&&b.value!==''&&a.validity.valid&&b.validity.valid)setWindow(+a.value,+b.value)};$(id).oninput=update;$(id).onchange=()=>{update();$('sw-from').value=from;$('sw-to').value=to}};
  $('sweep-lab').addEventListener('click',e=>{const b=e.target.closest('[data-sw-key]');if(b)setParameter(b.dataset.swKey);const w=e.target.closest('[data-sw-window]');if(w){setWindow(w.dataset.swWindow==='positive'?0:-limit,w.dataset.swWindow==='negative'?0:limit);if($('sw-dialog').open&&$('sw-dialog').dataset.kind==='conditions'){ $('sw-dialog-from').value=from;$('sw-dialog-to').value=to }}});
  for(const event of ['input','change'])$('sweep-lab').addEventListener(event,e=>{const k=e.target.dataset.swCondition;if(k&&e.target.value!==''&&e.target.validity.valid){stop();setValue(k,+e.target.value)}});
  $('sw-results').onclick=()=>showDialog('summary');$('sw-options').onclick=()=>showDialog('conditions');$('sw-model-info').onclick=()=>showDialog('help');$('sw-help').onclick=()=>parameter==='ack'?AckermannGuide.open():showDialog('help');$('sw-dialog-close').onclick=()=>$('sw-dialog').close();
  function chartPointer(e){const svg=e.target.closest('.sw-chart svg');if(!svg)return;const inverse=svg.getScreenCTM()?.inverse();if(!inverse)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(inverse);setCursor(-limit+(p.x-55)/475*2*limit)}
  $('sw-plots').addEventListener('pointerdown',e=>{if(!e.target.closest('svg'))return;pointer=e.pointerId;$('sw-plots').setPointerCapture(pointer);chartPointer(e)});
  $('sw-plots').addEventListener('pointermove',e=>{if(e.pointerId===pointer){const svg=$('sw-plots').querySelector('.sw-chart:not(.secondary) svg'),target=document.elementFromPoint(e.clientX,e.clientY);chartPointer({target:target?.closest('.sw-chart svg')?target:svg,clientX:e.clientX,clientY:e.clientY})}});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])$('sw-plots').addEventListener(event,()=>{pointer=null});
  $('sw-play').onclick=()=>{if(sweepPlaying){stop();return}sweepPlaying=true;animationPhase=0;animationTime=0;$('sw-play').textContent='Пауза';$('sw-play').setAttribute('aria-pressed','true');setCursor(0,false)};
  function tickSweep(t){if(active&&sweepPlaying){if(animationTime){animationPhase+=(t-animationTime)/1000;const segment=(animationPhase/2)%4,value=segment<1?segment:segment<2?2-segment:segment<3?2-segment:segment-4;setCursor(value*limit,false)}animationTime=t}else animationTime=0;requestAnimationFrame(tickSweep)}requestAnimationFrame(tickSweep);
  $('method').insertAdjacentHTML('beforeend','<p><strong>Camber sweep.</strong> Модель пересчитывается на сетке Steering angle от −limit до +limit с шагом не более 0,5°. Скорость, β, Yaw rate и все настройки, кроме δ, фиксированы. Расчёт Contact patch выполняется отдельно для каждого колеса при его Camber и Fz. Статистика Working range включает его точные границы; положения экстремумов дискретные. Area variation = (max − min) / средняя площадь; при нулевой средней не определена. Area retention сравнивает с Camber 0° при той же нагрузке. Графики силы и моментов показывают существующую модель сил, не новую зависимость от рассчитанной площади контакта.</p>');
  open();
})();
