const assert=require('node:assert/strict');
const M=require('../model.js'),T=require('../tuning-model.js'),D=require('../dynamics.js');
const close=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} (±${t})`);
const s={...M.defaults};

for(const steer of [-50,-30,0,30,50]){
  const r=M.calculate({...s,steer,caster:0,kpi:0,yaw:0});
  r.wheels.forEach(w=>close(w.camber,s.camber));
}
let previous=-3;
for(const [caster,expected] of [[4,-3.34149],[5.5,-4.08974],[6.5,-4.59004]]){
  const setup={...s,caster,steer:-30,yaw:0};const sol=T.solveCamber(setup,1,0);
  assert.ok(sol.reached);close(sol.value,expected,1e-4);close(M.calculate({...setup,camber:sol.value}).wheels[1].camber,0,1e-6);
  assert.ok(sol.value<previous);previous=sol.value;
}
const infeasible=T.solveCamber({...s,caster:6.5,kpi:12,steer:-50,yaw:0},1,0);
assert.equal(infeasible.reached,false);close(infeasible.value,-5);
for(const rackSide of [-1,1])for(const ack of [-9,-1.5,0,1.5,9]){
  const setup={...s,rackSide,ack,bumpToe:.15,reboundToe:-.1};
  const sol=T.solveSteer(setup,1,-35);assert.ok(sol.reached);close(M.calculate({...setup,steer:sol.value}).wheels[1].delta,-35,1e-6);
}
const samples=T.range(s,-31.7,-25.3,1,'leading',2).points;
close(samples[0].steer,-31.7);close(samples.at(-1).steer,-25.3);
assert.equal(T.candidates(s).length,162);
const shortTrail=M.calculate({...s,trail:10}),longTrail=M.calculate({...s,trail:60});
for(let i=0;i<2;i++){close(shortTrail.wheels[i].camber,longTrail.wheels[i].camber);close(shortTrail.wheels[i].delta,longTrail.wheels[i].delta);close(shortTrail.wheels[i].Fy,longTrail.wheels[i].Fy)}
assert.ok(Math.abs(shortTrail.torque-longTrail.torque)>1);
for(const metric of ['moment','torque','force']){
  const matched=T.matchAck(s,s,1,metric);assert.ok(matched.baselineReachable);close(matched.best.ack,s.ack);close(matched.best.value,matched.target,1e-6);
  matched.points.filter(p=>p.reachable).forEach(p=>close(M.calculate(p.setup).wheels[1].delta,matched.targetAngle,1e-6));
}

const inputs={drive:.7,rearGrip:.6,brake:.05},z=D.initial(s),forces=D.forces(s,z,inputs);
close(forces.wheels.reduce((v,w)=>v+w.Fz,0),1250*9.81,1e-8);
forces.wheels.forEach(w=>assert.ok(Math.hypot(w.Fx,w.Fy)<=w.capacity+1e-8));
const mirrored={...s,beta:-s.beta,yaw:-s.yaw,steer:-s.steer};
const run=D.simulate(s,inputs,1),mirror=D.simulate(mirrored,inputs,1);
const a=run.frames.at(-1),b=mirror.frames.at(-1);
close(a.x,b.x,1e-7);close(a.y,-b.y,1e-7);close(a.psi,-b.psi,1e-7);close(a.beta,-b.beta,1e-7);close(a.speed,b.speed,1e-7);
assert.deepEqual(D.simulate(s,inputs,1),run);
const fine=D.simulate(s,inputs,1,1/240).frames.at(-1);
close(a.x,fine.x,.002);close(a.y,fine.y,.002);close(a.psi,fine.psi,.0003);

const straight={...s,camber:0,caster:0,kpi:0,steer:0,beta:0,yaw:0};
const coast=D.simulate(straight,{drive:0},3),brake=D.simulate(straight,{drive:0,brake:.3},3),drive=D.simulate(straight,{drive:.5},3);
coast.frames.forEach(z=>{close(z.y,0);close(z.psi,0);close(z.r,0);assert.ok(z.speed<=s.speed+1e-8)});
assert.ok(brake.frames.at(-1).speed<coast.frames.at(-1).speed);
assert.ok(drive.frames.at(-1).speed>coast.frames.at(-1).speed);
const baseline=D.simulate(s,inputs,1),other={...s,ack:6};other.steer=T.solveSteer(other,1,M.calculate(s).wheels[1].delta).value;
close(M.calculate(other).wheels[1].delta,M.calculate(s).wheels[1].delta,1e-6);
assert.ok(Math.abs(M.calculate(other).wheels[0].delta-M.calculate(s).wheels[0].delta)>.5);
const alternative=D.simulate(other,inputs,1).frames.at(-1),base=baseline.frames.at(-1);
assert.ok(Math.hypot(alternative.x-base.x,alternative.y-base.y)>.01);

for(const ack of [-9,0,9])for(const beta of [-50,-25,25,50]){
  const run=D.simulate({...s,ack,beta,yaw:beta<0?18:-18,steer:Math.sign(beta)*35},inputs);
  assert.ok(run.duration<=3);run.frames.forEach(z=>{
    assert.ok(Number.isFinite(z.x+z.y+z.psi+z.speed));
    close(z.wheels.reduce((v,w)=>v+w.Fz,0),1250*9.81,1e-7);
    z.wheels.forEach(w=>assert.ok(w.Fz>=0&&Math.hypot(w.Fx,w.Fy)<=w.capacity+1e-7));
  });
}
console.log('PASS: camber compensation and limits; steering lock; range endpoints; mirrored dynamics; force/load bounds; braking/coasting; numerical convergence; independent Ackermann paths.');
