# Drift Geometry Lab

Интерактивная учебная лаборатория геометрии MacPherson в дрифте.
Интерфейс и пояснения на русском, названия параметров на английском.

Ackermann, Caster, KPI, Camber, Mechanical trail, Scrub radius, Roll center,
Bump steer, Front spring rate, Front anti-dive, Rear anti-squat, Slip angle и расчётная оценка Contact patch.
Графики показывают изменения LF и RF по диапазону Steering angle.

## Запуск

Откройте `index.html` в современном браузере или используйте любой статический
веб-сервер. Все расчёты выполняются в браузере; серверная часть не требуется.

## Публикация

GitHub Pages публикует корень ветки `main` после каждого обновления.
Файл `.nojekyll` сохраняет обычную статическую раздачу файлов.

## Модель

Это учебная модель, а не валидированный симулятор конкретной машины.
В старом полном симуляторе и графиках движение задано пользователем.
В новом режиме **Настроить → Ackermann / Path** движение рассчитывается
из сил четырёх шин: плоская динамика кузова, RK4, приближённый перенос
нагрузки, ограничение совместной силы кругом трения. Руль и запросы сил
от педалей удерживаются; скрытого стабилизатора дрифта нет.

**Caster / Camber** подбирает Static camber для заданного Dynamic camber
и сравнивает сочетания в Working range. **Связи** показывает причинные
связи и перебирает Ackermann шагом 1,5 mm для приближения одного выбранного
показателя к сохранённому. Совпадение одного показателя не гарантирует
одинаковую траекторию. Площадь контакта не равна проценту сцепления.

Прямые ссылки: `#camber`, `#ack`, `#links`.
Допущения, критерии подбора и источники доступны по кнопке «Как работает».

## Driving target и редактирование результатов

Working range доступен во всех трёх разделах настройки. В подбор включён
Ackermann offset −9…+9 mm с шагом 1,5 mm: до 2106 сочетаний с Caster,
Static camber и KPI. При выборе Driving target стартовые условия и диапазон
явно устанавливаются пресетом: широкая дуга, малый радиус, большой или
малый угол, перекладка при постоянной тяге. Целевые Radius и Drift angle
можно изменить независимо от старта.

Для оценки движения берутся до трёх лучших вариантов по контакту для
каждого Ackermann. Контакт уточняется до 0,5° по Steering angle.
Дуги проверяются на первом отклике 0,6 s; это не тест длительной устойчивости.
Перекладка длится 2 s. По умолчанию Feedback корректирует Steering angle
по фактическому Drift angle и его производной относительно плавной цели.
Это идеализированный PD-регулятор (kp 0,3, kd 0,5 s), с опережением
−4° tanh(β/5°), фильтром 0,1 s, пределом ±55° и скоростью до 120°/s.
Он не моделирует человека, не удерживает Radius и не меняет Rear drive.
Два прогона имеют одинаковую цель, но могут иметь разный Steering angle.
Альтернатива Fixed program задаёт одинаковый Steering angle по таймеру
без реакции на машину. Оба режима могут провалить перекладку.
Успех требует удержания противоположного диапазона 0,15 s, достижения
до 1,6 s, конечного угла ±10° от цели и |dβ/dt| ≤ 15°/s в конце.
Цели, которые не удалось выполнить, отмечаются как компромиссы.

В карточке можно менять Caster, Static camber и KPI. Изменённый параметр
становится Fixed; остальные перебираются повторно при сохранённом Ackermann.
Несколько Fixed допустимы. Мини-график показывает изменение относительно
исходного варианта карточки. Ограниченный поиск не гарантирует оптимум.

В Ackermann / Path по умолчанию сравнивается **одинаковый Central steering
angle**, а не один и тот же угол отдельного колеса. Режим Isolate trailing
wheel явно меняет положение рулевого механизма для фиксации Leading angle
и потому может дать другой эффект. Сравнение прекращается при потере
исходной стороны заноса. Path radius вычисляется из кривизны фактической
траектории с учётом изменения sideslip; это не Speed / Yaw rate.

В Caster / Camber показаны нагрузки Fz. Equal wheel load сравнивает пятна
при одинаковых 3372 N, чтобы отделить влияние Camber от переноса нагрузки.
Camber only включён по умолчанию: схема, площади и проценты используют
одинаковую нагрузку. Camber + Load меняет их вместе на расчётные нагрузки.
Серый контур — Camber 0° при выбранной нагрузке. Силы и Working range
всегда используют расчётный перенос веса. Площадь не определяется одним Camber.

Arc illustration в Ackermann / Path сохраняет β, V и кривизну первого
отклика на 0,3 s и рисует соответствующие окружности от общей касательной.
Это явно обозначенная геометрическая схема, а не динамический прогноз
или доказательство устойчивости. Free response сохраняет реальный расчёт
движения без коррекций. Недопустимый первый отклик не продолжается схемой.

В результатах подбора показывается лучший проверенный вариант каждого
типа Ackermann: Reverse / Zero / Positive, а не три похожих победителя
одного знака. Рядом раскрыты показатели и ограничения рейтинга.

## Проверка расчёта

`node tests/physics.cjs`

`node tests/driving-targets.cjs`

Проверяются компенсация Camber и её границы, фиксация Leading angle,
зеркальная симметрия, сохранение вертикальной нагрузки, круг трения,
торможение и выбег, сходимость шага интегрирования и изменение траектории
при независимом изменении Ackermann.
Дополнительные проверки охватывают направление первого отклика в исходном
примере, отличие режима Isolate trailing, вычисление кривизны, остановку при
потере заноса, сетку из 2106 сочетаний, динамику перекладки с симметрией и
сходимостью по шагу, влияние нагрузки на площадь контакта.

`node tests/clarity-audit.cjs` проверяет согласованность нагрузки и площади,
три типа Ackermann, геометрию схемы дуг, реакцию Feedback, зеркальность,
сходимость шага, ограничения руля и 24 сочетания геометрии.


## Anti-dive / Anti-squat

Вкладка `#anti` — общий квазистатический опыт продольной нагрузки.
Ввод: Front anti-dive 0…150% (нормировано при Front brake bias 65%),
Rear anti-squat 0…150%, Longitudinal acceleration −1…1 g,
Front brake bias 0…100%, Rear wheel rate 10…150 N/mm.
0% — нейтральная исходная настройка; 55 N/mm сзади — условное значение.

При m = 1250 kg, h = 0,52 m, L = Wheelbase:
- ΔFz,rear = m·ax·h/L; ΔFz,front = −ΔFz,rear.
- cF = AntiDive/100 · h/(L·0,65); cR = AntiSquat/100 · h/L.
- GeoFront = actual front braking force · cF.
- GeoRear = actual rear drive force · cR.
- Front pitch travel = (ΔFz,front − GeoFront)/(2·front wheel rate).
- Rear pitch travel = (ΔFz,rear − GeoRear)/(2·rear wheel rate).

Anti не уменьшает общий перенос веса и не является множителем сцепления.
100% компенсирует добавочное сжатие выбранной оси в эталонном опыте,
но не обнуляет движение противоположной оси. На статической схеме
база сравнения — 0% обоих Anti при тех же нагрузках и жёсткости.
В «Разобраться» пунктир соответствует сохранённым настройкам и его метрикам.

Front pitch travel добавляется к manual travel и roll travel до кривой
Bump steer и ограничения ±75 mm. Изменяются Toe change, фактический
Steering angle и зависящие от него силы. Сама кривая Toe не меняется.
В динамике ax и реализованные силы торможения/тяги сглаживаются с 0,15 s;
Ax из статического ползунка не подменяет ускорение прогона. Внешняя
аэродинамическая или боковая тормозящая сила не выдаётся за передний тормоз.

Предположения: вся масса сосредоточена на кузове; Rear anti-lift и Front
anti-lift нулевые. Жёсткость задней оси на крен остаётся 65 kN·m/rad.
Нет pitch inertia/damping, hardpoint solver, заднего toe/camber gain,
изменения Caster от хода или деформации шин. Поэтому Rear anti-squat
меняет рассчитанное приседание, но сам по себе не меняет planar rear grip.
Влияние этой модели на реальную машину без её кинематики не валидировано.

Источники: [RACE anti-properties](https://race.software/academy/suspension-designer-library/anti-dive-and-anti-lift-and-anti-squat/),
[OptimumG: geometry, elastic reaction and brake distribution](https://optimumg.com/wp-content/uploads/2024/03/OptimumG-V32N4.pdf).
Проверка: `node tests/anti-geometry.cjs` — сохранение нагрузки, 0/50/100/150%,
Brake bias, неактивные режимы, Bump steer, зеркальность и сходимость динамики,
отсутствие искусственного увеличения grip и 36 сочетаний статического опыта.


## High roll center / Roll jacking

`#roll` adds a front-axle view (seen from behind), RC presets 0 / 60 / 150 / 200 mm, mirrored cornering, spring/ARB controls and live analysis. `Разобраться` contains separate Roll center and Roll jacking lessons. Parameter labels stay English; explanations remain Russian.

The existing RC model remains active: roll moment uses the front/rear weighted roll-axis height, with rear RC fixed at 80 mm and rear roll stiffness 65 kN·m/rad. Raising front RC reduces elastic roll and changes front/rear load-transfer distribution. `rollAnalysis` shows front/rear geometric and elastic contributions; their whole-car sum equals m·Ay·CG height / track before wheel-lift clipping. “Transfer” is the load added to one side (not the difference between both wheel loads).

`jackingEstimate` is a separate diagnostic of a symmetric front-view equivalent force geometry. For body-frame tyre forces, V_L = −Fy_L·2h_RC/T and V_R = +Fy_R·2h_RC/T; net upward reaction is their signed sum. Equal signed lateral forces cancel; mirrored forces swap vertical reactions and preserve the sum. Estimated front heave is net reaction / (2·front wheel rate), excluding the ARB's roll stiffness. This estimate is not fed back into Fz, contact, wheel travel, Bump steer or trajectories. It is not a full hardpoint, migrating RC, heave/pitch or equilibrium solution, and the prescribed drift state need not be force-balanced. No real-vehicle height or grip claim is made from this diagnostic.

The RC diagram exaggerates height by 2.5 and body roll by 3. Arrows indicate signed reactions, with display lengths bounded for readability. Steering jacking from Caster/KPI is explicitly distinguished from Roll jacking.

Validation: `node tests/roll-jacking.cjs` covers signed projection, zero/negative RC, equal/opposed tyre forces, mirror symmetry, spring vs ARB heave stiffness, conservation of total transfer and 45 combinations of RC, yaw and stiffness. All earlier physics, anti-geometry and driving-target suites also pass.

Sources: [OptimumG, September 2021](https://optimumg.com/wp-content/uploads/2021/10/OptimumG-Septepmber-2021.pdf), [Jahee Campbell-Brennan, Kinematics and Compliance](https://www.racecar-engineering.com/tech-explained/racecar-kinematics-and-compliance/).
