const assert=require('node:assert/strict'),M=require('../model');
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const s={...M.defaults},forces=[1000,3000];
// Signed force projection: equal forces cancel, equal magnitudes of opposite
// direction do not. Mirroring the physical manoeuvre preserves vertical sum.
const j=M.jackingEstimate({...s,rc:200},forces);
near(j.vertical[0],-250);near(j.vertical[1],750);near(j.net,500);
near(M.jackingEstimate({...s,rc:200},[-3000,-1000]).net,j.net);
near(M.jackingEstimate({...s,rc:200},[2000,2000]).net,0);
near(M.jackingEstimate({...s,rc:200},[-2000,2000]).net,1000);
near(M.jackingEstimate({...s,rc:0},forces).net,0);
near(M.jackingEstimate({...s,rc:-50},forces).net,-125);
near(M.jackingEstimate({...s,rc:100},forces).net,j.net/2);
near(M.jackingEstimate({...s,rc:200,frontBarRate:50},forces).heave,j.heave);
near(M.jackingEstimate({...s,rc:200,springRate:s.springRate*2},forces).heave,j.heave/2);
const low=M.rollAnalysis({...s,rc:0}),high=M.rollAnalysis({...s,rc:200});
assert.ok(high.result.roll<low.result.roll);
assert.ok(high.result.geom>low.result.geom);
assert.ok(high.result.elastic<low.result.elastic);
assert.ok(high.result.transfer>low.result.transfer);
near(high.total,low.total);
// Conservation and mirror symmetry over geometry/stiffness/turn directions.
let cases=0;
for(const rc of [-50,0,60,150,200])for(const yaw of [-25,0,25])for(const springRate of [4,8,20]){
 const setup={...s,rc,yaw,springRate},a=M.rollAnalysis(setup),r=a.result;
 near(a.total,1250*r.ay*.52/(s.track/1000));
 near(r.geom+r.elastic,r.transfer);
 near(r.wheels[0].Fz+r.wheels[1].Fz,r.pitch.frontLoad);
 const mirror=M.rollAnalysis({...setup,yaw:-yaw,beta:-setup.beta,steer:-setup.steer});
 near(mirror.result.roll,-r.roll);near(mirror.total,-a.total);
 near(mirror.jacking.net,a.jacking.net,1e-7);
 for(const value of [a.total,a.jacking.net,a.jacking.heave,r.roll])assert.ok(Number.isFinite(value));
 // Diagnostic jacking does not silently change suspension travel/tyre forces.
 assert.deepEqual(M.calculate(setup),r);
 cases++;
}
console.log(`Roll / Jacking: projection, conservation, limits and ${cases} mirrored scenarios passed.`);
