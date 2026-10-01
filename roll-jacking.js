/* Educational front-view force analysis. No hidden heave correction to tyres. */
window.DriftRoll=(()=>{
 'use strict';
 const M=DriftModel,L='#c6f36b',P='#d5afff',C='#65d8ef',O='#ffa66b',G='#94a8b4';
 const f=(x,n=1)=>Math.abs(x)<.5*10**-n?(n?'0,'+'0'.repeat(n):'0'):x.toLocaleString('ru-RU',{minimumFractionDigits:n,maximumFractionDigits:n});
 const tx=(x,y,t,c=G,n=16,a='start')=>`<text x="${x}" y="${y}" fill="${c}" font-size="${n}" text-anchor="${a}">${t}</text>`;
 const line=(x,y,X,Y,c=G,w=2,dash='')=>`<path d="M${x} ${y}L${X} ${Y}" stroke="${c}" stroke-width="${w}" fill="none" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
 const arrow=(x,y,X,Y,c)=>{if(Math.hypot(X-x,Y-y)<1)return `<circle cx="${x}" cy="${y}" r="3" fill="${c}"/>`;const a=Math.atan2(Y-y,X-x);return line(x,y,X,Y,c,3)+`<path d="M${X-8*Math.cos(a-.5)} ${Y-8*Math.sin(a-.5)}L${X} ${Y}L${X-8*Math.cos(a+.5)} ${Y-8*Math.sin(a+.5)}" fill="none" stroke="${c}" stroke-width="3"/>`};
 function visual(s,reference=null){
  const a=M.rollAnalysis(s),r=a.result,j=a.jacking,b=M.calculate(reference??{...s,rc:0}),rcY=260-s.rc*500/s.track;
  const body=(roll,color,dash='')=>`<g transform="translate(160 145) rotate(${roll*3})"><path d="M-108 0V-24H-78L-58 -57H58L78 -24H108V0Z" fill="${dash?'none':'#c6f36b0b'}" stroke="${color}" stroke-width="3" ${dash?`stroke-dasharray="${dash}"`:''}/></g>`;
  let out=tx(20,25,'Передняя ось · вид сзади',L,18)+tx(345,25,'Roll jacking · силы',C,18);
  out+=line(20,260,302,260)+body(b.roll,O,'7 6')+body(r.roll,L);
  for(const [i,x] of [60,260].entries())out+=`<rect x="${x-12}" y="195" width="24" height="65" rx="4" fill="#20303a" stroke="${i?L:P}" stroke-width="2"/>`+line(x,260,160,rcY,C,2,'5 4')+tx(x,284,i?'RF':'LF',i?L:P,15,'middle');
  out+=`<circle cx="160" cy="${rcY}" r="6" fill="${C}"/><circle cx="160" cy="${260-520*500/s.track}" r="6" fill="${O}"/>`+line(160,260-520*500/s.track+6,160,rcY,C,1,'3 4');
  out+=tx(173,260-520*500/s.track-4,'CG 520 mm',O,14)+tx(173,rcY-8,`RC ${f(s.rc,0)} mm`,C,14)+tx(160,321,'Высота ×2,5 · крен ×3',L,15,'middle');
  out+=line(325,40,325,326,'#30404b',1);
  out+=line(360,160,580,160,G,5,'5 5');
  const vscale=.07;
  for(const [i,x] of [383,557].entries())out+=arrow(x,160,x,160-M.clamp(j.vertical[i]*vscale,-75,75),i?L:P)+tx(x,63,i?'RF':'LF',i?L:P,15,'middle')+tx(x,285,`${f(j.vertical[i]/1000,2)} kN`,i?L:P,15,'middle');
  out+=arrow(470,220,470,220-M.clamp(j.net*.09,-70,70),C)+tx(470,250,`Net ${f(j.net/1000,2)} kN`,C,17,'middle')+tx(470,321,'«+» вверх · «−» вниз',G,15,'middle');
  return `<svg viewBox="0 0 620 342" role="img" aria-label="Roll center, крен кузова и вертикальные реакции Roll jacking">${out}</svg>`;
 }
 function explanation(s){
  const a=M.rollAnalysis(s),r=a.result,j=a.jacking;
  return `Roll center ${f(s.rc,0)} mm: Body roll ${f(r.roll,2)}°. Выше RC — короче плечо крена и больше геометрическая часть переноса нагрузки при тех же условиях. Реакции LF и RF могут частично компенсироваться: Net jacking ${f(j.net/1000,2)} kN ${j.net>.5?'вверх':j.net<-.5?'вниз':'— близко к нулю'}. Это оценка по текущим боковым силам и симметричным силовым линиям, не расчёт фактического подъёма машины.`;
 }
 function details(s){
  const a=M.rollAnalysis(s),r=a.result,j=a.jacking,zero=M.rollAnalysis({...s,rc:0});
  const table=(head,rows)=>`<div class="anti-table-wrap"><table class="anti-table"><thead><tr><th>Parameter</th>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(([n,...v])=>`<tr><th>${n}</th>${v.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `<h2>High roll center → что изменилось</h2><p>Сравнение с Front RC 0 mm при одинаковых Speed, Drift angle, Yaw rate и жёсткостях. «Перенос» ниже — сколько нагрузки снято с одной стороны и добавлено другой; разница нагрузок колёс вдвое больше. Знак «+» означает перенос на RF.</p>`+
   table(['RC 0 mm',`RC ${f(s.rc,0)} mm`],[
    ['Body roll',`${f(zero.result.roll,2)}°`,`${f(r.roll,2)}°`],
    ['Front geometric transfer',`${f(zero.result.geom/1000,2)} kN`,`${f(r.geom/1000,2)} kN`],
    ['Front elastic transfer',`${f(zero.result.elastic/1000,2)} kN`,`${f(r.elastic/1000,2)} kN`],
    ['Front total transfer',`${f(zero.result.transfer/1000,2)} kN`,`${f(r.transfer/1000,2)} kN`],
    ['Rear total transfer',`${f((zero.rearGeom+zero.rearElastic)/1000,2)} kN`,`${f((a.rearGeom+a.rearElastic)/1000,2)} kN`],
    ['Whole-car transfer',`${f(zero.total/1000,2)} kN`,`${f(a.total/1000,2)} kN`]])+
   `<p>В этой модели высокий Front RC может увеличить долю переноса спереди, даже если кузов кренится меньше. Через Fz, Dynamic camber и ход подвески это меняет контакт, силы шин и Bump steer. Меньше крен — не гарантия большего сцепления.</p>`+
   table(['LF','RF'],[
    ['Body lateral force Fy',...r.wheels.map(w=>`${f(w.bodyFy/1000,2)} kN`)],
    ['Vertical geometric reaction',...j.vertical.map(v=>`${f(v/1000,2)} kN`)],
    ['Wheel load Fz',...r.wheels.map(w=>`${f(w.Fz/1000,2)} kN`)],
    ['Dynamic camber',...r.wheels.map(w=>`${f(w.camber,2)}°`)],
    ['Bump steer · Toe change',...r.wheels.map(w=>`${f(w.toeChange,3)}°`)]])+
   `<h3>Jacking estimate</h3><p>Net jacking <b>${f(j.net/1000,2)} kN</b>. Если эту реакцию уравновесить только двумя передними пружинами, оценка подъёма передней части составит <b>${f(j.heave,1)} mm</b> («−» — опускание). Это отдельная линейная оценка при замороженных силах. Она не добавляется в показанные Fz, Camber, Bump steer или траекторию: обратная связь подъёма с геометрией здесь не решена.</p><p>При равных боковых силах реакции в симметричной схеме взаимно компенсируются. Поэтому высота RC сама по себе не задаёт ни величину, ни даже знак суммарного Jacking. В заносе важны также направления сил обоих колёс.</p>`+
   (r.lift||r.overDemand?'<p class="tn-notice">Граница учебного опыта: разгрузка колеса или боковое ускорение выше μg. Сравнение переноса до ограничения нагрузки; такой режим не подтверждает устойчивое движение.</p>':'')+help;
 }
 const help=`<h3>Roll center, Body roll и Roll jacking</h3><p><b>Roll center</b> — точка фронтальной кинематической схемы. У MacPherson Instant center получают из линии нижнего рычага и линии через верхнюю опору, перпендикулярной оси стойки. Линии от пятен контакта к Instant centers задают Roll center. Это не шарнир, вокруг которого кузов обязан вращаться.</p><p><b>High roll center</b> здесь означает более высокое положение относительно исходных 60 mm. Кнопки 150 / 200 mm — опыт, а не рекомендация для конкретной машины. Высота меняет распределение переноса нагрузки между геометрией и упругими элементами, а также между осями. Общий установившийся перенос при прежних массе, CG, колее и боковом ускорении сохраняется.</p><p><b>Roll jacking</b> — вертикальные реакции, возникающие при передаче боковых сил через наклонные силовые линии подвески. Одна сторона может толкать кузов вверх, другая вниз. Подъём RC усиливает эти составляющие при прежних силах; суммарный подъём зависит от их разницы. <b>Steering jacking</b> от Caster / KPI при повороте колёс — другой эффект.</p><h3>Что именно рассчитано</h3><p>Схема использует RC на оси симметрии, неизменный при ходе подвески. Для каждой стороны slope = 2 × RC / Track; вертикальная реакция равна ± Body lateral force × slope. Это диагностическая проекция текущих сил шин. Их сумма в заданном дрифте не обязана совпасть с требуемым m·Ay: водитель задаёт мгновенное состояние.</p><p>Оценка Heave = Net jacking / (2 × Front wheel rate). Стабилизатор в чистом синхронном ходе двух колёс не добавляет жёсткости. Нет решения миграции RC / Instant center, деформаций шин, заднего Jacking и связанного вертикального равновесия. Масса 1250 kg, CG 520 mm, Rear RC 80 mm, Rear roll stiffness 65 kN·m/rad — допущения. Rear geometric / elastic transfer показаны аналитически; продольный и боковой перенос в основной модели ограничиваются при разгрузке колеса.</p><p><a href="https://optimumg.com/wp-content/uploads/2021/10/OptimumG-Septepmber-2021.pdf" target="_blank" rel="noopener">OptimumG: геометрический и упругий перенос</a> · <a href="https://www.racecar-engineering.com/tech-explained/racecar-kinematics-and-compliance/" target="_blank" rel="noopener">Jahee Campbell-Brennan: Roll center и Jacking</a></p>`;
 return {visual,explanation,details,help};
})();
