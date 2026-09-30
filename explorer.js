/* A focused teaching surface over the same model and controls as the full lab. */
(() => {
  'use strict';
  const lessons = {
    caster: ['Ось поворота', 'side', 'Наклон оси поворота назад, если смотреть на машину сбоку.', 'На вывороте меняет Camber левого и правого колеса по-разному. При неизменном положении ступицы увеличивает Mechanical trail, а вместе с ним меняется момент самоповорота.', 'Сравните 4°, 5,5° и 6,5° на одном Steering angle. Больше Caster не означает, что любому колесу всегда нужно больше отрицательного Camber: проверяйте оба колеса и весь диапазон выворота.', 'suspension', [4, 5.5, 6.5]],
    kpi: ['Ось поворота', 'front', 'Наклон оси поворота внутрь машины при взгляде спереди.', 'При повороте вокруг наклонной оси меняются Camber и высота колеса. Поэтому меняются распределение давления в пятне и геометрический момент на руле.', 'Сравните 12°, 10° и 8°. Меньший KPI обычно уменьшает положительную добавку Camber на вывороте; итог зависит также от Caster, Static camber и Body roll.', 'suspension', [12, 10, 8]],
    trail: ['Ось поворота', 'side', 'Расстояние по дороге от центра пятна до оси поворота — вдоль машины.', 'Боковая сила действует через это плечо и создаёт момент на руле. Положительный Trail помогает колесу ориентироваться по движению, но итоговый момент зависит и от шины, выворота и других плеч.', 'Увеличение Trail отдельно от Caster позволяет менять самоповорот без той же добавки Camber. Здесь это условное независимое смещение ступицы; реализуемость зависит от кулака.', 'suspension', [20, 35, 50]],
    scrub: ['Ось поворота', 'front', 'Расстояние от оси поворота до центра пятна — поперёк машины.', 'Продольная сила от торможения или неровности действует через это плечо и даёт момент на руле. Чем больше модуль плеча, тем сильнее эта составляющая обратной связи.', 'Знак меняет направление момента. Scrub radius и Mechanical trail — два разных плеча: первое видно спереди, второе сбоку.', 'suspension', [0, 25, 50]],
    camber: ['Ось поворота', 'camber', 'Наклон самого колеса. Минус — верх колеса наклонён внутрь.', 'Static camber задан в исходном положении. На дороге к нему добавляются изменения от Steering angle, Caster, KPI и Body roll. Давление может уходить к одному плечу протектора.', 'Сравните −3°, −4° и −5°. Даже при Steering angle 0° колёса могут иметь разный Dynamic camber из-за крена. Пятно — расчётная оценка, не измерение шины.', 'contact', [-3, -4, -5]],
    ack: ['Руление', 'steering', 'Смещение точки рулевой тяги на кулаке относительно положения Zero Ackermann.', 'Меняет, куда Trailing смотрит относительно Leading. Шины по-разному скользят поперёк своего направления, поэтому меняется общая сила передка. Машина может охотнее идти вперёд или набирать угол — в зависимости от всего баланса.', 'Шаг — 1,5 мм на обоих кулаках. Минус — внутрь, плюс — наружу. Для рычага перед осью наружу даёт Positive, внутрь — Reverse; за осью знак меняется. Схождение после перестановки восстановлено.', 'course', [-1.5, 0, 1.5]],
    dynamicAck: ['Руление', 'dynamic', 'Dynamic Ackermann — как разница углов двух колёс меняется по мере выворота.', 'Точка крепления тяги на кулаке не переставляется, но рычаги и тяги поворачиваются: соотношение углов LF и RF меняется. В заносе это меняет Slip angle и силу ведомого колеса на малом, среднем и большом вывороте. «Dynamic» здесь описывает кинематику при рулении, а не отдельную регулировку или зависимость только от скорости.', 'Задайте Ackermann offset ±1,5 мм и проведите Steering angle от 0° до 55°. На графике Δδ = |δ inner| − |δ outer|: плюс — Positive, ноль — Zero, минус — Reverse. Inner / outer определены по направлению руления, а не по дуге заноса. В реальном комплекте возможен переход Reverse → Zero → Positive; для него нужны координаты рейки, тяг и кулака. Текущая модель показывает нелинейную разницу углов, но смену её знака с выворотом не воспроизводит. Bump steer добавляется отдельно и не входит в эту кривую.', 'top', [-1.5, 0, 1.5]],
    steer: ['Руление', 'steering', 'Угол поворота колёс относительно кузова.', 'Здесь задан эквивалентный центральный угол δ, а не угол рулевого колеса. Ackermann и Bump steer могут сделать углы LF и RF разными.', 'Поворачивайте колёса и следите за их направлениями. Голубая стрелка — локальная скорость; несовпадение с направлением колеса — Slip angle.', 'top', [-35, 0, 35]],
    slip: ['Руление', 'slip', 'Slip angle α — угол между тем, куда смотрит колесо, и тем, куда оно в этот момент движется по дороге.', 'При несовпадении направлений шина деформируется и создаёт боковую силу. Небольшой Slip angle бывает и при обычном повороте: это ещё не означает срыв всей шины в скольжение. С увеличением угла сила сначала растёт, но после насыщения больший угол уже не означает больше сцепления. Вклад Trailing зависит также от нагрузки и Camber.', 'Меняйте Steering angle под схемой: направления скорости остаются заданными, а колёса поворачиваются. Совпали стрелки — α = 0°. В этой модели α = угол колеса − угол его локальной скорости: например, −25° − (−30°) = +5°. Steering angle измеряется от кузова, Drift angle β — между кузовом и его скоростью, Slip angle — отдельно у каждого колеса. Из-за Yaw rate направления скорости LF и RF могут различаться. Нулевой α не гарантирует нулевую силу: остаётся вклад Camber.', 'top', [-40, -30, -20]],
    rackSide: ['Руление', 'steering', 'Рулевая тяга крепится к рычагу перед осью колёс или за ней.', 'Одинаковое поперечное смещение точки даёт противоположное изменение Ackermann при смене стороны рычага.', 'Речь о положении точки тяги в плане. Это упрощённая геометрия: реальные углы зависят также от положения рейки и длины тяг.', 'compare', []],
    steeringArm: ['Руление', 'steering', 'Продольное расстояние от оси поворота до точки рулевой тяги.', 'В модели отношение Ackermann offset к Steering arm length определяет разницу углов колёс. При том же смещении более длинный рычаг уменьшает эту разницу.', 'При Ackermann offset 0 мм разницы от Ackermann нет: смена длины рычага сама по себе её не создаст. Передаточное отношение руля в этой модели не рассчитывается.', 'compare', [80, 100, 140]],
    damping: ['Руление', 'damping', 'Сопротивление скорости вращения рулевого механизма.', 'При вращении руля создаёт момент против движения. Большее Steering damping замедляет самоповорот и гасит колебания; при неподвижном руле этот момент равен нулю.', 'Схема сравнивает сопротивление при условной скорости 30°/с. Чтобы увидеть движение во времени, откройте полный симулятор и нажмите «Отпустить руль». Это не жёсткость пружин подвески.', 'course', [3, 7, 12]],
    beta: ['Движение кузова', 'motion', 'Угол между направлением кузова и направлением его скорости.', 'Показывает, насколько машина едет боком. Меняет локальные скорости у колёс, их Slip angle и рассчитанные силы.', 'Оранжевая линия — направление носа, голубая — скорость. Drift angle β измеряется в градусах; Yaw rate r — скорость вращения кузова, а не этот угол.', 'course', [-45, -25, 0]],
    yaw: ['Движение кузова', 'motion', 'Скорость разворота кузова, если смотреть сверху.', 'Измеряется в °/с. Меняет локальные скорости колёс и боковое ускорение. Через ускорение меняются нагрузки и Body roll.', 'Yaw — вращение вокруг вертикальной оси. Body roll — наклон кузова вбок вокруг продольной оси. Например, r = 20°/с означает поворот направления кузова на 20° за одну секунду при постоянном r.', 'course', [-20, 0, 20]],
    speed: ['Движение кузова', 'motion', 'Скорость перемещения машины по дороге.', 'При сохранении Yaw rate и Drift angle меняет боковое ускорение, перенос нагрузки и крен. При r = 0 ускорение в этой модели равно нулю.', 'Движение здесь задано пользователем. Изменение сил не перестраивает траекторию автоматически: для этого нужна полноценная динамическая модель всей машины.', 'course', [30, 65, 90]],
    roll: ['Движение кузова', 'roll', 'Body roll φ — наклон кузова вбок. Это результат расчёта, а не Yaw rate.', 'Боковое ускорение наклоняет кузов, а пружины и стабилизаторы сопротивляются. Наклон меняет Camber к дороге и ход левого и правого колеса.', 'На этом экране меняйте Front spring rate: при том же ускорении большая общая жёсткость уменьшает крен. Для сравнения без крена задайте Yaw rate 0°/с.', 'suspension', [6, 8, 12]],
    rc: ['Подвеска', 'roll', 'Высота переднего геометрического центра крена над дорогой.', 'Меняет плечо боковой силы относительно оси крена и геометрическую часть переноса нагрузки. Поднятие Roll center может уменьшить крен, но не означает автоматического роста сцепления.', 'В настоящем MacPherson Roll center получается из геометрии стойки и рычага. Здесь высота задана отдельно; схема показывает принцип, а не монтажные координаты.', 'suspension', [20, 60, 100]],
    springRate: ['Подвеска', 'roll', 'Жёсткость одной передней пружины: сила на каждый миллиметр сжатия.', 'Через Motion ratio задаёт Wheel rate и переднюю жёсткость на крен. Более жёсткий перед уменьшает общий крен, но увеличивает переднюю долю упругого переноса нагрузки.', 'Жёсткость — не демпфирование. Амортизаторы и отбойники отдельно не рассчитаны. При смене пружин модель предполагает сохранение исходной высоты кузова.', 'bump', [6, 8, 12]],
    motionRatio: ['Подвеска', 'ratio', 'Ход пружины, поделённый на ход колеса.', 'Wheel rate = Spring rate × Motion ratio². Если пружина сжимается на 20 мм при ходе колеса 25 мм, Motion ratio = 0,8.', 'Схема показывает условный ход колеса 25 мм и соответствующий ход пружины. Введённый коэффициент уже учитывает угол установки; повторно наклон не применяется.', 'bump', [0.75, 0.95, 1]],
    frontBarRate: ['Подвеска', 'roll', 'Добавка переднего стабилизатора к жёсткости оси на крен.', 'Сопротивляется разности ходов колёс. В модели увеличивает Front roll stiffness, уменьшает крен и меняет передний упругий перенос нагрузки.', 'Значение уже приведено к кузову в kN·m/rad, это не паспортная жёсткость торсиона. Синхронный ход обоих колёс и его силы здесь отдельно не моделируются.', 'bump', [0, 15, 30]],
    wheelTravelLF: ['Bump steer', 'bump', 'Дополнительный ход LF относительно кузова. Плюс — сжатие.', 'Колесо проходит по заданной кривой Toe change. Если кривая не нулевая, меняется его направление даже при удерживаемом руле.', 'При включённом Body roll к ручному ходу добавляется ход от крена. Ручной ход — кинематическая проверка: он не добавляет ударную силу или отдельный Bump camber.', 'bump', [-25, 0, 25]],
    wheelTravelRF: ['Bump steer', 'bump', 'Дополнительный ход RF относительно кузова. Минус — отбой.', 'Из-за разницы траекторий рычага и рулевой тяги ход подвески может менять схождение. Здесь эффект задаётся кривой Toe change.', 'При нулевых Bump toe и Rebound toe подруливания нет при любом ходе. Задайте свои измерения или изучите эти две настройки отдельно.', 'bump', [-25, 0, 25]],
    bumpToe: ['Bump steer', 'bump', 'Изменение схождения одного колеса при сжатии на 25 мм.', 'Вместе с Rebound toe задаёт кривую подруливания по ходу подвески. Плюс — Toe-in: передние края колёс сходятся; минус — Toe-out.', 'На графике точка +25 мм подсвечена. LF и RF берут значения на одной кривой по своему текущему ходу. Реальная кривая зависит от выворота; здесь эта зависимость не рассчитана.', 'bump', [-0.1, 0, 0.1]],
    reboundToe: ['Bump steer', 'bump', 'Изменение схождения одного колеса при отбое на 25 мм.', 'Меняет вторую опорную точку кривой Bump steer. Углы колёс получают добавку от положения подвески, даже если руль удерживается.', 'В нулевом ходе Toe change = 0. Кривая через три точки учебная; вне ±25 мм это экстраполяция, а не измеренная характеристика машины.', 'bump', [-0.1, 0, 0.1]],
    bumpFromRoll: ['Bump steer', 'bump', 'Связь крена кузова с ходом колёс для расчёта Bump steer.', 'При включении к ручному Wheel input добавляется противоположный ход LF и RF от Body roll. Разные точки кривой дают разные добавки к рулению.', 'Выключение отделяет ручную проверку кривой от крена. Сам Body roll и его вклад в Camber остаются: отключается только передача хода в Bump steer.', 'bump', []],
    tyreWidth: ['Шина и контакт', 'tire', 'Номинальная ширина сечения шины в миллиметрах.', 'Меняет геометрические размеры шины и расчётного пятна. При неизменном профиле в процентах меняется также высота боковины.', 'Для 235/45 R17 ширина сечения — 235 мм. Реальная ширина протектора отличается; здесь она условно приравнена к ширине сечения. Широкая шина не означает пропорционально большую площадь.', 'contact', [215, 235, 255]],
    tyreAspect: ['Шина и контакт', 'tire', 'Высота боковины в процентах от ширины шины.', 'Вместе с Tire width и Rim diameter определяет номинальный радиус колеса. Здесь меняет геометрию, но не задаёт реальную жёсткость каркаса.', 'Для 235/45 R17 высота боковины = 235 × 0,45 = 105,75 мм. Больший профиль сам по себе не позволяет точно рассчитать обратную связь или сцепление.', 'contact', [35, 45, 55]],
    rimDiameter: ['Шина и контакт', 'tire', 'Посадочный диаметр диска в дюймах.', 'Меняет общий диаметр колеса при неизменной ширине и профиле. Это влияет на геометрию плеч и расчётную форму контакта.', 'В 235/45 R17 число 17 означает 431,8 мм посадочного диаметра. Сравнивать диски на машине обычно нужно вместе с подобранным размером шины.', 'contact', [16, 17, 18]],
    tyrePressure: ['Шина и контакт', 'patch', 'Давление воздуха в шине, принятое в расчёте.', 'Меняет калибровку упругости протектора и расчётную площадь пятна при той же нагрузке. Большее давление обычно даёт меньшую площадь.', 'Цвет на схеме — нормальное давление протектора на дорогу, а не давление воздуха. 2,2 бар — условный исходный параметр, не рекомендация для трека.', 'contact', [1.8, 2.2, 2.6]],
    tyreCompliance: ['Шина и контакт', 'patch', 'Условная податливость шины в учебной модели.', 'Больший коэффициент делает контакт мягче и сильнее компенсирует наклон протектора. Меняются площадь и распределение давления.', 'Коэффициент не измерен для конкретной шины. Эта модель контакта не пересчитывает боковую силу по площади: нельзя считать показанную площадь прямым числом сцепления.', 'contact', [0.7, 1, 1.5]],
    mu: ['Шина и контакт', 'force', 'Коэффициент сцепления в упрощённой модели боковой силы.', 'Задаёт масштаб доступной боковой силы. При том же Slip angle меняет силу и создаваемый ею момент на руле.', 'Это условный вход для покрытия и шины. Сила зависит также от нагрузки, угла увода и Camber. Модель не определяет μ по погоде или типу асфальта.', 'top', [0.6, 1.05, 1.3]],
    wheelbase: ['Размеры машины', 'dimensions', 'Расстояние между передней и задней осями.', 'При заданном положении центра масс меняет продольное плечо передних колёс. Через Yaw rate меняются их локальные скорости и Slip angle.', 'При нулевом Yaw rate этот вклад в локальную скорость исчезает. Распределение массы здесь фиксировано: 55% на переднюю ось.', 'course', [2500, 2700, 2900]],
    track: ['Размеры машины', 'dimensions', 'Расстояние между центрами передних колёс.', 'Меняет поперечные плечи, разницу скоростей в повороте, ход колёс от крена и жёсткость передних пружин на крен.', 'Front track width и Scrub radius — разные размеры. Здесь колея меняется независимо; на реальной машине изменение вылета диска может менять оба параметра.', 'bump', [1500, 1600, 1750]],
  };
  const extras = {slip:['steer','Steering angle δ',-55,55,.5,'°'],dynamicAck:['ack','Ackermann offset',-9,9,1.5,'mm'],rackSide:['rackSide','Steering arm position',-1,1,2,''],bumpFromRoll:['bumpFromRoll','Body roll → Bump steer',0,1,1,''],roll:['springRate','Front spring rate',4,20,.5,'kgf/mm']};
  const def = k => extras[k] || definitions.find(d=>d[0]===k);
  const name = k => k==='slip'?'Slip angle α':k==='dynamicAck'?'Dynamic Ackermann':k==='roll'?'Body roll φ':def(k)[1];
  const keys=Object.keys(lessons), groups=[...new Set(keys.map(k=>lessons[k][0]))];
  let selected='slip', learning=true, effectView=false, reference={...state}, refLock=lockTrail, referenceResult=M.calculate(reference);
  const L='#c6f36b',C='#65d8ef',O='#ffa66b',G='#7f94a3',P='#d5afff';
  const text=(x,y,t,color=G,size=17,anchor='start')=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}">${t}</text>`;
  const line=(x1,y1,x2,y2,c=L,w=3,dash='')=>`<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${c}" stroke-width="${w}" ${dash?'stroke-dasharray="'+dash+'"':''}/>`;
  const arrow=(x1,y1,x2,y2,c=C)=>{const a=Math.atan2(y2-y1,x2-x1),l=10;return line(x1,y1,x2,y2,c)+`<path d="M${x2-l*Math.cos(a-.5)} ${y2-l*Math.sin(a-.5)}L${x2} ${y2}L${x2-l*Math.cos(a+.5)} ${y2-l*Math.sin(a+.5)}" fill="none" stroke="${c}" stroke-width="3"/>`};
  const circle=(x,y,r,c=L)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
  const tire=(x,y,angle,c=L,h=76)=>`<g transform="translate(${x} ${y}) rotate(${angle})"><rect x="-15" y="${-h/2}" width="30" height="${h}" rx="5" stroke="${c}" stroke-width="3" fill="${c}" fill-opacity=".12"/>${line(0,-h/2-20,0,h/2+20,c,1.5,'5 5')}</g>`;
  const svg=(content,label)=>`<svg viewBox="0 0 560 270" role="img" aria-label="${label}"><title>${label}</title>${content}</svg>`;
  const num=(v,n=1)=>fmt(v,n);
  const round=(v,n=2)=>Number(v.toFixed(n));
  const specialValue=(k,v)=>k==='rackSide'?(v===1?'Перед осью':'За осью'):k==='bumpFromRoll'?(v?'Включено':'Выключено'):sgn(v,k==='bumpToe'||k==='reboundToe'?3:def(k)[4]<.1?2:1)+' '+def(k)[5];

  $('explorer').innerHTML=`<div class="explore-picker"><button id="param-prev" aria-label="Предыдущий параметр">←</button><label for="param-select" class="sr-only">Выберите параметр</label><select id="param-select">${groups.map(g=>`<optgroup label="${g}">${keys.filter(k=>lessons[k][0]===g).map(k=>`<option value="${k}">${name(k)}</option>`).join('')}</optgroup>`).join('')}</select><button id="param-next" aria-label="Следующий параметр">→</button><span id="param-count"></span></div>
  <div class="explore-grid"><div class="explore-main"><div class="explore-title"><div><span id="explore-group"></span><h1 id="explore-name"></h1></div><button id="ex-about" class="quiet">Как работает</button></div>
  <div class="ex-visual-tabs" aria-label="Что показывает схема"><button id="ex-shape" aria-pressed="true">Что это</button><button id="ex-impact" aria-pressed="false">Что меняется</button></div><div class="explore-picture" id="explore-picture"></div><div id="explore-outcomes" class="explore-outcomes" aria-label="Результат изменения"></div><p class="explore-one" id="explore-one"></p>
  <div class="explore-dock"><div id="ex-context" class="ex-context"><label for="ex-steer">Steering angle <output id="ex-steer-value"></output></label><input type="range" id="ex-steer" min="-55" max="55" step="0.5" value="-28" aria-label="Steering angle для проверки"><button id="ex-zero" class="quiet">0°</button></div>
  <div class="explore-input-top"><label for="ex-range" id="ex-label"></label><span id="ex-value"></span></div><div id="ex-numeric-row" class="explore-range-row"><button id="ex-minus" aria-label="Уменьшить параметр">−</button><input type="range" id="ex-range"><button id="ex-plus" aria-label="Увеличить параметр">+</button><input type="number" id="ex-number" aria-label="Точное значение параметра"></div><div id="ex-enums" class="ex-presets"></div>
  <div class="ex-options"><div id="ex-presets" class="ex-presets"></div><label id="ex-lock-wrap"><input type="checkbox" id="ex-lock"> Сохранять Trail</label><span id="ex-steps"></span></div>
  <div class="ex-compare"><button id="ex-save" class="quiet">Запомнить</button><button id="ex-undo" class="quiet">Вернуть</button><span>Пунктир / «было» — сохранённое</span></div></div></div>
  <aside class="explore-help"><p class="eyebrow">КАК ЭТО УСТРОЕНО</p><h2 id="ex-help-title"></h2><p id="ex-definition"></p><h3>На что влияет</h3><p id="ex-effect"></p><h3>Попробуйте</h3><p id="ex-tip"></p><div id="ex-state" class="ex-state"></div><button id="ex-detail" class="primary">Открыть подробную схему</button><p class="ex-model-note">Условия движения фиксированы, руль удерживается. Меняются геометрия и расчётные показатели; это учебная модель.</p><button id="ex-method" class="quiet">Допущения и источники</button></aside></div>
  <dialog id="ex-dialog" aria-labelledby="ex-dialog-title"><div class="ex-dialog-head"><h2 id="ex-dialog-title"></h2><button id="ex-close" autofocus>Закрыть</button></div><div id="ex-dialog-body"></div></dialog>`;

  function sideDiagram(k,s,ref){
    const cx=275,ground=215,axis=(v,c,dash='')=>{const x=cx+v.trail*.95,top=x-Math.tan(v.caster*M.rad)*185*1.7;return line(x,ground,top,32,c,3,dash)};
    let a=line(50,215,520,215,G,1)+`<circle cx="${cx}" cy="130" r="85" fill="#182731" stroke="${G}" stroke-width="3"/><circle cx="${cx}" cy="130" r="44" fill="none" stroke="${G}"/>`;
    a+=line(cx,28,cx,215,G,1,'5 5')+axis(ref,O,'6 5')+axis(s,L)+circle(cx,215,5,C)+circle(cx+s.trail*.95,215,5,L);
    a+=arrow(cx,238,cx+s.trail*.95,238,k==='trail'?L:C)+text(280,264,`Mechanical trail ${num(s.trail)} mm`,k==='trail'?L:C,18,'middle');
    a+=text(24,36,`Caster ${num(s.caster)}°`,k==='caster'?L:G,23)+text(360,49,'Перед →',G,18)+text(25,184,'Steering axis',L,16);
    a+=text(365,168,'Contact',C,16)+text(365,188,'center',C,16)+line(365,193,cx,214,C,1);
    return [svg(a,'Вид сбоку: наклон оси Caster и продольное плечо Mechanical trail'),'Вид сбоку · наклон и плечи увеличены для наглядности'];
  }
  function frontDiagram(k,s,ref){
    const cx=328,g=213,ax=v=>cx-v.scrub*.85;
    const axis=(v,c,d)=>line(ax(v),g,ax(v)-Math.tan(v.kpi*M.rad)*155*1.65,36,c,3,d);
    let a=line(42,g,525,g,G,1)+tire(cx,160,s.camber,L,100)+line(cx,55,cx,g,G,1,'5 5')+axis(ref,O,'6 5')+axis(s,C);
    a+=line(133,163,290,176,G,7)+line(133,163,175,67,G,4)+circle(133,163,6,G)+text(24,36,'Центр машины ←',G,17);
    a+=circle(ax(s),g,5,C)+circle(cx,g,5,L)+arrow(ax(s),237,cx,237,k==='scrub'?L:C)+text(300,264,`Scrub radius ${num(s.scrub)} mm`,k==='scrub'?L:G,19,'middle');
    a+=text(365,65,`KPI ${num(s.kpi)}°`,k==='kpi'?L:C,23)+text(365,92,'Steering axis',C,16)+line(366,98,ax(s)-Math.tan(s.kpi*M.rad)*150,103,C,1);
    a+=text(365,162,'Колесо RF',L,18);
    return [svg(a,'Передняя ось: KPI — наклон оси; Scrub radius — поперечное плечо'),'Передняя ось · RF справа · прямые колёса · углы увеличены'];
  }
  function camberDiagram(s,r,ref,rr){
    let a=text(280,24,'Dynamic camber · к дороге сейчас',G,18,'middle');
    r.wheels.forEach((w,i)=>{const x=155+i*250,sign=i?1:-1; a+=line(x-75,204,x+75,204,G,2)+line(x,50,x,204,G,1,'4 4');a+=`<g transform="rotate(${rr.wheels[i].camber*sign*2},${x},204)" opacity=".65">${line(x,204,x,78,O,3,'6 5')}</g><g transform="rotate(${w.camber*sign*2},${x},204)"><rect x="${x-15}" y="78" width="30" height="126" rx="5" fill="${i?L:P}" fill-opacity=".2" stroke="${i?L:P}" stroke-width="3"/></g>`;a+=text(x,241,`${w.name} ${sgn(w.camber)}°`,i?L:P,24,'middle')});
    return [svg(a,'Развал каждого колеса к дороге с учётом руления и крена'),'Передняя ось · LF слева / RF справа · наклон ×2 · пунктир — было'];
  }
  function steeringDiagram(k,s,r,ref,rr){
    let a=text(280,22,`${ackType(s)} Ackermann · ${offsetLabel(s.ack)}`,L,19,'middle')+line(175,113,430,113,G,4);
    r.wheels.forEach((w,i)=>{const x=200+i*200,c=i?L:P;a+=tire(x,113,-rr.wheels[i].delta,O)+tire(x,113,-w.delta,c);const dir=(w.delta-w.alpha)*M.rad;a+=arrow(x,113,x-Math.sin(dir)*100,113-Math.cos(dir)*100,C);a+=text(x,209,`${w.name} δ ${sgn(w.delta)}°`,c,21,'middle')+text(x,236,`Slip angle ${sgn(w.alpha)}°`,C,16,'middle')});
    const sx=65,sy=107-s.rackSide*35,xx=sx-s.ack*3;a+=line(sx,107,xx,sy,L,4)+circle(sx,107,5,G)+circle(xx,sy,5,L)+line(xx,sy,121,sy,C,2)+circle(sx,107-s.rackSide*35,6,O)+text(18,173,'Tie rod',C,15)+text(18,192,'pickup',C,15)+text(280,266,'Перед машины ↑ · голубые стрелки — Velocity',G,16,'middle');
    return [svg(a,'Вид сверху: углы передних колёс относительно их скорости'),'Вид сверху · углы колёс соответствуют расчёту'];
  }
  function slipDiagram(s,r,ref,rr){
    let a=text(280,24,'Вид сверху · перед машины ↑',G,18,'middle');
    r.wheels.forEach((w,i)=>{
      const x=145+i*270,y=145,c=i?L:P;
      const point=(angle,len)=>[x-Math.sin(angle*M.rad)*len,y-Math.cos(angle*M.rad)*len];
      const wheel=point(w.delta,98),velocity=point(w.direction,112),old=point(rr.wheels[i].delta,98);
      const start=point(w.direction,61),end=point(w.delta,61);
      a+=line(x,41,x,195,G,1,'3 6')+line(x,y,...old,G,2,'6 5')+tire(x,y,-w.delta,c,70);
      a+=arrow(x,y,...wheel,c)+arrow(x,y,...velocity,C);
      if(Math.abs(w.alpha)>.01)a+=`<path d="M${start.join(' ')} A61 61 0 0 ${w.alpha>0?0:1} ${end.join(' ')}" fill="none" stroke="${O}" stroke-width="5"/>`;
      a+=text(x,218,`${w.name} · α ${sgn(w.alpha)}°`,c,24,'middle');
      a+=text(x,247,`δ ${sgn(w.delta)}° · Velocity ${sgn(w.direction)}°`,G,16,'middle');
    });
    return [svg(a,'Slip angle: угол между направлением каждого колеса и направлением его движения'),'Цвет колеса — куда смотрит · голубая стрелка — куда движется · оранжевая дуга — α · пунктир — было'];
  }
  function ackDifference(s,steer){
    if(Math.abs(steer)<1e-9)return 0;
    const angles=M.angles({...s,steer}),inner=steer>0?0:1;
    return Math.abs(angles[inner])-Math.abs(angles[1-inner]);
  }
  function dynamicAckDiagram(s,ref){
    const extent=Math.max(1,...[s,ref].flatMap(v=>Array.from({length:56},(_,i)=>Math.abs(ackDifference(v,i))))),x=v=>70+v/55*435,y=v=>137-v/extent*70;
    const current=ackDifference(s,s.steer),kind=Math.abs(current)<1e-8?'Zero':current>0?'Positive':'Reverse';
    let a=text(280,25,`Δδ ${sgn(current,2)}° · ${kind}`,L,24,'middle');
    [-1,0,1].forEach(sign=>{const yy=y(sign*extent);a+=line(70,yy,505,yy,sign?'#2c3e45':G,sign?1:2,sign?'4 5':'')+text(58,yy+6,sgn(sign*extent,1)+'°',G,18,'end')});
    [0,15,30,45,55].forEach(v=>{a+=line(x(v),67,x(v),215,'#26373f',1)+text(x(v),240,v+'°',G,20,'middle')});
    const curve=(v,c,dash)=>`<path d="${Array.from({length:111},(_,i)=>(i?'L':'M')+x(i/2)+' '+y(ackDifference(v,i/2))).join(' ')}" stroke="${c}" stroke-width="3" fill="none" ${dash?'stroke-dasharray="7 5"':''}/>`;
    a+=curve(ref,O,true)+curve(s,L,false)+line(x(Math.abs(s.steer)),51,x(Math.abs(s.steer)),215,C,2,'4 4')+circle(x(Math.abs(s.steer)),y(ackDifference(s,s.steer)),6,C);
    a+=text(280,267,'Steering angle |δ| · от прямых колёс к вывороту',G,18,'middle');
    return [svg(a,'Dynamic Ackermann: разница базовых углов колёс по мере выворота'),s.ack===0?'Offset 0 mm: базовые углы равны на всём диапазоне этой модели.':'Голубая отметка — текущий выворот · без Bump steer · пунктир — было'];
  }
  function motionDiagram(k,s,r,ref){
    let a=`<circle cx="280" cy="145" r="88" fill="none" stroke="#34434e" stroke-dasharray="7 6"/><rect x="245" y="69" width="70" height="148" rx="18" fill="#23333f" stroke="${G}" stroke-width="2"/><path d="M253 103L307 103L303 132L257 132Z" fill="#416071"/>`;
    a+=arrow(280,173,280,32,O)+text(300,45,'Нос',O,17);
    const vel=(v,c,d=false)=>{const len=63+v.speed*.7,b=v.beta*M.rad;return d?line(280,145,280-Math.sin(b)*len,145-Math.cos(b)*len,c,2,'6 4'):arrow(280,145,280-Math.sin(b)*len,145-Math.cos(b)*len,c)};
    a+=vel(ref,O,true)+vel(s,C)+text(25,38,`Speed ${num(s.speed,0)}`,C,20)+text(25,61,'km/h',C,16)+text(25,238,`Drift angle β ${sgn(s.beta)}°`,C,20);
    const angle=s.yaw*M.rad,tipX=280-102*Math.sin(angle),tipY=145-102*Math.cos(angle);
    if(Math.abs(s.yaw)>.01)a+=`<path d="M280 43 A102 102 0 0 ${s.yaw>0?0:1} ${tipX} ${tipY}" fill="none" stroke="${L}" stroke-width="5"/>`+circle(tipX,tipY,5,L);
    a+=text(380,185,'Yaw rate r',L,17)+text(380,211,`${sgn(s.yaw)}°/s`,L,25)+text(380,235,'Дуга за 1 с',G,16);
    return [svg(a,'Вид сверху: направление скорости, угол заноса и вращение кузова'),'Вид сверху · Yaw — разворот в плане, Body roll — наклон вбок'];
  }
  const spring=(x,y,len,c=L)=>{let p=`M${x} ${y}`;for(let i=1;i<=8;i++)p+=`L${x+(i%2?9:-9)} ${y+i*len/9}`;return `<path d="${p}L${x} ${y+len}" fill="none" stroke="${c}" stroke-width="3"/>`};
  function rollDiagram(k,s,r,ref,rr){
    const roll=M.clamp(r.roll*5,-18,18),old=M.clamp(rr.roll*5,-18,18),rcY=215-s.rc*.3;
    let a=line(38,217,522,217,G,1)+tire(125,179,0,P,73)+tire(435,179,0,L,73)+line(125,206,235,188,G,4)+line(435,206,325,188,G,4);
    a+=`<g transform="rotate(${old},280,116)">${line(120,116,440,116,O,3,'7 5')}</g><g transform="rotate(${roll},280,116)"><path d="M110 127L145 99L188 78L372 78L416 99L450 127Z" stroke="${L}" stroke-width="3" fill="#253629"/>${line(118,128,442,128,L,4)}</g>`;
    a+=spring(160,133+Math.sin(roll*M.rad)*-120,51,P)+spring(400,133+Math.sin(roll*M.rad)*120,51,L)+circle(280,105,6,O)+text(300,69,'CG',O,17)+line(280,105,280,rcY,O,2,'5 5')+circle(280,rcY,7,C)+text(297,rcY+6,`RC ${num(s.rc,0)} mm`,C,18);
    a+=text(28,31,`Body roll φ ${sgn(r.roll,2)}°`,L,23)+text(330,31,`aᵧ ${sgn(r.ay/9.81,2)} g`,C,18)+text(130,254,`LF ${num(r.wheels[0].Fz/1000,2)} kN`,P,18,'middle')+text(430,254,`RF ${num(r.wheels[1].Fz/1000,2)} kN`,L,18,'middle');
    return [svg(a,'Передняя ось: Body roll, Roll center, пружины и нагрузки колёс'),'Передняя ось · LF слева / RF справа · крен ×5, рисунок до ±18°'];
  }
  function ratioDiagram(s){
    let a=line(55,219,505,219,G,1)+tire(150,165,0,C,80)+line(150,125,150,72,O,2,'6 5')+arrow(195,198,195,145,C)+text(65,45,'Wheel travel',C,21)+text(185,246,'25 mm',C,21,'middle');
    const len=95-25*s.motionRatio; a+=line(375,60,375,205,G,4)+spring(375,60,len)+arrow(429,195,429,195-25*s.motionRatio*2.1,L)+text(325,45,'Spring travel',L,21)+text(394,246,`${num(25*s.motionRatio,2)} mm`,L,21,'middle');
    a+=text(280,110,'→',G,31,'middle')+text(280,146,`× ${num(s.motionRatio,2)}`,L,21,'middle');
    return [svg(a,'Сравнение хода колеса 25 мм с ходом пружины'),'Условный ход колеса 25 mm · MR = Spring travel / Wheel travel'];
  }
  function bumpDiagram(k,s,r,ref,rr){
    const extent=Math.max(.15,...[s,ref].flatMap(v=>Array.from({length:151},(_,i)=>Math.abs(M.bumpToeAt(v,i-75))))),x=z=>80+(z+75)*400/150,y=v=>135-v/extent*86;
    let a=line(80,135,480,135,G,1)+line(280,38,280,230,G,1)+text(20,28,`Toe change · шкала ±${num(extent,2)}°`,G,17)+text(501,139,'0°',G,16)+text(78,256,'−75',G,16)+text(271,256,'0',G,16)+text(460,256,'+75 mm',G,16);
    const path=(v,c,d='')=>`<path d="${Array.from({length:151},(_,i)=>{const z=i-75;return (i?'L':'M')+x(z)+' '+y(M.bumpToeAt(v,z))}).join(' ')}" fill="none" stroke="${c}" stroke-width="3" ${d?'stroke-dasharray="6 5"':''}/>`;
    a+=path(ref,O,true)+path(s,L);
    [-25,25].forEach(z=>{const v=M.bumpToeAt(s,z),active=(k==='bumpToe'&&z>0)||(k==='reboundToe'&&z<0);a+=circle(x(z),y(v),active?7:4,active?C:G)+text(x(z),y(v)-16,`${z>0?'+':''}${z} mm`,active?C:G,16,'middle')});
    r.wheels.forEach((w,i)=>{const xx=x(w.travel),yy=y(w.toeChange);a+=circle(xx,yy,6,i?L:P)+text(i?475:85,i?58:80,`${w.name} ${sgn(w.toeChange,3)}°`,i?L:P,19,i?'end':'start')});
    a+=text(493,63,'in',G,15)+text(493,213,'out',G,15);
    return [svg(a,'Кривая изменения схождения: по горизонтали ход подвески, по вертикали Toe change'),s.bumpToe===0&&s.reboundToe===0?'Нулевая кривая: подруливания нет. Измените Bump toe / Rebound toe.':'По горизонтали — ход; по вертикали — Toe change · за ±25 mm экстраполяция'];
  }
  function travelDiagram(s,r,rr){
    let a=`<rect x="70" y="34" width="420" height="35" rx="8" fill="#23323e" stroke="${G}"/>`+text(280,58,'Кузов · MacPherson',G,18,'middle')+line(55,205,505,205,G,1,'5 5');
    r.wheels.forEach((w,i)=>{const x=145+i*270,y=166-w.travel*.65,oldY=166-rr.wheels[i].travel*.65,c=i?L:P;a+=line(x,68,x,y,G,5)+spring(x,80,Math.max(12,y-108),c)+line(i?328:232,151,x,y+8,G,4)+`<rect x="${x-16}" y="${oldY-32}" width="32" height="64" rx="4" fill="none" stroke="${O}" stroke-width="2" stroke-dasharray="5 5"/><rect x="${x-16}" y="${y-32}" width="32" height="64" rx="4" fill="#273d30" stroke="${c}" stroke-width="3"/>`+arrow(x+48,166,x+48,y,c)+text(x,241,`${w.name} ${sgn(w.travel)} mm`,c,22,'middle')});
    return [svg(a,'Ход колёс MacPherson относительно кузова: сжатие и отбой'),'«+» колесо вверх, сжатие · «−» вниз, отбой · пунктир — было'];
  }
  function tireDiagram(k,s,ref){
    const R=M.tyreRadius(s)*.3,rim=s.rimDiameter*25.4*.15,oldR=M.tyreRadius(ref)*.3,W=s.tyreWidth*.45;
    let a=`<circle cx="180" cy="135" r="${oldR}" fill="none" stroke="${O}" stroke-dasharray="6 5" stroke-width="2"/><circle cx="180" cy="135" r="${R}" fill="#22303a" stroke="${L}" stroke-width="3"/><circle cx="180" cy="135" r="${rim}" fill="#0e1920" stroke="${C}" stroke-width="3"/>`;
    a+=line(180-rim,135,180+rim,135,C,2)+text(180,123,`${s.rimDiameter} inch`,C,20,'middle')+arrow(180,135-R,180,135-rim,O)+text(43,258,`${s.tyreWidth}/${s.tyreAspect} R${s.rimDiameter}`,L,22);
    a+=`<rect x="${408-W/2}" y="63" width="${W}" height="145" rx="14" fill="#22372a" stroke="${L}" stroke-width="3"/>`+line(408-W/2,229,408+W/2,229,L,3)+text(408,256,`${s.tyreWidth} mm`,L,21,'middle')+text(385,30,'Спереди',G,17)+text(78,28,'Сбоку',G,17);
    return [svg(a,'Размер шины: диаметр диска, высота боковины и ширина'),'Номинальная геометрия шины · оранжевый пунктир — было'];
  }
  function patchDiagram(s,r,ref,rr){
    const patches=r.wheels.map(w=>M.contactPatch(s,w)),old=rr.wheels.map(w=>M.contactPatch(ref,w)),scale=.68,peak=Math.max(...patches.map(p=>p.peakBar),.1);
    const outline=(p,cx,sign)=>{let pts=[];for(let j=0;j<=36;j++){const y=p.yMin+(p.yMax-p.yMin)*j/36,x=Math.sqrt(Math.max(0,2*p.R*(p.z-y*y/(2*p.Rc)+p.tilt*y)));pts.push([cx+sign*y*scale,136-x*scale])}for(let j=36;j>=0;j--){const y=p.yMin+(p.yMax-p.yMin)*j/36,x=Math.sqrt(Math.max(0,2*p.R*(p.z-y*y/(2*p.Rc)+p.tilt*y)));pts.push([cx+sign*y*scale,136+x*scale])}return pts.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' ')+'Z'};
    let a='';patches.forEach((p,i)=>{const cx=155+i*250,sign=i?1:-1;a+=text(cx,25,`${i?'RF':'LF'} · ${num(p.areaCm2,0)} cm²`,i?L:P,22,'middle');for(let yy=-p.half;yy<p.half;yy+=9){for(let xx=-p.length/2;xx<p.length/2;xx+=9){const q=M.contactPressure(p,xx,yy);if(q>0){const t=M.clamp(q*10/peak,0,1);a+=`<rect x="${cx+sign*yy*scale-3.1}" y="${136+xx*scale}" width="6.2" height="6.3" fill="hsl(${190-t*145} 75% ${30+t*30}%)"/>`}}}a+=`<path d="${outline(old[i],cx,sign)}" fill="none" stroke="${O}" stroke-width="2" stroke-dasharray="5 4"/>`+text(cx,242,`Camber ${sgn(r.wheels[i].camber)}°`,G,18,'middle')});
    return [svg(a,'Расчётные пятна контакта LF и RF: цвет показывает давление на дорогу'),'Контакт с дорогой · ярче = больше давление · пунктир — было'];
  }
  function dimensionsDiagram(k,s,r,ref){
    const T=s.track*.085,B=s.wheelbase*.055,oldT=ref.track*.085,oldB=ref.wheelbase*.055,cx=280,cy=136;
    let a=`<rect x="${cx-oldT/2}" y="${cy-oldB/2}" width="${oldT}" height="${oldB}" fill="none" stroke="${O}" stroke-dasharray="6 5"/><rect x="${cx-T/2}" y="${cy-B/2}" width="${T}" height="${B}" rx="20" fill="#21313c" stroke="${G}" stroke-width="2"/>`;
    [-1,1].forEach(side=>[-1,1].forEach(ax=>a+=tire(cx+side*T/2,cy+ax*B/2,0,ax<0?L:G,36)));
    a+=line(cx-T/2,cy-B/2,cx+T/2,cy-B/2,L,3)+line(cx-T/2,cy+B/2,cx+T/2,cy+B/2,G,3)+line(cx-T/2,35,cx+T/2,35,k==='track'?L:G,3)+text(280,21,`Front track ${num(s.track,0)} mm`,k==='track'?L:G,20,'middle');
    a+=line(85,cy-B/2,85,cy+B/2,k==='wheelbase'?L:G,3)+text(25,132,'Wheelbase',k==='wheelbase'?L:G,18)+text(25,159,`${num(s.wheelbase,0)} mm`,k==='wheelbase'?L:G,21)+text(410,80,'Перед ↑',G,18);
    return [svg(a,'Размеры машины сверху: колёсная база и передняя колея'),'Вид сверху · расстояния между центрами колёс'];
  }
  function dampingDiagram(s,ref){
    const torque=s.damping*Math.PI/6,old=ref.damping*Math.PI/6;
    let a=`<circle cx="160" cy="135" r="71" fill="#17242c" stroke="${G}" stroke-width="8"/>`+line(160,135,105,95,G,6)+line(160,135,215,95,G,6)+line(160,135,160,204,G,6)+circle(160,135,13,G);
    a+=arrow(223,88,243,133,C)+text(34,32,'Steering speed 30°/s',C,22)+arrow(78,147,88,105,O)+text(307,91,'Damping torque',L,21)+text(307,125,`${num(torque,2)} N·m`,L,29);
    a+=`<rect x="307" y="157" width="${torque*16}" height="19" rx="4" fill="${L}"/>`+line(307,193,307+old*16,193,O,3,'6 5')+text(305,236,'Против вращения руля',G,17);
    return [svg(a,'Steering damping создаёт сопротивление скорости вращения руля'),'Иллюстрация при заданных 30°/s · при неподвижном руле момент = 0'];
  }
  function forceDiagram(s,r,ref,rr,headline){
    let a=text(280,26,headline||`Friction coefficient μ ${num(s.mu,2)}`,L,21,'middle');r.wheels.forEach((w,i)=>{const x=180+i*220;a+=tire(x,117,-w.delta,i?L:P);const z=M.clamp(w.Fy/60,-100,100),oz=M.clamp(rr.wheels[i].Fy/60,-100,100),d=w.delta*M.rad,od=rr.wheels[i].delta*M.rad;a+=line(x,117,x-oz*Math.cos(od),117-oz*Math.sin(od),O,2,'6 4')+arrow(x,117,x-z*Math.cos(d),117-z*Math.sin(d),C)+text(x,225,`${w.name} Fy ${sgn(w.Fy/1000,2)} kN`,i?L:P,22,'middle')});
    return [svg(a,'Боковая сила на каждом колесе при выбранном сцеплении'),'Стрелки показывают знак и величину силы в осях шины'];
  }

  function torqueDiagram(s,r,ref,rr){
    const cx=280,cy=130,R=77,angle=M.clamp(r.torque/180,-1,1)*2.3,old=M.clamp(rr.torque/180,-1,1)*2.3;
    const arc=(v,c,d='')=>Math.abs(v)<.0001?'':`<path d="M${cx} ${cy-R} A${R} ${R} 0 0 ${v>0?0:1} ${cx-R*Math.sin(v)} ${cy-R*Math.cos(v)}" fill="none" stroke="${c}" stroke-width="5" ${d?'stroke-dasharray="6 5"':''}/>`;
    let a=tire(cx,cy,-s.steer,L,95)+arc(old,O,true)+arc(angle,C)+circle(cx-R*Math.sin(angle),cy-R*Math.cos(angle),5,C);
    a+=text(280,25,'Steering torque',G,19,'middle')+text(280,246,`${sgn(r.torque)} N·m`,L,27,'middle')+text(30,108,'«+» влево',C,17)+text(411,108,'«−» вправо',C,17);
    return [svg(a,'Суммарный момент на рулевом механизме при удерживаемом угле'),'Вид сверху · момент приведён к δ; это не усилие на ободе руля'];
  }
  function effectPicture(k,s,r,ref,rr){
    if(k==='slip')return forceDiagram(s,r,ref,rr,'Slip angle → Lateral force');
    if(k==='dynamicAck')return steeringDiagram(k,s,r,ref,rr);
    if(['caster','kpi'].includes(k))return camberDiagram(s,r,ref,rr);
    if(['camber','tyreWidth','tyreAspect','rimDiameter','tyrePressure','tyreCompliance'].includes(k))return patchDiagram(s,r,ref,rr);
    if(['trail','scrub','mu'].includes(k))return torqueDiagram(s,r,ref,rr);
    if(['beta','yaw','speed','track'].includes(k))return rollDiagram(k,s,r,ref,rr);
    if(['roll','rc','springRate','frontBarRate','motionRatio'].includes(k))return travelDiagram(s,r,rr);
    if(lessons[k][1]==='bump'||k==='wheelbase')return steeringDiagram(k,s,r,ref,rr);
    if(lessons[k][1]==='steering')return forceDiagram(s,r,ref,rr,'Углы колёс → Lateral force');
    return dampingDiagram(s,ref);
  }
  function picture(k,s,r,ref,rr){
    switch(lessons[k][1]){
      case 'slip':return slipDiagram(s,r,ref,rr);
      case 'dynamic':return dynamicAckDiagram(s,ref);
      case 'side':return sideDiagram(k,s,ref);
      case 'front':return frontDiagram(k,s,ref);
      case 'camber':return camberDiagram(s,r,ref,rr);
      case 'steering':return steeringDiagram(k,s,r,ref,rr);
      case 'motion':return motionDiagram(k,s,r,ref);
      case 'roll':return rollDiagram(k,s,r,ref,rr);
      case 'ratio':return ratioDiagram(s);
      case 'bump':return ['wheelTravelLF','wheelTravelRF','bumpFromRoll'].includes(k)?travelDiagram(s,r,rr):bumpDiagram(k,s,r,ref,rr);
      case 'tire':return tireDiagram(k,s,ref);
      case 'patch':return patchDiagram(s,r,ref,rr);
      case 'dimensions':return dimensionsDiagram(k,s,r,ref);
      case 'damping':return dampingDiagram(s,ref);
      case 'force':return forceDiagram(s,r,ref,rr);
    }
  }
  function metricsFor(k,s,r){
    const wheels=(prop,label,unit,n=1)=>r.wheels.map(w=>[`${label} ${w.name}`,w[prop],unit,n]);
    if(k==='dynamicAck')return M.angles(s).map((v,i)=>['Base angle '+(i?'RF':'LF'),v,'°',2]);
    if(['caster','kpi','camber'].includes(k))return wheels('camber','Camber','°');
    if(['ack','steer','rackSide','steeringArm'].includes(k))return wheels('delta','Steering angle','°');
    if(k==='trail')return [['Steering torque',r.torque,'N·m',1],['Caster',s.caster,'°',1]];
    if(k==='scrub')return [['Steering torque',r.torque,'N·m',1],['Kick torque RF · 1 kN',M.calculate(s,1000).torque-r.torque,'N·m',1]];
    if(k==='damping')return [['Damping @ 30°/s',s.damping*Math.PI/6,'N·m',2],['Damping @ 0°/s',0,'N·m',0]];
    if(['beta','yaw','speed'].includes(k))return [['Lateral acceleration',r.ay/9.81,'g',2],['Body roll φ',r.roll,'°',2]];
    if(['roll','rc','springRate','frontBarRate'].includes(k))return [['Body roll φ',r.roll,'°',2],['Front elastic transfer',Math.abs(r.elastic)/1000,'kN',2]];
    if(k==='motionRatio')return [['Wheel rate',r.rates.wheelNmm,'N/mm',1],['Body roll φ',r.roll,'°',2]];
    if(lessons[k][1]==='bump')return wheels('toeChange','Toe change','°',3);
    if(['tyreWidth','tyreAspect','rimDiameter'].includes(k))return [['Tire radius',M.tyreRadius(s),'mm',1],['Sidewall height',s.tyreWidth*s.tyreAspect/100,'mm',1]];
    if(['tyrePressure','tyreCompliance'].includes(k))return r.wheels.map(w=>['Contact patch '+w.name,M.contactPatch(s,w).areaCm2,'cm²',0]);
    if(k==='mu')return wheels('Fy','Lateral force','N',0);
    if(k==='track')return [['Body roll φ',r.roll,'°',2],['Front roll stiffness',r.rates.frontRoll/1000,'kN·m/rad',1]];
    return wheels('alpha','Slip angle','°');
  }
  function setupParam(){
    const d=def(selected),info=lessons[selected],enumMode=['rackSide','bumpFromRoll'].includes(selected);
    $('param-select').value=selected;$('param-count').textContent=`${keys.indexOf(selected)+1} / ${keys.length}`;
    $('explore-name').textContent=name(selected);$('explore-group').textContent=info[0];$('explore-one').textContent=info[2];
    $('ex-help-title').textContent=name(selected);$('ex-definition').textContent=info[2];$('ex-effect').textContent=info[3];$('ex-tip').textContent=info[4];if(['ack','dynamicAck'].includes(selected))$('ex-tip').insertAdjacentHTML('beforeend','<br><button class="ack-guide-button" data-ack-guide>Ackermann в заносе: простое объяснение</button>');
    $('ex-label').textContent=def(selected)[1];$('ex-label').htmlFor=enumMode?'ex-enums':'ex-range';
    for(const id of ['ex-range','ex-number']){const el=$(id);el.min=d[2];el.max=d[3];el.step=id==='ex-number'&&d[0]!=='ack'?'any':d[4];el.setAttribute('aria-label',d[1]+(id==='ex-number'?': точное значение':': изменить'));}
    $('ex-numeric-row').hidden=enumMode;$('ex-enums').hidden=!enumMode;
    $('ex-enums').innerHTML=enumMode?(selected==='rackSide'?[[-1,'За осью'],[1,'Перед осью']]:[[0,'Выключено'],[1,'Включено']]).map(([v,t])=>`<button data-ex-value="${v}">${t}</button>`).join(''):'';
    $('ex-presets').innerHTML=info[6].map(v=>`<button data-ex-value="${v}">${num(v,d[4]<.1?2:v%1?1:0)}${d[5]==='°'?'°':''}</button>`).join('');
    $('ex-lock-wrap').hidden=!['caster','trail'].includes(selected);
    $('ex-steps').textContent=d[0]==='ack'?'Шаг 1,5 mm · − внутрь / + наружу':'';
    $('ex-context').hidden=!['side','front','camber','steering','dynamic','patch','force'].includes(info[1])||selected==='steer';
    renderExplorer();
  }
  function renderExplorer(){
    if(!learning)return;
    const r=M.calculate(state),d=def(selected),v=state[d[0]],m=metricsFor(selected,state,r),old=metricsFor(selected,reference,referenceResult),[drawing,caption]=(effectView?effectPicture:picture)(selected,state,r,reference,referenceResult);
    $('ex-shape').setAttribute('aria-pressed',!effectView);$('ex-impact').setAttribute('aria-pressed',effectView);
    $('explore-picture').innerHTML=drawing+`<p>${caption}</p>`;
    $('explore-outcomes').innerHTML=m.map(([label,value,unit,n],i)=>`<div><span>${label}</span><strong>${num(value,n)} <small>${unit}</small></strong><small>было ${num(old[i][1],n)} · <b>${sgn(value-old[i][1],n)}</b></small></div>`).join('');
    $('ex-value').textContent=specialValue(selected,v);$('ex-range').value=v;
    if(document.activeElement!==$('ex-number'))$('ex-number').value=round(v,3);
    $('ex-lock').checked=lockTrail;$('ex-steer').value=state.steer;$('ex-steer-value').textContent=sgn(state.steer)+'°';
    $('explorer').querySelectorAll('[data-ex-value]').forEach(b=>{b.classList.toggle('active',Math.abs(+b.dataset.exValue-v)<1e-8);b.setAttribute('aria-pressed',Math.abs(+b.dataset.exValue-v)<1e-8)});
    $('ex-minus').disabled=v<=d[2];$('ex-plus').disabled=v>=d[3];
    $('ex-state').innerHTML=`<span>Условия сравнения</span><p>Steering angle ${sgn(state.steer)}°<br>Drift angle ${sgn(state.beta)}° · Speed ${num(state.speed,0)} km/h<br>Yaw rate ${sgn(state.yaw)}°/s · Body roll ${sgn(r.roll,2)}°<br>Static camber ${sgn(state.camber)}° · Caster ${num(state.caster)}°<br>KPI ${num(state.kpi)}° · Trail ${num(state.trail)} mm<br>Wheel input LF / RF ${sgn(state.wheelTravelLF,0)} / ${sgn(state.wheelTravelRF,0)} mm</p>`;
    const dialogState=$('ex-dialog-body').querySelector('.ex-state');if($('ex-dialog').open&&dialogState)dialogState.innerHTML=$('ex-state').innerHTML;
  }
  function captureReference(){reference={...state};referenceResult=M.calculate(reference);refLock=lockTrail}
  function select(k){if(k!==selected)captureReference();selected=k;effectView=false;setupParam()}
  function setMode(learn,detail){
    document.dispatchEvent(new CustomEvent('geometry-mode',{detail:learn?'learn':'full'}));
    if(learn&&!learning)captureReference();learning=learn;document.body.classList.toggle('learning-mode',learn);$('explorer').hidden=!learn;$('learn-mode').setAttribute('aria-pressed',learn);$('full-mode').setAttribute('aria-pressed',!learn);
    free=false;steerVelocity=0;running=!learn;if(scene==='transition')scene='custom';if(detail)view=detail;
    if(learn)setupParam();sync();render();window.scrollTo(0,0);
  }
  function openDetail(){if($('ex-dialog').open)$('ex-dialog').close();setMode(false,lessons[selected][5]);}
  const renderLab=render;
  render=function(){if(learning){result=M.calculate(state);renderExplorer()}else renderLab()};
  $('param-select').onchange=e=>select(e.target.value);
  $('param-prev').onclick=()=>select(keys[(keys.indexOf(selected)+keys.length-1)%keys.length]);
  $('param-next').onclick=()=>select(keys[(keys.indexOf(selected)+1)%keys.length]);
  $('ex-range').oninput=e=>setValue(def(selected)[0],+e.target.value);
  $('ex-number').oninput=e=>{if(e.target.value!==''&&e.target.validity.valid)setValue(def(selected)[0],+e.target.value)};
  $('ex-number').onchange=()=>{$('ex-number').value=round(state[def(selected)[0]],3)};
  $('ex-minus').onclick=()=>{const d=def(selected);setValue(d[0],round(state[d[0]]-d[4],3))};
  $('ex-plus').onclick=()=>{const d=def(selected);setValue(d[0],round(state[d[0]]+d[4],3))};
  $('explorer').addEventListener('click',e=>{const b=e.target.closest('[data-ex-value]');if(b)setValue(def(selected)[0],+b.dataset.exValue)});
  $('ex-steer').oninput=e=>setValue('steer',+e.target.value);$('ex-zero').onclick=()=>setValue('steer',0);
  $('ex-shape').onclick=()=>{effectView=false;renderExplorer()};$('ex-impact').onclick=()=>{effectView=true;renderExplorer()};
  $('ex-lock').onchange=e=>{lockTrail=e.target.checked;sync();renderExplorer()};
  $('ex-save').onclick=()=>{captureReference();renderExplorer();$('ex-save').textContent='Запомнено';setTimeout(()=>{$('ex-save').textContent='Запомнить'},1000)};
  $('ex-undo').onclick=()=>{state={...reference};lockTrail=refLock;free=false;steerVelocity=0;sync();render()};
  $('learn-mode').onclick=()=>setMode(true);$('full-mode').onclick=()=>setMode(false);$('ex-detail').onclick=openDetail;
  $('ex-about').onclick=()=>{if(selected==='ack'){AckermannGuide.open();return}const info=lessons[selected],d=def(selected);$('ex-dialog-title').textContent=name(selected);$('ex-dialog-body').innerHTML=`<p>${info[2]}</p><h3>На что влияет</h3><p>${info[3]}</p><h3>Попробуйте</h3><p>${info[4]}</p><div class="ex-presets dialog-presets">${info[6].map(v=>`<button data-ex-value="${v}">${num(v,v%1?2:0)} ${d[5]}</button>`).join('')}</div>${['caster','trail'].includes(selected)?`<label class="dialog-lock"><input id="ex-dialog-lock" type="checkbox" ${lockTrail?'checked':''}> Сохранять Trail при смене Caster</label>`:''}<div class="ex-state">${$('ex-state').innerHTML}</div>${selected==='dynamicAck'?'<button class="ack-guide-button" data-ack-guide>Ackermann в заносе: простое объяснение</button>':''}<button id="ex-dialog-detail" class="primary">Открыть подробную схему</button><p class="ex-model-note">${document.querySelector('.ex-model-note').textContent}</p>`;$('ex-dialog').showModal();$('ex-dialog-detail').onclick=openDetail;if($('ex-dialog-lock'))$('ex-dialog-lock').onchange=e=>{lockTrail=e.target.checked;sync();renderExplorer()}};
  $('ex-close').onclick=()=>$('ex-dialog').close();
  $('ex-method').onclick=()=>{setMode(false);const details=document.querySelector('.methodology details');details.open=true;details.scrollIntoView({block:'start'})};
  const resetLab=$('reset').onclick;$('reset').onclick=()=>{resetLab();if(learning){running=false;free=false;reference={...state};referenceResult=M.calculate(reference);refLock=lockTrail;renderExplorer()}};
  $('ex-save').title='Обновить точку сравнения для выбранного параметра';$('ex-undo').title='Вернуть все настройки в точку сравнения';
  document.querySelector('.ex-model-note').textContent+=' «Было» фиксируется при выборе параметра; «Запомнить» обновляет точку сравнения.';
  $('lessons').insertAdjacentHTML('beforeend','<article class="lesson"><div class="index">/ 07</div><h3>Dynamic Ackermann</h3><p>Одна настройка тяги может давать разную разницу углов колёс на малом и большом вывороте. Поэтому Zero в одной точке реальной кинематики ещё не означает параллельные колёса на всём диапазоне.</p><p class="small">В дрифте это меняет угол увода и силу ведомого колеса. Bump steer — отдельная добавка от хода подвески.</p><button id="open-dynamic-ack">Посмотреть зависимость от Steering angle</button></article>');
  $('open-dynamic-ack').onclick=()=>{select('dynamicAck');setMode(true)};
  $('method').insertAdjacentHTML('beforeend',`<p><strong>Dynamic Ackermann.</strong> Здесь термин обозначает зависимость разницы углов от выворота. График строится из базовой функции Ackermann: Δδ = |δ inner| − |δ outer|; inner выбирается по знаку Steering angle. Показан модуль центрального угла 0…55°; левая и правая ветви симметричны в этой модели. Внешняя разница от Bump steer исключена из графика и Base angle LF/RF, но входит в итоговые углы схемы «Что меняется». Offset — вход в миллиметрах, Δδ — результат в градусах; проценты не используются. Подвижные координаты рейки и тяг не решаются, поэтому при фиксированном Offset эта формула не воспроизводит смену Reverse / Positive по мере выворота. Это ограничение модели, а не общее свойство подвески. <a href="https://race.software/academy/suspension-designer-library/ackermann-at-50mm-rack-travel/" target="_blank" rel="noopener">RACE: Ackermann меняется с углом руления</a>. <a href="https://www.wisefab.com/amfile/file/download/file/12/product/6422/" target="_blank" rel="noopener">Wisefab: нелинейность и возможная смена знака в реальной геометрии</a>.</p>`);
  view='course';setMode(true);
})();
