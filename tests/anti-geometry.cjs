const assert=require('node:assert/strict');
const M=require('../model'),D=require('../dynamics'),T=require('../tuning-model');
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const s={...M.defaults,beta:0,yaw:0,steer:0,camber:0,caster:0,kpi:0,longitudinalG:-.8};
const base=M.pitchResponse(s),half=M.pitchResponse({...s,frontAntiDive:50}),full=M.pitchResponse({...s,frontAntiDive:100}),over=M.pitchResponse({...s,frontAntiDive:150});
close(-base.transfer,1250*9.81*.8*.52/2.7);
close(half.frontTravel,base.frontTravel/2);close(full.frontTravel,0);assert.ok(over.frontTravel<0);
assert.ok(full.pitch<0); // Rear still extends: 100% front anti-dive does not eliminate whole-body pitch.
for(const p of [base,half,full,over]){
 close(p.frontLoad,base.frontLoad);close(p.rearLoad,base.rearLoad);close(p.frontLoad+p.rearLoad,1250*9.81);
 close(p.frontElastic+p.frontGeometry,-p.limitedTransfer);close(p.rearElastic+p.rearGeometry,p.limitedTransfer);
 close(p.rearTravel,base.rearTravel);
}
const lowerBias=M.pitchResponse({...s,frontAntiDive:100,frontBrakeBias:32.5});
close(lowerBias.frontEffective,50);close(lowerBias.frontTravel,base.frontTravel/2);close(lowerBias.frontRatio,full.frontRatio);
close(M.pitchResponse({...s,frontAntiDive:100,frontBrakeBias:0}).frontTravel,base.frontTravel);
const drive={...s,longitudinalG:.5},driveBase=M.pitchResponse(drive),driveFull=M.pitchResponse({...drive,rearAntiSquat:100,frontAntiDive:100});
close(driveFull.rearTravel,0);close(driveFull.frontTravel,driveBase.frontTravel);assert.ok(driveFull.pitch>0);
close(driveFull.frontGeometry,0);close(M.pitchResponse({...s,rearAntiSquat:100}).rearGeometry,0);
const coast=M.pitchResponse({...s,longitudinalG:0,frontAntiDive:150,rearAntiSquat:150});
close(coast.pitch,0);close(coast.frontGeometry,0);close(coast.rearGeometry,0);
close(M.pitchResponse({...drive,rearWheelRate:110}).rearTravel,driveBase.rearTravel/2);
close(M.suspensionRates({...drive,rearWheelRate:110}).rearRoll,M.suspensionRates(drive).rearRoll);

const toe={...s,bumpToe:.2,reboundToe:-.2},zeroToe=M.calculate(toe),antiToe=M.calculate({...toe,frontAntiDive:100});
assert.ok(zeroToe.wheels[0].toeChange>0);close(antiToe.wheels[0].toeChange,0);
close(zeroToe.wheels[0].bumpDelta,-zeroToe.wheels[1].bumpDelta);
close(zeroToe.wheels[0].Fz,antiToe.wheels[0].Fz);
const referenceContact=T.contactView({...s,frontAntiDive:0},false),antiContact=T.contactView({...s,frontAntiDive:100},false);
referenceContact.wheels.forEach((w,i)=>close(w.area,antiContact.wheels[i].area)); // No fictitious contact/grip multiplier.
const manual=M.calculate({...toe,wheelTravelLF:7,bumpFromRoll:0,frontAntiDive:50});
close(manual.wheels[0].requestedTravel,7+half.frontTravel);
const limit=M.pitchResponse({...s,longitudinalG:1,rearWheelRate:10,rearAntiSquat:0});assert.ok(limit.travelLimited);

const moving={...M.defaults,bumpToe:.2,reboundToe:-.1,longitudinalG:0},inputs={drive:0,brake:.3,rearGrip:.6};
const a=D.simulate(moving,inputs,.6),b=D.simulate({...moving,frontAntiDive:100},inputs,.6),last=b.frames.at(-1);
assert.ok(last.frontBrakeTarget>0&&last.pitch.frontGeometry>0);
assert.ok(Math.abs(a.frames.at(-1).wheels[0].delta-last.wheels[0].delta)>.01);
const mirrored=D.simulate({...moving,frontAntiDive:100,beta:-moving.beta,steer:-moving.steer,yaw:-moving.yaw},inputs,.6).frames.at(-1);
close(last.x,mirrored.x,1e-7);close(last.y,-mirrored.y,1e-7);close(last.pitch.frontTravel,mirrored.pitch.frontTravel,1e-7);
const fine=D.simulate({...moving,frontAntiDive:100},inputs,.6,1/240).frames.at(-1);
close(last.x,fine.x,.002);close(last.beta,fine.beta,.02);close(last.pitch.frontTravel,fine.pitch.frontTravel,.01);
const drag=D.simulate({...moving,frontAntiDive:100,bumpToe:0,reboundToe:0},{drive:0,brake:0},.6).frames.at(-1);
close(drag.pitch.frontGeometry,0); // Aero and lateral-force deceleration are not a front brake input.
const rear0=D.simulate({...moving,bumpToe:0,reboundToe:0},{drive:.5,brake:0},.6).frames.at(-1);
const rear100=D.simulate({...moving,bumpToe:0,reboundToe:0,rearAntiSquat:100},{drive:.5,brake:0},.6).frames.at(-1);
assert.ok(rear100.pitch.rearGeometry>0);assert.ok(rear100.pitch.rearTravel<rear0.pitch.rearTravel);
close(rear0.beta,rear100.beta);close(rear0.x,rear100.x); // No invented rear toe or grip.
const prescribed=D.simulate({...moving,longitudinalG:1},inputs,.6).frames.at(-1);close(prescribed.x,a.frames.at(-1).x);
for(const frontAntiDive of [0,50,100,150])for(const rearAntiSquat of [0,100,150])for(const longitudinalG of [-1,0,1]){
 const p=M.pitchResponse({...moving,frontAntiDive,rearAntiSquat,longitudinalG});
 close(p.frontLoad+p.rearLoad,1250*9.81);assert.ok(Number.isFinite(p.frontTravel+p.rearTravel+p.pitch));
}
console.log('PASS: anti percentages and bias; load-transfer conservation; 100%/over-100% and opposite axle; spring rates; bump-steer coupling; no fake grip; force-based dynamic activation; mirror/convergence; 36 static cases.');
