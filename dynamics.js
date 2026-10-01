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
  // A prescribed steering manoeuvre, evaluated at every RK4 stage. No drift controller.
  function steeringAt(s,t,program){
    if(!program?.length)return s.steer;
    if(t<=program[0].t)return program[0].steer;
    for(let i=1;i<program.length;i++)if(t<=program[i].t){const a=program[i-1],b=program[i],q=(t-a.t)/(b.t-a.t);return a.steer+(b.steer-a.steer)*q}
    return program.at(-1).steer;
  }
  function step(s,z,c,h,t=0,program=null){const at=time=>program?{...s,steer:steeringAt(s,time,program)}:s;const k1=derivative(at(t),z,c),k2=derivative(at(t+h/2),plus(z,k1,h/2),c),k3=derivative(at(t+h/2),plus(z,k2,h/2),c),k4=derivative(at(t+h),plus(z,k3,h),c);return Object.fromEntries(Object.keys(z).map(k=>[k,z[k]+h*(k1[k]+2*k2[k]+2*k3[k]+k4[k])/6]))}
  function driverReference(t,driver){
    const start=driver.start??.1,end=driver.end??1.6,q=M.clamp((t-start)/(end-start),0,1),blend=q*q*q*(10-15*q+6*q*q),slope=(q<=0||q>=1)?0:30*q*q*(1-q)*(1-q)/(end-start);
    return {beta:driver.startBeta+(driver.targetBeta-driver.startBeta)*blend,betaRate:(driver.targetBeta-driver.startBeta)*slope};
  }
  function driverControl(z,f,t,driver){
    const target=driverReference(t,driver),betaRate=(curvature({...z,...f})*f.speed/3.6-z.r)*M.deg;
    const error=f.beta-target.beta,rateError=betaRate-target.betaRate;
    const feedforward=-4*Math.tanh(f.beta/5);
    const command=M.clamp(f.beta+feedforward+(driver.kp??.3)*error+(driver.kd??.5)*rateError,-55,55),steerRate=M.clamp((command-z.driverSteer)/(driver.tau??.1),-120,120);
    return {target:target.beta,targetRate:target.betaRate,betaRate,command,steerRate};
  }
  function feedbackDerivative(s,z,c,t,driver){
    const f=forces({...s,steer:z.driverSteer},z,c),control=driverControl(z,f,t,driver),ax=f.Fx/mass,ay=f.Fy/mass;
    return {x:z.u*Math.cos(z.psi)-z.v*Math.sin(z.psi),y:z.u*Math.sin(z.psi)+z.v*Math.cos(z.psi),psi:z.r,u:z.r*z.v+ax,v:-z.r*z.u+ay,r:f.moment/inertia,ax:(ax-z.ax)/.15,ay:(ay-z.ay)/.15,driverSteer:control.steerRate};
  }
  function feedbackStep(s,z,c,h,t,driver){const k1=feedbackDerivative(s,z,c,t,driver),k2=feedbackDerivative(s,plus(z,k1,h/2),c,t+h/2,driver),k3=feedbackDerivative(s,plus(z,k2,h/2),c,t+h/2,driver),k4=feedbackDerivative(s,plus(z,k3,h),c,t+h,driver);return Object.fromEntries(Object.keys(z).map(k=>[k,z[k]+h*(k1[k]+2*k2[k]+2*k3[k]+k4[k])/6]))}
  function simulate(s,inputs={},duration=3,dt=1/120,options={}){
    let z=initial(s),reason=null;if(options.driver)z.driverSteer=s.steer;const frames=[],steps=Math.ceil(duration/dt),h=duration/steps;
    for(let i=0;i<=steps;i++){
      const t=i*h,commandedSteer=options.driver?z.driverSteer:steeringAt(s,t,options.program),f=forces({...s,steer:commandedSteer},z,inputs),control=options.driver?driverControl(z,f,t,options.driver):null;
      if(!Number.isFinite(z.x+z.y+z.r+z.u+z.v))throw Error('Non-finite dynamics state');
      if(i>0){if(f.speed<8)reason='Speed ниже 8 km/h';else if(Math.abs(f.beta)>80)reason='Drift angle превысил 80°';else if(Math.abs(f.yaw)>150)reason='Yaw rate превысил 150°/s';else if(f.lift)reason='Разгрузка колеса до нуля';else if(options.stopOnReversal&&Math.abs(s.beta)>.5&&f.beta*Math.sign(s.beta)<=.5)reason='Исходная сторона заноса потеряна'}
      if(i%2===0||i===steps||reason)frames.push({t,...z,...f,commandedSteer,...(control?{driverTarget:control.target,driverCommand:control.command,driverSteerRate:control.steerRate}:{})});
      if(reason||i===steps)break;
      z=options.driver?feedbackStep(s,z,inputs,h,t,options.driver):step(s,z,inputs,h,t,options.program);
    }
    return {frames,reason,duration:frames.at(-1).t,setup:{...s},inputs:{...defaults,...inputs}};
  }
  function frameAt(run,t){let lo=0,hi=run.frames.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(run.frames[mid].t<=t+1e-8)lo=mid;else hi=mid-1}return run.frames[lo]}
  // Path curvature includes changing sideslip; yaw rate / speed is not equivalent.
  function curvature(z){return (z.u*z.Fy-z.v*z.Fx)/(mass*Math.max(1e-9,Math.hypot(z.u,z.v)**3))}
  function outward(reference,current,turn){const heading=reference.psi+Math.atan2(reference.v,reference.u);return -Math.sign(turn)*(-Math.sin(heading)*(current.x-reference.x)+Math.cos(heading)*(current.y-reference.y))}
  // Geometric illustration of one response sample, NOT another dynamics simulation.
  // Freeze beta, speed and path curvature; align the initial velocity with +world X.
  // This displays a maintained arc without pretending that an open-loop drift is stable.
  function projectArc(run,sampleTime=.3,duration=3){
    const sample=frameAt(run,Math.min(sampleTime,run.duration)),k=curvature(sample),speed=sample.speed/3.6;
    const turn=Math.sign(run.setup.yaw)||-Math.sign(run.setup.beta),side=Math.sign(run.setup.beta);
    if(run.reason||sample.t<sampleTime-.01||k*turn<=1e-7||sample.beta*side<=.5)return {valid:false,sample,reason:run.reason||'Первый отклик вышел из исходного поворота'};
    const r=k*speed,frames=[];
    for(let j=0;j<=180;j++){const t=duration*j/180,heading=r*t;frames.push({...sample,t,x:Math.sin(heading)/k,y:(1-Math.cos(heading))/k,psi:heading-sample.beta*M.rad,r,yaw:r*M.deg,sourceYaw:sample.yaw,schematic:true})}
    return {valid:true,frames,duration,reason:null,sample,sampleTime:sample.t,radius:1/k,setup:{...run.setup},inputs:{...run.inputs},schematic:true};
  }
  const api={mass,inertia,defaults,initial,combined,forces,derivative,step,simulate,frameAt,steeringAt,curvature,outward,projectArc,driverReference,driverControl};
  root.DriftDynamics=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
