(function(root){
  'use strict';
  const M=root.DriftModel||(typeof require==='function'?require('./model.js'):null);
  const leading=s=>Math.abs(s.beta)<.5?null:s.beta<0?1:0;
  function solve(s,key,wheel,target,prop,bounds){
    let [lo,hi]=bounds;
    const measure=v=>M.calculate({...s,[key]:v}).wheels[wheel][prop];
    const low=measure(lo),high=measure(hi),increasing=high>=low;
    if(target<Math.min(low,high)||target>Math.max(low,high)){
      const value=Math.abs(low-target)<Math.abs(high-target)?lo:hi;
      return {value,actual:measure(value),target,reached:false};
    }
    for(let i=0;i<30;i++){const mid=(lo+hi)/2;if((measure(mid)<target)===increasing)lo=mid;else hi=mid}
    const value=(lo+hi)/2,actual=measure(value);
    return {value,actual,target,reached:Math.abs(actual-target)<.002};
  }
  const solveCamber=(s,wheel,target,bounds=[-5,-3])=>solve(s,'camber',wheel,target,'camber',bounds);
  const solveSteer=(s,wheel,target)=>solve(s,'steer',wheel,target,'delta',[-55,55]);
  function at(s){
    const r=M.calculate(s);
    return {result:r,wheels:r.wheels.map(w=>{const patch=M.contactPatch(s,w),zero=M.contactPatch(s,{...w,camber:0});return {...w,patch,area:patch.areaCm2,retention:zero.areaCm2>1e-8?100*patch.areaCm2/zero.areaCm2:null}})};
  }
  function angles(from,to,step=2){const lo=Math.min(from,to),hi=Math.max(from,to),count=Math.max(1,Math.ceil((hi-lo)/step));return Array.from({length:count+1},(_,i)=>lo+(hi-lo)*i/count)}
  function range(s,from,to,wheel,goal='leading',step=2){
    const points=angles(from,to,step).map(steer=>({steer,...at({...s,steer})}));
    const stats=[0,1].map(i=>{
      const ws=points.map(p=>p.wheels[i]),areas=ws.map(w=>w.area),mean=areas.reduce((a,b)=>a+b,0)/areas.length;
      return {minArea:Math.min(...areas),minRetention:Math.min(...ws.map(w=>w.retention??0)),variation:mean>0?100*(Math.max(...areas)-Math.min(...areas))/mean:Infinity,
        minCamber:Math.min(...ws.map(w=>w.camber)),maxCamber:Math.max(...ws.map(w=>w.camber)),
        meanForce:ws.reduce((a,w)=>a+Math.abs(w.Fy),0)/ws.length,meanMoment:ws.reduce((a,w)=>a+Math.abs(w.yawMoment),0)/ws.length,
        meanTorque:ws.reduce((a,w)=>a+Math.abs(w.torque),0)/ws.length,
        forceRatio:ws.reduce((a,w)=>a+Math.abs(w.Fy)/Math.max(1,w.capacity),0)/ws.length};
    });
    const lead=stats[wheel],trail=stats[1-wheel];
    let score=lead.minRetention-.35*lead.variation;
    if(goal==='both')score=(lead.minRetention+trail.minRetention)/2-.175*(lead.variation+trail.variation);
    if(goal==='quiet')score-=20*trail.forceRatio+10*trail.meanMoment/(1250*9.81*.55*s.mu*(s.wheelbase/1000*.45));
    return {setup:{...s},stats,points,score};
  }
  function candidates(s,offsets=[s.ack]){const out=[];for(const ack of offsets)for(const kpi of [8,10,12])for(let caster=4;caster<=6.5;caster+=.5)for(let camber=-5;camber<=-3;camber+=.25)out.push({...s,ack,kpi,caster,camber});return out}
  function matchAck(s,reference,wheel=leading(s)??1,metric='moment'){
    const targetAngle=M.calculate(s).wheels[wheel].delta;
    const base={...reference,beta:s.beta,yaw:s.yaw,speed:s.speed};
    const baseSteer=solveSteer(base,wheel,targetAngle);base.steer=baseSteer.value;
    const measure=r=>metric==='torque'?r.torque:metric==='force'?r.wheels[1-wheel].Fy:r.wheels[1-wheel].yawMoment;
    const target=measure(M.calculate(base)),points=[];
    for(let ack=-9;ack<=9;ack+=1.5){const setup={...s,ack},steering=solveSteer(setup,wheel,targetAngle);setup.steer=steering.value;const value=measure(M.calculate(setup));points.push({ack,setup,value,error:Math.abs(value-target),reachable:steering.reached})}
    const best=points.filter(p=>p.reachable).sort((a,b)=>a.error-b.error||Math.abs(a.ack-s.ack)-Math.abs(b.ack-s.ack))[0]??null;
    return {points,best,target,targetAngle,base,baselineReachable:baseSteer.reached,metric};
  }
  const api={leading,solveCamber,solveSteer,at,range,candidates,angles,matchAck};
  root.DriftTuning=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
