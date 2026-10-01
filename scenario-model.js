(function(root){
  'use strict';
  const M=root.DriftModel||(typeof require==='function'?require('./model.js'):null);
  const D=root.DriftDynamics||(typeof require==='function'?require('./dynamics.js'):null);
  const presets={
    contact:{name:'Только Contact patch',description:'Подбор геометрии контакта в Working range, без цели по траектории.'},
    wide:{name:'Широкая дуга',radius:80,angle:25,speed:65,steer:21,description:'Цель — сохранить широкую дугу и умеренный Drift angle при том же положении руля.'},
    tight:{name:'Малый радиус',radius:30,angle:38,speed:45,steer:34,description:'Цель — попасть в тесную дугу, сохранив угол и скорость. Уменьшение радиуса не равно увеличению Yaw rate.'},
    high:{name:'Большой угол',radius:55,angle:48,speed:60,steer:44,description:'Цель — сохранить большой Drift angle без быстрого нарастания угла и разворота.'},
    low:{name:'Малый угол',radius:100,angle:18,speed:70,steer:14,description:'Цель — сохранить небольшой Drift angle и открытую дугу, без лишнего роста угла.'},
    transition:{name:'Малый угол · перекладка под тягой',radius:65,angle:22,speed:60,steer:18,description:'Одна цель по Drift angle и одинаковый алгоритм коррекции, постоянный Rear drive. Руль реагирует на фактическое движение машины.'}
  };
  const defaults={kind:'contact',radius:80,angle:25,drive:.7,rearGrip:.6,transitionTime:1.6,driver:'feedback'};
  function program(s,c){
    if(c.kind!=='transition')return null;
    const sign=Math.sign(s.beta)||-1;
    return [{t:0,steer:s.steer},{t:.1,steer:sign*Math.min(55,Math.abs(s.steer)+12)},{t:.2,steer:sign*Math.min(55,Math.abs(s.steer)+12)},{t:.9,steer:-s.steer},{t:1.3,steer:M.clamp(-s.steer-sign*2,-55,55)},{t:2,steer:M.clamp(-s.steer-sign*2,-55,55)}];
  }
  function evaluate(s,config={}){
    const c={...defaults,...config},transition=c.kind==='transition',duration=transition?2:.6;
    const driver=transition&&c.driver==='feedback'?{startBeta:s.beta,targetBeta:-(Math.sign(s.beta)||-1)*c.angle}:null;
    const run=D.simulate(s,{drive:c.drive,rearGrip:c.rearGrip,brake:0},duration,transition?1/240:1/120,{program:driver?null:program(s,c),driver,stopOnReversal:!transition});
    const end=run.frames.at(-1),turn=Math.sign(s.yaw)||-Math.sign(s.beta)||1,sign=Math.sign(s.beta)||-1;
    const window=run.frames.filter(p=>p.t>=Math.min(.2,run.duration));
    const mean=fn=>window.reduce((a,p)=>a+fn(p),0)/window.length;
    const radiusError=mean(p=>Math.abs(D.curvature(p)-turn/c.radius)*c.radius);
    const angleError=mean(p=>Math.abs(Math.abs(p.beta)-c.angle));
    const angleWorst=Math.max(...window.map(p=>Math.abs(Math.abs(p.beta)-c.angle)));
    const radiusWorst=Math.max(...window.map(p=>{const k=D.curvature(p)*turn;return k>1e-8?Math.abs(1/k-c.radius)/c.radius:Infinity}));
    const reverseCurve=window.some(p=>D.curvature(p)*turn<=0);
    const lostSide=window.some(p=>p.beta*sign<=0);
    const speedLoss=s.speed-end.speed;
    const firstZero=run.frames.find(p=>p.beta*sign<=0)?.t??null;
    // Completion requires the opposite angle to persist for at least 0.15 s.
    const targetFrames=run.frames.filter(p=>-p.beta*sign>=c.angle-3&&-p.beta*sign<=c.angle+10);
    let reachedAt=null;
    for(const p of targetFrames){const tail=run.frames.filter(q=>q.t>=p.t&&q.t<=p.t+.15+1e-8);if(tail.at(-1).t-p.t>=.149&&tail.every(q=>-q.beta*sign>=c.angle-3&&-q.beta*sign<=c.angle+10)){reachedAt=p.t;break}}
    const complete=run.duration>=duration-1e-8&&!run.reason;
    const endAngle=-end.beta*sign;
    const endBetaRate=(D.curvature(end)*end.speed/3.6-end.r)*M.deg;
    const transitionOk=complete&&reachedAt!==null&&reachedAt<=c.transitionTime&&Math.abs(endAngle-c.angle)<=10&&Math.abs(endBetaRate)<=15;
    const arcOk=complete&&!lostSide&&!reverseCurve&&angleWorst<=5&&radiusWorst<=.2;
    const error=transition
      ? (reachedAt===null?2:reachedAt/c.transitionTime)+Math.abs(endAngle-c.angle)/30+Math.max(0,Math.abs(endBetaRate)-15)/30+(complete?0:3)
      : (c.kind==='wide'||c.kind==='tight'?1.5:1)*radiusError+(c.kind==='high'||c.kind==='low'?1.5:1)*angleError/10+(lostSide||reverseCurve?2:0)+(complete?0:3);
    return {run,score:100-25*error-30*Math.max(0,speedLoss)/s.speed,ok:transition?transitionOk:arcOk,complete,angleError,angleWorst,radiusError,radiusWorst,reverseCurve,lostSide,speedLoss,firstZero,reachedAt,endAngle,endBetaRate,radius:Math.abs(D.curvature(end))>1e-7?1/D.curvature(end):null,config:c};
  }
  const api={presets,defaults,program,evaluate};root.DriftScenarios=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
