const assert=require('node:assert/strict');
const M=require('../model'),T=require('../tuning-model'),D=require('../dynamics'),S=require('../scenario-model');
const close=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const s={...M.defaults},inputs={drive:.7,rearGrip:.6};
const zero=D.simulate(s,inputs,.6),positive=D.simulate({...s,ack:6},inputs,.6),reverse=D.simulate({...s,ack:-6},inputs,.6);
const a=zero.frames.at(-1),b=positive.frames.at(-1),c=reverse.frames.at(-1);
// Regression for the published example, not a universal rule for all tyre operating points.
assert.ok(Math.abs(b.beta)<Math.abs(a.beta)&&Math.abs(c.beta)>Math.abs(a.beta));
assert.ok(1/D.curvature(b)>1/D.curvature(a)&&1/D.curvature(c)<1/D.curvature(a));
assert.ok(D.outward(a,b,s.yaw)>0&&D.outward(a,c,s.yaw)<0);
for(const run of [zero,positive,reverse])run.frames.forEach(z=>close(z.commandedSteer,s.steer));
const isolated={...s,ack:6};isolated.steer=T.solveSteer(isolated,1,-28).value;
assert.ok(Math.abs(isolated.steer-s.steer)>.1);
assert.ok(Math.abs(D.simulate(isolated,inputs,.6).frames.at(-1).beta)>Math.abs(a.beta));
const loss=D.simulate({...s,ack:9},inputs,3,1/120,{stopOnReversal:true});
assert.equal(loss.reason,'Исходная сторона заноса потеряна');assert.ok(loss.duration<3);

// Path curvature follows actual velocity/acceleration, including sideslip changes.
const z={u:10,v:0,Fx:0,Fy:D.mass*2};close(D.curvature(z),1/50);
close(D.curvature({...z,v:10,Fx:D.mass*2}),0);
close(D.outward({x:0,y:0,psi:0,u:10,v:0},{x:0,y:-2},1),2);

const offsets=Array.from({length:13},(_,i)=>-9+1.5*i),grid=T.candidates(s,offsets);
assert.equal(grid.length,2106);assert.deepEqual([...new Set(grid.map(s=>s.ack))],offsets);
assert.ok(grid.every(v=>v.trail===s.trail&&v.steer===s.steer));
const p=S.presets.transition,setup={...s,beta:-p.angle,speed:p.speed,yaw:p.speed/3.6/p.radius*M.deg,steer:-p.steer};
const config={kind:'transition',radius:p.radius,angle:p.angle};
const program=S.program(setup,config);
close(D.steeringAt(setup,.05,program),-24);close(D.steeringAt(setup,1.1,program),19);
const transition=S.evaluate(setup,config);
assert.equal(transition.ok,true);assert.ok(transition.firstZero<transition.reachedAt);
assert.ok(transition.reachedAt<1.6);assert.ok(Math.abs(transition.endAngle-p.angle)<10);
const mirror={...setup,beta:-setup.beta,yaw:-setup.yaw,steer:-setup.steer};
const mirrored=S.evaluate(mirror,config),last=transition.run.frames.at(-1),other=mirrored.run.frames.at(-1);
close(last.x,other.x,1e-5);close(last.y,-other.y,1e-5);close(last.beta,-other.beta,1e-5);
const fine=D.simulate(setup,inputs,2,1/480,{program}).frames.at(-1);
close(last.x,fine.x,.01);close(last.y,fine.y,.01);close(last.beta,fine.beta,.04);
assert.equal(S.evaluate({...setup,ack:6},config).ok,false);
for(const [kind,p] of Object.entries(S.presets)){
  if(kind==='contact')continue;
  const q=S.evaluate({...s,beta:-p.angle,steer:-p.steer,speed:p.speed,yaw:p.speed/3.6/p.radius*M.deg},{kind,radius:p.radius,angle:p.angle});
  assert.ok(Number.isFinite(q.score));
  q.run.frames.forEach(z=>{assert.ok(Number.isFinite(z.x+z.y+z.beta));z.wheels.forEach(w=>assert.ok(Math.hypot(w.Fx,w.Fy)<=w.capacity+1e-6))});
}

const area=(camber,Fz)=>M.contactPatch(s,{camber,Fz}).areaCm2;
assert.ok(area(.5,3372)>area(-4.7,3372));
assert.ok(area(-4.7,4750)>area(.5,2000));
close(area(4.7,3372),area(-4.7,3372),1e-6);
console.log('PASS: fixed-input Ackermann direction; isolated-wheel distinction; path curvature; side-loss stop; 2106 candidates; real steering transition and mirrored/converged dynamics; contact-load comparison.');
