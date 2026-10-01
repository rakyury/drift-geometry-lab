(function(root){'use strict';
const rad=Math.PI/180,deg=180/Math.PI,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const defaults={ack:0,rackSide:1,steeringArm:100,tyreWidth:235,tyreAspect:45,rimDiameter:17,tyrePressure:2.2,tyreCompliance:1,steer:-28,beta:-32,speed:65,yaw:18,camber:-4,caster:5.5,kpi:10,scrub:25,rc:60,trail:35,damping:7,mu:1.05,wheelbase:2700,track:1600,springRate:8,motionRatio:.95,frontBarRate:15,wheelTravelLF:0,wheelTravelRF:0,bumpToe:0,reboundToe:0,bumpFromRoll:1};
const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),norm=a=>mul(a,1/Math.hypot(...a));
function rotate(v,k,q){return add(add(mul(v,Math.cos(q)),mul(cross(k,v),Math.sin(q))),mul(k,dot(k,v)*(1-Math.cos(q))))}
// Ideal steering-arm convergence model. Offset is transverse, positive outward.
// rackSide +1: arm in front of axle; -1: arm behind axle. Zero is parallel by definition.
function angles(s){const t=Math.tan(s.steer*rad),p=(s.rackSide??1)*s.ack/(s.steeringArm??100);return [1,-1].map(side=>Math.atan2(t,1-side*p*t)*deg)}
function wheelGeometry(s,side,delta,roll=0){
 const R=tyreRadius(s)/1000,g=s.camber*rad,k=norm([-Math.tan(s.caster*rad),-side*Math.tan(s.kpi*rad),1]),n0=[0,side*Math.cos(g),-Math.sin(g)];
 const trail=s.trail/1000,S=[trail,-side*s.scrub/1000,0];
 const W0=[0,-R*n0[1]*n0[2]/Math.cos(g),R*Math.cos(g)];
 const heading=q=>{const n=rotate(n0,k,q);return Math.atan2(-side*n[0],side*n[1])};
 let q=delta;for(let i=0;i<6;i++){const dh=(heading(q+1e-5)-heading(q-1e-5))/2e-5;q-=clamp((heading(q)-delta)/dh,-.2,.2)}
 const dqdd=1/((heading(q+1e-5)-heading(q-1e-5))/2e-5),n=rotate(n0,k,q),W=add(S,rotate(sub(W0,S),k,q));
 const C=add(W,mul(sub([0,0,1],mul(n,n[2])),-R/Math.sqrt(1-n[2]*n[2]))),lever=sub(C,S);
 const camberNoRoll=Math.atan2(-n[2],Math.hypot(n[0],n[1]))*deg,nr=rotate(n,[1,0,0],roll*.75),camber=Math.atan2(-nr[2],Math.hypot(nr[0],nr[1]))*deg;
 const lateral=[-Math.sin(delta),Math.cos(delta),0],longitudinal=[Math.cos(delta),Math.sin(delta),0];
 return {q,dqdd,k,n,C,W,S,lever,camber,camberNoRoll,steeringCamberDelta:camberNoRoll-s.camber,rollCamberDelta:camber-camberNoRoll,trail,mechTrail:-dot(k,cross(lever,lateral)),scrubLever:dot(k,cross(lever,longitudinal)),jack:-C[2]};
}
// Motion ratio = spring travel / wheel travel. Rates at the axle include both springs.
function suspensionRates(s){const springNmm=(s.springRate??8)*9.80665,motionRatio=s.motionRatio??.95,wheelNmm=springNmm*motionRatio**2,T=s.track/1000,springRoll=wheelNmm*1000*T*T/2,barRoll=(s.frontBarRate??15)*1000,frontRoll=springRoll+barRoll,rearRoll=65000;return {springNmm,motionRatio,wheelNmm,springRoll,barRoll,frontRoll,rearRoll,totalRoll:frontRoll+rearRoll,frontFraction:frontRoll/(frontRoll+rearRoll)}}
// Fitted toe curve: positive toe is toe-in on either wheel, independent of steering sign.
// Inputs are toe changes measured at +25 mm bump and -25 mm rebound, not hardpoints.
function bumpToeAt(s,z){const a=s.bumpToe??0,b=s.reboundToe??0;return (a-b)*z/50+(a+b)*z*z/1250}
function bumpKinematics(s,roll){return [1,-1].map((side,i)=>{const manualTravel=(i?s.wheelTravelRF:s.wheelTravelLF)??0,rollTravel=(s.bumpFromRoll??1)?-side*s.track/2*Math.tan(roll):0,requestedTravel=manualTravel+rollTravel,travel=clamp(requestedTravel,-75,75),toeChange=bumpToeAt(s,travel);return {manualTravel,rollTravel,requestedTravel,travel,toeChange,bumpDelta:-side*toeChange,toeMm:2*tyreRadius(s)*Math.sin(toeChange*rad),travelLimited:Math.abs(requestedTravel)>75}})}
function calculate(s,shock=0,motion=null){
 const rates=suspensionRates(s),m=1250,front=.55,cg=.52,K=rates.totalRoll,L=s.wheelbase/1000,T=s.track/1000,a=L*(1-front),u=s.speed/3.6*Math.cos(s.beta*rad),v=s.speed/3.6*Math.sin(s.beta*rad),r=s.yaw*rad,ay=motion?.ay??u*r,rc=s.rc/1000,rollAxis=front*rc+(1-front)*.08;
 const roll=m*ay*(cg-rollAxis)/K,geom=m*front*ay*rc/T,elastic=rates.frontRoll*roll/T,transfer=geom+elastic,base=clamp(m*9.81*front-m*(motion?.ax??0)*cg/L,0,m*9.81)/2,bump=bumpKinematics(s,roll),baseDeltas=angles(s),deltas=baseDeltas.map((d,i)=>d+bump[i].bumpDelta),ap=angles({...s,steer:s.steer+.001}),am=angles({...s,steer:s.steer-.001});
 const wheels=[1,-1].map((side,i)=>{
  const delta=deltas[i]*rad,y=side*T/2,vx=u-r*y,vy=v+r*a,direction=Math.atan2(vy,vx),alpha=delta-direction,Fz=clamp(base-side*transfer,0,base*2),g=wheelGeometry(s,side,delta,roll);
  const capacity=s.mu*3372*Math.pow(Fz/3372,.9)/(1+Math.pow(g.camber/18,2)),effectiveAlpha=alpha+side*g.camber*rad*.08;
  const Fy=capacity*Math.sin(1.35*Math.atan(10*effectiveAlpha)),Fx=i===1?shock:0,tp=.045*Math.exp(-Math.pow(alpha/(12*rad),2));
  const Fl=[-Math.sin(delta)*Fy,Math.cos(delta)*Fy,0],Fxv=[Math.cos(delta)*Fx,Math.sin(delta)*Fx,0];
  const mt=dot(g.k,cross(g.lever,Fl)),mp=-tp*Fy*g.k[2],mj=dot(g.k,cross(g.lever,[0,0,Fz])),mx=dot(g.k,cross(g.lever,Fxv)),ratio=g.dqdd*(ap[i]-am[i])/.002;
  const bodyFx=Fl[0]+Fxv[0],bodyFy=Fl[1]+Fxv[1],yawMoment=a*bodyFy-y*bodyFx,pathLong=bodyFx*Math.cos(s.beta*rad)+bodyFy*Math.sin(s.beta*rad),pathSide=-bodyFx*Math.sin(s.beta*rad)+bodyFy*Math.cos(s.beta*rad);
  return {side,name:i?'RF':'LF',baseDelta:baseDeltas[i],...bump[i],delta:deltas[i],direction:direction*deg,alpha:alpha*deg,Fz,Fy,Fx,bodyFx,bodyFy,yawMoment,pathLong,pathSide,capacity,tp,ratio,mt:mt*ratio,mp:mp*ratio,mj:mj*ratio,mx:mx*ratio,torque:(mt+mp+mj+mx)*ratio,...g};
 });
 const sum=k=>wheels.reduce((v,w)=>v+w[k],0),torque=sum('torque'),weightedSlip=wheels.reduce((v,w)=>v+Math.abs(w.alpha)*w.Fz,0)/(2*base);
 return {wheels,rates,u,v,r,ay,roll:roll*deg,geom,elastic,transfer,torque,trail:s.trail,weightedSlip,mt:sum('mt'),mp:sum('mp'),mj:sum('mj'),mx:sum('mx'),kick:wheels[1].scrubLever*wheels[1].ratio*1000,lift:Math.abs(transfer)>=base,overDemand:Math.abs(ay)>s.mu*9.81};
}

function tyreRadius(s){return ((s.rimDiameter??17)*25.4+2*(s.tyreWidth??235)*(s.tyreAspect??45)/100)/2}
const patchBasisCache=new Map();
// Educational elastic foundation: q = K * max(0, z - x²/(2R) - y²/(2Rc) + tilt*y).
// Integrate longitudinally analytically and transversely by midpoint quadrature.
function patchIntegral(z,half,R,Rc,tilt,K=1){
 let force=0,area=0,inner=0,moment=0;const n=80,dy=2*half/n;
 for(let i=0;i<n;i++){const y=-half+(i+.5)*dy,h=z-y*y/(2*Rc)+tilt*y;if(h<=0)continue;const a=Math.sqrt(2*R*h),stripForce=4/3*K*h*a*dy;area+=2*a*dy;force+=stripForce;if(y<0)inner+=stripForce;moment+=stripForce*y}
 return {force,area,inner,moment};
}
function patchBasis(s){const W=s.tyreWidth??235,R=tyreRadius(s),pressure=(s.tyrePressure??2.2)*.1,key=[W,R,pressure].join('/');if(patchBasisCache.has(key))return patchBasisCache.get(key);
 const Rc=(W/2)**2/5,Fref=3372;let lo=0,hi=100;
 for(let i=0;i<30;i++){const z=(lo+hi)/2;if(patchIntegral(z,W/2,R,Rc,0).area<Fref/pressure)lo=z;else hi=z}
 const z=(lo+hi)/2,K=Fref/patchIntegral(z,W/2,R,Rc,0).force,basis={W,R,Rc,K};if(patchBasisCache.size>64)patchBasisCache.clear();patchBasisCache.set(key,basis);return basis;
}
function contactPatch(s,w){
 const b=patchBasis(s),compliance=s.tyreCompliance??1,half=b.W/2*Math.cos(w.camber*rad),tilt=Math.tan(w.camber*rad)/(1+2*compliance),K=b.K/Math.sqrt(compliance),R=b.R,Rc=b.Rc,Fz=Math.max(0,w.Fz);
 if(Fz<.01)return {area:0,areaCm2:0,length:0,width:0,peakBar:0,meanBar:0,innerShare:0,outerShare:0,centroid:0,force:0,half,R,Rc,tilt,K:0,z:0,yMin:0,yMax:0};
 const yp=clamp(Rc*tilt,-half,half),maxProfile=-yp*yp/(2*Rc)+tilt*yp;let lo=-maxProfile,hi=lo+100;
 for(let i=0;i<29;i++){const z=(lo+hi)/2;if(patchIntegral(z,half,R,Rc,tilt,K).force<Fz)lo=z;else hi=z}
 const z=(lo+hi)/2,q=patchIntegral(z,half,R,Rc,tilt,K),hmax=Math.max(0,z+maxProfile),root=Math.sqrt(Math.max(0,(Rc*tilt)**2+2*Rc*z)),yMin=clamp(Rc*tilt-root,-half,half),yMax=clamp(Rc*tilt+root,-half,half);
 return {area:q.area,areaCm2:q.area/100,length:2*Math.sqrt(2*R*hmax),width:yMax-yMin,peakBar:K*hmax*10,meanBar:Fz/q.area*10,innerShare:q.inner/q.force,outerShare:1-q.inner/q.force,centroid:q.moment/q.force,force:q.force,half,R,Rc,tilt,K,z,yMin,yMax};
}
function contactPressure(p,x,y){if(Math.abs(y)>p.half)return 0;return p.K*Math.max(0,p.z-x*x/(2*p.R)-y*y/(2*p.Rc)+p.tilt*y)}

root.DriftModel={defaults,angles,suspensionRates,bumpToeAt,bumpKinematics,calculate,wheelGeometry,tyreRadius,contactPatch,contactPressure,rad,deg,clamp,rotate};if(typeof module!=='undefined')module.exports=root.DriftModel;
})(typeof window==='undefined'?globalThis:window);
