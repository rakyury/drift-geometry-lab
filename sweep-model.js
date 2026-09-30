(function(root){
  'use strict';
  const M=root.DriftModel||(typeof require==='function'?require('./model.js'):null);
  function leading(s){return Math.abs(s.beta)<.5?null:s.beta<0?1:0}
  function sample(s,angle,referenceAreas){
    const setup={...s,steer:angle},r=M.calculate(setup);
    return {angle,roll:r.roll,overDemand:r.overDemand,lift:r.lift,wheels:r.wheels.map((w,i)=>{
      const patch=M.contactPatch(setup,w),zeroArea=referenceAreas?.[i]??M.contactPatch(setup,{...w,camber:0}).areaCm2;
      return {...w,patch,area:patch.areaCm2,retention:zeroArea>1e-8?patch.areaCm2/zeroArea*100:null,force:w.Fy/1000,moment:w.yawMoment,slip:w.alpha};
    })};
  }
  function build(s,limit){
    const end=M.clamp(Math.abs(limit),1,55),n=Math.ceil(end*4),first=sample(s,-end);
    const ref=first.wheels.map(w=>M.contactPatch(s,{...w,camber:0}).areaCm2);
    return {state:{...s},limit:end,leading:leading(s),points:Array.from({length:n+1},(_,i)=>sample(s,-end+2*end*i/n,ref))};
  }
  function summarize(curve,from,to){
    const lo=M.clamp(Math.min(from,to),-curve.limit,curve.limit),hi=M.clamp(Math.max(from,to),-curve.limit,curve.limit);
    const points=curve.points.filter(p=>p.angle>lo+1e-8&&p.angle<hi-1e-8);
    points.unshift(sample(curve.state,lo));if(hi!==lo)points.push(sample(curve.state,hi));
    return [0,1].map(i=>{
      const span=key=>{const values=points.filter(p=>Number.isFinite(p.wheels[i][key]));if(!values.length)return null;
        const min=values.reduce((a,b)=>a.wheels[i][key]<=b.wheels[i][key]?a:b),max=values.reduce((a,b)=>a.wheels[i][key]>=b.wheels[i][key]?a:b);
        return {min:min.wheels[i][key],max:max.wheels[i][key],atMin:min.angle,atMax:max.angle};};
      const area=span('area'),mean=points.reduce((sum,p)=>sum+p.wheels[i].area,0)/points.length;
      return {name:i?'RF':'LF',camber:span('camber'),area,retention:span('retention'),variation:mean>1e-8?(area.max-area.min)/mean*100:null,count:points.length};
    });
  }
  const api={leading,sample,build,summarize};root.DriftSweep=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
