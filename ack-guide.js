/* Plain-language explanation; illustrative wheel directions do not change the model. */
const AckermannGuide=(()=>{
  const modes={
    positive:{name:'Positive Ackermann',angle:-20,heading:'Машина может охотнее идти носом вперёд',
      steps:[['Что меняется','В этом примере Trailing смотрит ближе к направлению носа, чем Leading. При боковом движении оно сильнее скользит поперёк своего протектора — это Tire scrub.'],
        ['Что чувствует водитель','Если его сила сдерживает боковое движение передка, машина менее охотно набирает угол. Малый и средний Drift angle легче удерживать без ощущения, что задняя часть обгоняет переднюю.'],
        ['Откуда «Oversteer начинается позже»','Так можно описать этот баланс: для дальнейшего роста угла нужно сильнее его изменить — например, работой газом или тормозом. Это не заданный порог, который одинаков у всех машин.']],
      note:'Positive часто делает коррекции плавнее, ценой большего Tire scrub. «Носом вперёд» описывает поведение машины: свободно катящееся переднее колесо не создаёт тягу двигателя.'},
    zero:{name:'Zero Ackermann',angle:-35,heading:'Колёса параллельны — силы всё равно разные',
      steps:[['Что меняется','Leading и Trailing смотрят в одну сторону. Условная разница их Steering angle равна нулю.'],
        ['Что чувствует водитель','Trailing продолжает участвовать в движении. В повороте у колёс разные локальные скорости, нагрузки и Camber, поэтому даже параллельные колёса могут создавать разные силы.'],
        ['Что сравнивать','Это удобная исходная настройка для сравнения Positive и Reverse. Zero не означает нулевой Slip angle, отсутствие Tire scrub или нейтральный баланс машины.']],
      note:'У реального комплекта параллельность на одном вывороте не гарантирует её на другом. Поэтому сравнивайте весь рабочий диапазон: это и показывает Dynamic Ackermann.'},
    reverse:{name:'Reverse Ackermann',angle:-50,heading:'Может легче набирать угол',
      steps:[['Что меняется','В этом примере Trailing повёрнуто сильнее Leading. Меняются его скольжение и вклад в общую силу передней оси. Подходящий Reverse может уменьшить Tire scrub.'],
        ['Что чувствует водитель','Если новый баланс позволяет углу быстрее расти, появляется ощущение «задняя часть обгоняет переднюю» — Oversteer. Это возможный сценарий, а не обязательный результат любого Reverse.'],
        ['Зачем добавлять Countersteer','Водитель поворачивает колёса в сторону ухода задней части, чтобы сдержать дальнейшее вращение. Так можно удерживать больший Drift angle. Само добавление Countersteer не является командой увеличить угол кузова.']],
      note:'Меньше Tire scrub может помочь сохранить скорость. Устойчивый большой угол требует подходящего баланса машины и коррекции водителя; Reverse сам по себе не гарантирует стабильность.'}
  };
  const dialog=document.createElement('dialog');dialog.id='ack-guide';dialog.setAttribute('aria-labelledby','ack-guide-title');
  dialog.innerHTML=`<div class="ag-head"><h2 id="ack-guide-title">Ackermann в заносе</h2><button id="ag-close" autofocus>Закрыть</button></div>
    <div class="ag-body"><p class="ag-intro"><b>Trailing меняет общую силу передка.</b> Поэтому машина иначе реагирует на руль и удерживает угол.</p>
    <p>В схеме RF — Leading, LF — Trailing: какое колесо идёт впереди по направлению бокового скольжения, а какое следует за ним.</p>
    <div class="ag-tabs" role="group" aria-label="Сравнение Ackermann">${Object.entries(modes).map(([k,v])=>`<button data-ag-mode="${k}" aria-pressed="false">${v.name.replace(' Ackermann','')}</button>`).join('')}</div>
    <div id="ag-scene"></div>
    <details><summary>Что значит «крабит» и почему убрали «доворачивает»</summary><p>Колёса жёстко связаны одной машиной, но направлены по-разному. Каждая шина деформируется и скользит относительно дороги. Trailing меняет суммарную силу передка, поэтому меняется движение всей машины — это здесь и называют «крабит».</p><p>Leading не задаёт самостоятельную траекторию, которую второе колесо обязано повторить. Итог зависит от сил всех четырёх шин.</p><p>У силы Trailing есть плечо до центра масс, поэтому она действительно создаёт Yaw moment. Но момент одного колеса ещё не означает рост Drift angle. Фраза «колесо доворачивает кузов» смешивала эти разные вещи.</p></details>
    <details><summary>Left-foot braking: почему тормоз может добавить угол</summary><p>При замедлении часть нагрузки переходит вперёд. Меняется баланс переднего и заднего сцепления; шины одновременно расходуют его на торможение и боковую силу. В подходящем режиме задняя ось легче уходит наружу, и Drift angle растёт.</p><p>Так водитель может помочь машине перейти от малого угла к большому, когда она охотнее идёт вперёд. Но сильнее нажать тормоз не всегда значит получить больше Oversteer: при перегрузке передних шин торможением можно потерять способность направлять передок. Важны Brake bias, газ и сцепление обеих осей.</p><p>Это объяснение возможного приёма, а не обязательное действие для Positive Ackermann. Эффект педали тормоза в этой лаборатории не рассчитывается.</p></details>
    <details><summary>Почему нет одной «точки Oversteer» для всех настроек</summary><p>Oversteer здесь — ситуация, когда задняя часть уходит наружу и угол заноса нарастает. Устойчивый дрифт на большом угле уже сбалансирован: угол не обязан продолжать расти.</p><p>Порог зависит от задней оси, шин, скорости, покрытия и действий водителя. В лаборатории траектория и Drift angle заданы вами. Расчёт сил передних колёс не предсказывает новый угол кузова или начало разворота.</p><p>Для сравнения схем Leading здесь смотрит одинаково. В основном симуляторе фиксируется центральный Steering angle: при смене Ackermann меняются оба Wheel angle. Проверяйте их, Slip angle и Contact patch в нужном диапазоне.</p></details>
    <p class="ag-source">Практическое сравнение: <a href="https://www.wisefab.com/resources/everything-you-need-to-know-about-ackermann-in-drifting" target="_blank" rel="noopener">Wisefab об Ackermann в дрифте</a>. Влияние торможения на баланс: <a href="https://driver61.com/uni/trail-braking/" target="_blank" rel="noopener">Driver61</a>. Описанное ощущение «вперёд / легче набирает угол» — условный сценарий, не универсальный закон знака Ackermann.</p></div>`;
  document.body.append(dialog);
  const text=(x,y,t,c='#9bafbc',size=18)=>`<text x="${x}" y="${y}" fill="${c}" font-size="${size}" text-anchor="middle">${t}</text>`;
  const arrow=(x,y,angle)=>{const a=angle*Math.PI/180,dx=-Math.sin(a)*94,dy=-Math.cos(a)*94;return `<path d="M${x} ${y}l${dx} ${dy}" stroke="#65d8ef" stroke-width="3"/><g transform="translate(${x+dx} ${y+dy}) rotate(${-angle})"><path d="M-5 8L0 0L5 8" fill="none" stroke="#65d8ef" stroke-width="3"/></g>`};
  function draw(mode){const m=modes[mode];dialog.querySelectorAll('[data-ag-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.agMode===mode));
    let svg='<svg viewBox="0 0 560 235" role="img" aria-label="Учебная схема: направление Leading постоянно; направление Trailing меняется. Это не текущие настройки машины."><path d="M280 158V28m-6 9l6-9 6 9" stroke="#7d939e" stroke-width="2" fill="none"/>'+text(280,183,'Нос', '#9bafbc',18);
    for(const [i,angle]of [m.angle,-35].entries()){const x=i?405:135,c=i?'#c6f36b':'#d5afff';svg+=arrow(x,124,i?-33:-40)+`<g transform="translate(${x} 124) rotate(${-angle})"><path d="M0 -69V54" stroke="${c}" stroke-dasharray="5 5"/><rect x="-12" y="-37" width="24" height="74" rx="4" fill="#1e3035" stroke="${c}" stroke-width="3"/></g>`+text(x,193,`${i?'RF · Leading':'LF · Trailing'}`,c,20)+text(x,220,`Wheel angle ${angle}°`,c,18)}
    svg+='</svg>';
    document.getElementById('ag-scene').innerHTML=`<h3>${m.heading}</h3>${svg}<p class="ag-caption">Условный левый занос. Углы выбраны для наглядности, это не текущий Setup. Голубые стрелки — движение колёс; пунктир — куда они смотрят.</p><ol class="ag-steps">${m.steps.map(([title,p])=>`<li><h4>${title}</h4><p>${p}</p></li>`).join('')}</ol><p class="ag-note">${m.note}</p>`;
  }
  function open(){for(const id of ['ex-dialog','sw-dialog']){const d=document.getElementById(id);if(d?.open)d.close()}draw(state.ack*state.rackSide>0?'positive':state.ack*state.rackSide<0?'reverse':'zero');dialog.showModal();dialog.scrollTop=0}
  dialog.addEventListener('click',e=>{const b=e.target.closest('[data-ag-mode]');if(b)draw(b.dataset.agMode)});
  document.getElementById('ag-close').onclick=()=>dialog.close();
  document.addEventListener('click',e=>{if(e.target.closest('[data-ack-guide]'))open()});
  return {open};
})();
