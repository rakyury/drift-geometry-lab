(function(root){
  'use strict';
  const M=root.DriftModel||(typeof require==='function'?require('./model.js'):null);
  const mass=1250,inertia=2100,front=.55,cg=.52,g=9.81;
  const defaults={drive:.35,brake:0,rearGrip:1,brakeBias:.65};
  const wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
  function initial(s){const speed=s.speed/3.6;return {x:0,y:0,psi:0,u:speed*Math.cos(s.beta*M.rad),v:speed*Math.sin(s.beta*M.rad),r:s.yaw*M.rad,ax:0,ay:speed*Math.cos(s.beta*M.rad)*s.yaw*M.rad}}
  function combined(Fx,Fy,capacity){const scale=Math.min(1,capacity/Math.max(1e-12,Math.hypot(Fx,Fy)));return {Fx:Fx*scale,Fy:Fy*scale}}
  function forces(s,z,inputs={}){
    const c={...defaults,...inputs},speed=Math.hypot(z.u,z.v),setup={...s,speed:speed*3.6,beta:Math.atan2(z.v,z.u)*M.deg,yaw:z.r*M.deg};
    const r=M.calculate(setup,0,{ax:z.ax,ay:z.ay}),L=s.wheelbase/1000,T=s.track/1000,a=L*(1-front),b=L*front;
    const rearBase=(mass*g-r.wheels.reduce((sum,w)=>sum+w.Fz,0))/2;
    const rearTransfer=mass*(1-front)*z.ay*.08/T+r.rates.rearRoll*r.roll*M.rad/T;
    const wheels=[];
    for(let i=0;i<4;i++){
      const isFront=i<2,side=i%2===0?1:-1,x=isFront?a:-b,y=side*T/2,delta=isFront?r.wheels[i].delta*M.rad:0;
      const vx=z.u-z.r*y,vy=z.v+z.r*x,direction=Math.atan2(vy,vx),alpha=wrap(delta-direction),along=vx*Math.cos(delta)+vy*Math.sin(delta);
      const Fz=isFront?r.wheels[i].Fz:M.clamp(rearBase-side*rearTransfer,0,2*rearBase);
      const capacity=isFront?r.wheels[i].capacity:s.mu*c.rearGrip*3372*Math.pow(Fz/3372,.9);
      const lateral=isFront?r.wheels[i].Fy:capacity*Math.sin(1.35*Math.atan(10*alpha));
      // Rear drive is a prescribed force demand, not a throttle/engine model.
      const requestedFx=(isFront?0:c.drive*capacity)-Math.sign(along)*c.brake*mass*g*(isFront?c.brakeBias:1-c.brakeBias)/2;
      const f=combined(requestedFx,lateral,capacity),bodyFx=f.Fx*Math.cos(delta)-f.Fy*Math.sin(delta),bodyFy=f.Fx*Math.sin(delta)+f.Fy*Math.cos(delta);
      wheels.push({name:['LF','RF','LR','RR'][i],x,y,delta:delta*M.deg,direction:direction*M.deg,alpha:alpha*M.deg,Fz,capacity,...f,bodyFx,bodyFy,moment:x*bodyFy-y*bodyFx});
    }
    const aerodynamic=.42*speed;
    const Fx=wheels.reduce((sum,w)=>sum+w.bodyFx,0)-aerodynamic*z.u;
    const Fy=wheels.reduce((sum,w)=>sum+w.bodyFy,0)-aerodynamic*z.v;
    const moment=wheels.reduce((sum,w)=>sum+w.moment,0);
    return {wheels,Fx,Fy,moment,roll:r.roll,speed:speed*3.6,beta:setup.beta,yaw:setup.yaw,lift:wheels.some(w=>w.Fz<1)};
  }
  function derivative(s,z,c){const f=forces(s,z,c),ax=f.Fx/mass,ay=f.Fy/mass;return {x:z.u*Math.cos(z.psi)-z.v*Math.sin(z.psi),y:z.u*Math.sin(z.psi)+z.v*Math.cos(z.psi),psi:z.r,u:z.r*z.v+ax,v:-z.r*z.u+ay,r:f.moment/inertia,ax:(ax-z.ax)/.15,ay:(ay-z.ay)/.15}}
  const plus=(z,d,h)=>Object.fromEntries(Object.keys(z).map(k=>[k,z[k]+d[k]*h]));
  function step(s,z,c,h){const k1=derivative(s,z,c),k2=derivative(s,plus(z,k1,h/2),c),k3=derivative(s,plus(z,k2,h/2),c),k4=derivative(s,plus(z,k3,h),c);return Object.fromEntries(Object.keys(z).map(k=>[k,z[k]+h*(k1[k]+2*k2[k]+2*k3[k]+k4[k])/6]))}
  function simulate(s,inputs={},duration=3,dt=1/120){
    let z=initial(s),reason=null;const frames=[],steps=Math.ceil(duration/dt),h=duration/steps;
    for(let i=0;i<=steps;i++){
      const f=forces(s,z,inputs),t=i*h;
      if(!Number.isFinite(z.x+z.y+z.r+z.u+z.v))throw Error('Non-finite dynamics state');
      if(i>0){if(f.speed<8)reason='Speed ниже 8 km/h';else if(Math.abs(f.beta)>80)reason='Drift angle превысил 80°';else if(Math.abs(f.yaw)>150)reason='Yaw rate превысил 150°/s';else if(f.lift)reason='Разгрузка колеса до нуля'}
      if(i%2===0||i===steps||reason)frames.push({t,...z,...f});
      if(reason||i===steps)break;
      z=step(s,z,inputs,h);
    }
    return {frames,reason,duration:frames.at(-1).t,setup:{...s},inputs:{...defaults,...inputs}};
  }
  function frameAt(run,t){let lo=0,hi=run.frames.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(run.frames[mid].t<=t+1e-8)lo=mid;else hi=mid-1}return run.frames[lo]}
  const api={mass,inertia,defaults,initial,combined,forces,derivative,step,simulate,frameAt};
  root.DriftDynamics=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
