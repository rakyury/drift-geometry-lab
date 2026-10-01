const assert=require('node:assert/strict');
const M=require('../model'),T=require('../tuning-model'),D=require('../dynamics'),S=require('../scenario-model');
const close=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} (tol ${t})`);
const input={drive:.7,rearGrip:.6},s={...M.defaults};
const mirror=s=>({...s,steer:-s.steer,beta:-s.beta,yaw:-s.yaw});

// The diagram and numeric cards consume the SAME load, patch and zero-camber reference.
const contactSetup={...s,steer:50,camber:-4.25,caster:4};
const unchanged=JSON.stringify(contactSetup),equal=T.contactView(contactSetup),actual=T.contactView(contactSetup,false);
assert.equal(JSON.stringify(contactSetup),unchanged);
assert.ok(Math.abs(equal.wheels[0].camber)<Math.abs(equal.wheels[1].camber));
assert.ok(equal.wheels[0].displayArea>equal.wheels[1].displayArea);
assert.ok(actual.wheels[0].displayArea<actual.wheels[1].displayArea);
for(let i=0;i<2;i++){
  const e=equal.wheels[i],a=actual.wheels[i];close(e.displayLoad,3372);close(a.displayLoad,a.Fz);
  close(e.Fz,a.Fz);close(e.Fy,a.Fy);close(e.displayArea,e.displayPatch.areaCm2);
  close(a.displayArea,a.area);close(e.displayRetention,100*e.displayArea/e.referencePatch.areaCm2);
  assert.ok(e.displayRetention<=100&&e.displayRetention>=0);
}

// Preserve each type without silently labelling the displayed order as a ranking.
const ranked=[-4.5,-3,-6,0,3,6].map(ack=>({setup:{...s,ack}}));
assert.deepEqual(T.selectAckTypes(ranked).map(r=>r.setup.ack),[-4.5,0,3]);
assert.deepEqual(T.selectAckTypes(ranked.slice(0,3)).map(r=>r.setup.ack),[-4.5]);
assert.equal(T.ackType({...s,ack:3,rackSide:-1}),'Reverse');
assert.equal(T.ackType({...s,ack:-3,rackSide:-1}),'Positive');

// Arc illustration is circular geometry from one sample, never a new dynamics prediction.
const arcs=[-6,0,6].map(ack=>D.projectArc(D.simulate({...s,ack},input,.3)));
assert.ok(arcs.every(a=>a.valid&&a.schematic));
assert.ok(arcs[0].radius<arcs[1].radius&&arcs[1].radius<arcs[2].radius);
assert.ok(Math.abs(arcs[0].sample.beta)>Math.abs(arcs[1].sample.beta));
assert.ok(Math.abs(arcs[2].sample.beta)<Math.abs(arcs[1].sample.beta));
for(const a of arcs){
  const r=a.radius;close(a.frames[0].x,0);close(a.frames[0].y,0);
  a.frames.forEach(z=>{close(z.beta,a.sample.beta);close(z.speed,a.sample.speed);close(z.x*z.x+(z.y-r)**2,r*r,1e-6);close(z.r,z.speed/3.6/r);});
  const z=a.frames[90],next=a.frames[91],observedHeading=Math.atan2(next.y-z.y,next.x-z.x);
  close(observedHeading,z.psi+z.beta*M.rad+z.r*(next.t-z.t)/2,1e-6);
}
const mirroredArc=D.projectArc(D.simulate(mirror(s),input,.3)),normalArc=arcs[1];
close(mirroredArc.radius,-normalArc.radius);
normalArc.frames.forEach((z,i)=>{close(z.x,mirroredArc.frames[i].x);close(z.y,-mirroredArc.frames[i].y)});
const stopped=D.simulate({...s,ack:9},input,3,1/120,{stopOnReversal:true});
assert.equal(D.projectArc(stopped).valid,false);

// Feedback must react to state and obey actuator limits, not simply replay a timer.
const p=S.presets.transition,setup={...s,beta:-p.angle,speed:p.speed,yaw:p.speed/3.6/p.radius*M.deg,steer:-p.steer};
const driver={startBeta:setup.beta,targetBeta:p.angle};
close(D.driverReference(0,driver).beta,-22);close(D.driverReference(2,driver).beta,22);
close(D.driverReference(0,driver).betaRate,0);close(D.driverReference(2,driver).betaRate,0);
const baseline=S.evaluate(setup,{kind:'transition',angle:p.angle,radius:p.radius});
const reflected=S.evaluate(mirror(setup),{kind:'transition',angle:p.angle,radius:p.radius});
assert.equal(baseline.run.reason,null);
assert.ok(baseline.firstZero<baseline.reachedAt);
const fine=D.simulate(setup,input,2,1/480,{driver});
const a=baseline.run.frames.at(-1),b=fine.frames.at(-1),c=reflected.run.frames.at(-1);
close(a.x,b.x,.003);close(a.y,b.y,.003);close(a.beta,b.beta,.02);close(a.commandedSteer,b.commandedSteer,.05);
close(a.x,c.x);close(a.y,-c.y);close(a.beta,-c.beta);close(a.commandedSteer,-c.commandedSteer);
const plus=S.evaluate({...setup,ack:9},{kind:'transition',angle:p.angle,radius:p.radius});
assert.ok(Math.abs(a.commandedSteer-plus.run.frames.at(-1).commandedSteer)>.1);
const z={...D.initial(setup),driverSteer:setup.steer},forces=D.forces(setup,z,input);
assert.notEqual(D.driverControl(z,forces,.5,driver).command,D.driverControl(z,{...forces,beta:forces.beta+3},.5,driver).command);

// Regression of the reported wrong-way wheels: timer +20 while the old-side drift persists.
const regression={...setup,ack:-9,caster:4,camber:-3,kpi:10};
const timed=S.evaluate(regression,{kind:'transition',angle:22,driver:'program'});
const corrected=S.evaluate(regression,{kind:'transition',angle:22,driver:'feedback'});
const ta=D.frameAt(timed.run,1.68),fb=D.frameAt(corrected.run,1.68);
assert.ok(ta.beta<0&&ta.commandedSteer>0);assert.equal(timed.ok,false);
assert.ok(fb.beta>0&&fb.commandedSteer>0);

let cases=0;
for(const ack of [-9,0,9])for(const caster of [4,6.5])for(const kpi of [8,12])for(const camber of [-5,-3]){
  const q=S.evaluate({...setup,ack,caster,kpi,camber},{kind:'transition',angle:22});cases++;
  assert.ok(Number.isFinite(q.score+q.endBetaRate));
  q.run.frames.forEach((z,i,frames)=>{
    assert.ok(Number.isFinite(z.x+z.y+z.beta+z.commandedSteer));
    assert.ok(Math.abs(z.commandedSteer)<=55.000001&&Math.abs(z.driverCommand)<=55.000001);
    assert.ok(Math.abs(z.driverSteerRate)<=120.000001);
    if(i)assert.ok(Math.abs((z.commandedSteer-frames[i-1].commandedSteer)/(z.t-frames[i-1].t))<=120.000001);
    z.wheels.forEach(w=>assert.ok(Math.hypot(w.Fx,w.Fy)<=w.capacity+1e-6));
  });
}
console.log(`PASS: consistent contact views; three Ackermann types; circular arc geometry and mirrored direction; feedback response, bounds, mirror and convergence; wrong-way program regression; ${cases} geometry/driver combinations.`);
