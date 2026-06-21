/*
Copyright © 2008-2011 Alliance for Energy Innovation, LLC, All Rights Reserved
The Solar Position Algorithm ("Software") is code in development prepared by employees of the Alliance for Energy Innovation, LLC, (hereinafter the "Contractor"), under Contract No. DE-AC36-08GO28308 ("Contract") with the U.S. Department of Energy (the "DOE"). The United States Government has been granted for itself and others acting on its behalf a paid-up, non-exclusive, irrevocable, worldwide license in the Software to reproduce, prepare derivative works, and perform publicly and display publicly. Beginning five (5) years after the date permission to assert copyright is obtained from the DOE, and subject to any subsequent five (5) year renewals, the United States Government is granted for itself and others acting on its behalf a paid-up, non-exclusive, irrevocable, worldwide license in the Software to reproduce, prepare derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so. If the Contractor ceases to make this computer software available, it may be obtained from DOE's Office of Scientific and Technical Information's Energy Science and Technology Software Center (ESTSC) at P.O. Box 1020, Oak Ridge, TN 37831-1020. THIS SOFTWARE IS PROVIDED BY THE CONTRACTOR "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE CONTRACTOR OR THE U.S. GOVERNMENT BE LIABLE FOR ANY SPECIAL, INDIRECT OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER, INCLUDING BUT NOT LIMITED TO CLAIMS ASSOCIATED WITH THE LOSS OF DATA OR PROFITS, WHICH MAY RESULT FROM AN ACTION IN CONTRACT, NEGLIGENCE OR OTHER TORTIOUS CLAIM THAT ARISES OUT OF OR IN CONNECTION WITH THE ACCESS, USE OR PERFORMANCE OF THIS SOFTWARE.
The Software is being provided for internal, noncommercial purposes only and shall not be re-distributed. Please contact Jean Schulte in the NLR Commercialization and Technology Transfer Office for information concerning a commercial license to use the Software.
As a condition of using the Software in an application, the developer of the application agrees to reference the use of the Software and make this Notice readily accessible to any end-user in a Help|About screen or equivalent manner. 
*/

/*
Lightweight JS port of NREL's SPA.
*/

const PI = Math.PI;
const SUN_RADIUS = 0.26667;

const L_SUBCOUNT = [64,34,20,7,3,1];
const B_SUBCOUNT = [5,2];
const R_SUBCOUNT = [40,10,6,2,1];

const L_TERMS = [
  [[175347046,0,0],[3341656,4.6692568,6283.07585],[34894,4.6261,12566.1517],[3497,2.7441,5753.3849],[3418,2.8289,3.5231],[3136,3.6277,77713.7715],[2676,4.4181,7860.4194],[2343,6.1352,3930.2097],[1324,0.7425,11506.7698],[1273,2.0371,529.691],[1199,1.1096,1577.3435],[990,5.233,5884.927],[902,2.045,26.298],[857,3.508,398.149],[780,1.179,5223.694],[753,2.533,5507.553],[505,4.583,18849.228],[492,4.205,775.523],[357,2.92,0.067],[317,5.849,11790.629],[284,1.899,796.298],[271,0.315,10977.079],[243,0.345,5486.778],[206,4.806,2544.314],[205,1.869,5573.143],[202,2.458,6069.777],[156,0.833,213.299],[132,3.411,2942.463],[126,1.083,20.775],[115,0.645,0.98],[103,0.636,4694.003],[102,0.976,15720.839],[102,4.267,7.114],[99,6.21,2146.17],[98,0.68,155.42],[86,5.98,161000.69],[85,1.3,6275.96],[85,3.67,71430.7],[80,1.81,17260.15],[79,3.04,12036.46],[75,1.76,5088.63],[74,3.5,3154.69],[74,4.68,801.82],[70,0.83,9437.76],[62,3.98,8827.39],[61,1.82,7084.9],[57,2.78,6286.6],[56,4.39,14143.5],[56,3.47,6279.55],[52,0.19,12139.55],[52,1.33,1748.02],[51,0.28,5856.48],[49,0.49,1194.45],[41,5.37,8429.24],[41,2.4,19651.05],[39,6.17,10447.39],[37,6.04,10213.29],[37,2.57,1059.38],[36,1.71,2352.87],[36,1.78,6812.77],[33,0.59,17789.85],[30,0.44,83996.85],[30,2.74,1349.87],[25,3.16,4690.48]],
  [[628331966747,0,0],[206059,2.678235,6283.07585],[4303,2.6351,12566.1517],[425,1.59,3.523],[119,5.796,26.298],[109,2.966,1577.344],[93,2.59,18849.23],[72,1.14,529.69],[68,1.87,398.15],[67,4.41,5507.55],[59,2.89,5223.69],[56,2.17,155.42],[45,0.4,796.3],[36,0.47,775.52],[29,2.65,7.11],[21,5.34,0.98],[19,1.85,5486.78],[19,4.97,213.3],[17,2.99,6275.96],[16,0.03,2544.31],[16,1.43,2146.17],[15,1.21,10977.08],[12,2.83,1748.02],[12,3.26,5088.63],[12,5.27,1194.45],[12,2.08,4694],[11,0.77,553.57],[10,1.3,6286.6],[10,4.24,1349.87],[9,2.7,242.73],[9,5.64,951.72],[8,5.3,2352.87],[6,2.65,9437.76],[6,4.67,4690.48]],
  [[52919,0,0],[8720,1.0721,6283.0758],[309,0.867,12566.152],[27,0.05,3.52],[16,5.19,26.3],[16,3.68,155.42],[10,0.76,18849.23],[9,2.06,77713.77],[7,0.83,775.52],[5,4.66,1577.34],[4,1.03,7.11],[4,3.44,5573.14],[3,5.14,796.3],[3,6.05,5507.55],[3,1.19,242.73],[3,6.12,529.69],[3,0.31,398.15],[3,2.28,553.57],[2,4.38,5223.69],[2,3.75,0.98]],
  [[289,5.844,6283.076],[35,0,0],[17,5.49,12566.15],[3,5.2,155.42],[1,4.72,3.52],[1,5.3,18849.23],[1,5.97,242.73]],
  [[114,3.142,0],[8,4.13,6283.08],[1,3.84,12566.15]],
  [[1,3.14,0]]
];

const B_TERMS = [
  [[280,3.199,84334.662],[102,5.422,5507.553],[80,3.88,5223.69],[44,3.7,2352.87],[32,4,1577.34]],
  [[9,3.9,5507.55],[6,1.73,5223.69]]
];

const R_TERMS = [
  [[100013989,0,0],[1670700,3.0984635,6283.07585],[13956,3.05525,12566.1517],[3084,5.1985,77713.7715],[1628,1.1739,5753.3849],[1576,2.8469,7860.4194],[925,5.453,11506.77],[542,4.564,3930.21],[472,3.661,5884.927],[346,0.964,5507.553],[329,5.9,5223.694],[307,0.299,5573.143],[243,4.273,11790.629],[212,5.847,1577.344],[186,5.022,10977.079],[175,3.012,18849.228],[110,5.055,5486.778],[98,0.89,6069.78],[86,5.69,15720.84],[86,1.27,161000.69],[65,0.27,17260.15],[63,0.92,529.69],[57,2.01,83996.85],[56,5.24,71430.7],[49,3.25,2544.31],[47,2.58,775.52],[45,5.54,9437.76],[43,6.01,6275.96],[39,5.36,4694],[38,2.39,8827.39],[37,0.83,19651.05],[37,4.9,12139.55],[36,1.67,12036.46],[35,1.84,2942.46],[33,0.24,7084.9],[32,0.18,5088.63],[32,1.78,398.15],[28,1.21,6286.6],[28,1.9,6279.55],[26,4.59,10447.39]],
  [[103019,1.10749,6283.07585],[1721,1.0644,12566.1517],[702,3.142,0],[32,1.02,18849.23],[31,2.84,5507.55],[25,1.32,5223.69],[18,1.42,1577.34],[10,5.91,10977.08],[9,1.42,6275.96],[9,0.27,5486.78]],
  [[4359,5.7846,6283.0758],[124,5.579,12566.152],[12,3.14,0],[9,3.63,77713.77],[6,1.87,5573.14],[3,5.47,18849.23]],
  [[145,4.273,6283.076],[7,3.92,12566.15]],
  [[4,2.56,6283.08]]
];

const Y_TERMS = [[0,0,0,0,1],[-2,0,0,2,2],[0,0,0,2,2],[0,0,0,0,2],[0,1,0,0,0],[0,0,1,0,0],[-2,1,0,2,2],[0,0,0,2,1],[0,0,1,2,2],[-2,-1,0,2,2],[-2,0,1,0,0],[-2,0,0,2,1],[0,0,-1,2,2],[2,0,0,0,0],[0,0,1,0,1],[2,0,-1,2,2],[0,0,-1,0,1],[0,0,1,2,1],[-2,0,2,0,0],[0,0,-2,2,1],[2,0,0,2,2],[0,0,2,2,2],[0,0,2,0,0],[-2,0,1,2,2],[0,0,0,2,0],[-2,0,0,2,0],[0,0,-1,2,1],[0,2,0,0,0],[2,0,-1,0,1],[-2,2,0,2,2],[0,1,0,0,1],[-2,0,1,0,1],[0,-1,0,0,1],[0,0,2,-2,0],[2,0,-1,2,1],[2,0,1,2,2],[0,1,0,2,2],[-2,1,1,0,0],[0,-1,0,2,2],[2,0,0,2,1],[2,0,1,0,0],[-2,0,2,2,2],[-2,0,1,2,1],[2,0,-2,0,1],[2,0,0,0,1],[0,-1,1,0,0],[-2,-1,0,2,1],[-2,0,0,0,1],[0,0,2,2,1],[-2,0,2,0,1],[-2,1,0,2,1],[0,0,1,-2,0],[-1,0,1,0,0],[-2,1,0,0,0],[1,0,0,0,0],[0,0,1,2,0],[0,0,-2,2,2],[-1,-1,1,0,0],[0,1,1,0,0],[0,-1,1,2,2],[2,-1,-1,2,2],[0,0,3,2,2],[2,-1,0,2,2]];

const PE_TERMS = [[-171996,-174.2,92025,8.9],[-13187,-1.6,5736,-3.1],[-2274,-0.2,977,-0.5],[2062,0.2,-895,0.5],[1426,-3.4,54,-0.1],[712,0.1,-7,0],[-517,1.2,224,-0.6],[-386,-0.4,200,0],[-301,0,129,-0.1],[217,-0.5,-95,0.3],[-158,0,0,0],[129,0.1,-70,0],[123,0,-53,0],[63,0,0,0],[63,0.1,-33,0],[-59,0,26,0],[-58,-0.1,32,0],[-51,0,27,0],[48,0,0,0],[46,0,-24,0],[-38,0,16,0],[-31,0,13,0],[29,0,0,0],[29,0,-12,0],[26,0,0,0],[-22,0,0,0],[21,0,-10,0],[17,-0.1,0,0],[16,0,-8,0],[-16,0.1,7,0],[-15,0,9,0],[-13,0,7,0],[-12,0,6,0],[11,0,0,0],[-10,0,5,0],[-8,0,3,0],[7,0,-3,0],[-7,0,0,0],[-7,0,3,0],[-7,0,3,0],[6,0,0,0],[6,0,-3,0],[6,0,-3,0],[-6,0,3,0],[-6,0,3,0],[5,0,0,0],[-5,0,3,0],[-5,0,3,0],[-5,0,3,0],[4,0,0,0],[4,0,0,0],[4,0,0,0],[-4,0,0,0],[-4,0,0,0],[-4,0,0,0],[3,0,0,0],[-3,0,0,0],[-3,0,0,0],[-3,0,0,0],[-3,0,0,0],[-3,0,0,0],[-3,0,0,0],[-3,0,0,0]];

export function r2d(r){return r*(180/PI);}
export function d2r(d){return d*(PI/180);}

function limitDeg(d){d/=360;let l=360*(d-Math.floor(d));if(l<0)l+=360;return l;}
function limitDeg180pm(d){d/=360;let l=360*(d-Math.floor(d));if(l<-180)l+=360;else if(l>180)l-=360;return l;}
function limitDeg180(d){d/=180;let l=180*(d-Math.floor(d));if(l<0)l+=180;return l;}
function limitZeroOne(v){let l=v-Math.floor(v);if(l<0)l+=1;return l;}
function limitMin(m){if(m<-20)m+=1440;else if(m>20)m-=1440;return m;}
function dayFracToLocalHr(f,tz){return 24*limitZeroOne(f+tz/24);}
function poly3(a,b,c,d,x){return((a*x+b)*x+c)*x+d;}
function intFloor(v){return Math.trunc(v);}

function earthPeriodicSum(terms,count,jme){
  let s=0;
  for(let i=0;i<count;i++) s+=terms[i][0]*Math.cos(terms[i][1]+terms[i][2]*jme);
  return s;
}

function earthValues(termSum,count,jme){
  let s=0;
  for(let i=0;i<count;i++) s+=termSum[i]*Math.pow(jme,i);
  return s/1e8;
}

function julianDay(yr,mo,dy,hr,mn,sc,dut1,tz){
  let dayDec=dy+(hr-tz+(mn+(sc+dut1)/60)/60)/24;
  if(mo<3){mo+=12;yr--;}
  let jd=intFloor(365.25*(yr+4716))+intFloor(30.6001*(mo+1))+dayDec-1524.5;
  if(jd>2299160){let a=intFloor(yr/100);jd+=(2-a+intFloor(a/4));}
  return jd;
}

export function computeIncidence(zenithDeg, sunAzmDeg, panelTiltDeg, panelAzmDeg) {
  const zenithRad = d2r(zenithDeg);
  const tiltRad = d2r(panelTiltDeg);
  const azmDiff = d2r(sunAzmDeg - panelAzmDeg);
  const cosInc = Math.cos(zenithRad) * Math.cos(tiltRad)
               + Math.sin(zenithRad) * Math.sin(tiltRad) * Math.cos(azmDiff);
  return r2d(Math.acos(Math.max(-1, Math.min(1, cosInc))));
}

export function spa(year,month,day,hour,minute,second,tz,lat,lon,elev,pressure,temp,slope,azmRot,deltaT,deltaUt1,atmosRefract){
  const jd=julianDay(year,month,day,hour,minute,second,deltaUt1,tz);
  const jc=(jd-2451545)/36525;
  const jde=jd+deltaT/86400;
  const jce=(jde-2451545)/36525;
  const jme=jce/10;
  const Lsum=L_SUBCOUNT.map((c,i)=>earthPeriodicSum(L_TERMS[i],c,jme));
  const L=limitDeg(r2d(earthValues(Lsum,6,jme)));
  const Bsum=B_SUBCOUNT.map((c,i)=>earthPeriodicSum(B_TERMS[i],c,jme));
  const B=r2d(earthValues(Bsum,2,jme));
  const Rsum=R_SUBCOUNT.map((c,i)=>earthPeriodicSum(R_TERMS[i],c,jme));
  const R=earthValues(Rsum,5,jme);

  const theta=L+180>=360?L+180-360:L+180;
  const beta=-B;

  const x0=poly3(1/189474,-0.0019142,445267.11148,297.85036,jce);
  const x1=poly3(-1/300000,-0.0001603,35999.05034,357.52772,jce);
  const x2=poly3(1/56250,0.0086972,477198.867398,134.96298,jce);
  const x3=poly3(1/327270,-0.0036825,483202.017538,93.27191,jce);
  const x4=poly3(1/450000,0.0020708,-1934.136261,125.04452,jce);
  const x=[x0,x1,x2,x3,x4];

  let sumPsi=0,sumEps=0;
  for(let i=0;i<63;i++){
    const s=d2r(Y_TERMS[i].reduce((a,v,j)=>a+v*x[j],0));
    sumPsi+=(PE_TERMS[i][0]+jce*PE_TERMS[i][1])*Math.sin(s);
    sumEps+=(PE_TERMS[i][2]+jce*PE_TERMS[i][3])*Math.cos(s);
  }
  const delPsi=sumPsi/36000000;
  const delEps=sumEps/36000000;

  const u=jme/10;
  const eps0=84381.448+u*(-4680.93+u*(-1.55+u*(1999.25+u*(-51.38+u*(-249.67+u*(-39.05+u*(7.12+u*(27.87+u*(5.79+u*2.45)))))))));
  const eps=delEps+eps0/3600;

  const delTau=-20.4898/(3600*R);
  const lamda=theta+delPsi+delTau;
  const nu0=limitDeg(280.46061837+360.98564736629*(jd-2451545)+jc*jc*(0.000387933-jc/38710000));
  const nu=nu0+delPsi*Math.cos(d2r(eps));

  const lamdaR=d2r(lamda),epsR=d2r(eps),betaR=d2r(beta);
  const alpha=limitDeg(r2d(Math.atan2(Math.sin(lamdaR)*Math.cos(epsR)-Math.tan(betaR)*Math.sin(epsR),Math.cos(lamdaR))));
  const delta=r2d(Math.asin(Math.sin(betaR)*Math.cos(epsR)+Math.cos(betaR)*Math.sin(epsR)*Math.sin(lamdaR)));

  const H=limitDeg(nu+lon-alpha);
  const xi=8.794/(3600*R);

  const latR=d2r(lat),xiR=d2r(xi),HR=d2r(H),deltaR=d2r(delta);
  const uAngle=Math.atan(0.99664719*Math.tan(latR));
  const yComp=0.99664719*Math.sin(uAngle)+elev*Math.sin(latR)/6378140;
  const xComp=Math.cos(uAngle)+elev*Math.cos(latR)/6378140;
  const daR=Math.atan2(-xComp*Math.sin(xiR)*Math.sin(HR),Math.cos(deltaR)-xComp*Math.sin(xiR)*Math.cos(HR));
  const deltaPrime=r2d(Math.atan2((Math.sin(deltaR)-yComp*Math.sin(xiR))*Math.cos(daR),Math.cos(deltaR)-xComp*Math.sin(xiR)*Math.cos(HR)));
  const da=r2d(daR);

  const HPrime=H-da;
  const HPrimeR=d2r(HPrime);
  const deltaPrimeR=d2r(deltaPrime);

  const e0=r2d(Math.asin(Math.sin(latR)*Math.sin(deltaPrimeR)+Math.cos(latR)*Math.cos(deltaPrimeR)*Math.cos(HPrimeR)));
  let delE=0;
  if(e0>=-1*(SUN_RADIUS+atmosRefract)){
    delE=(pressure/1010)*(283/(273+temp))*1.02/(60*Math.tan(d2r(e0+10.3/(e0+5.11))));
  }
  const e=e0+delE;
  const zenith=90-e;
  const azimuthAstro=limitDeg(r2d(Math.atan2(Math.sin(HPrimeR),Math.cos(HPrimeR)*Math.sin(latR)-Math.tan(deltaPrimeR)*Math.cos(latR))));
  const azimuth=limitDeg(azimuthAstro+180);

  const incidence = computeIncidence(zenith, azimuth, slope, azmRot);

  // RTS
  let sunrise=-99999,sunset=-99999,suntransit=-99999;
  const mL=limitDeg(280.4664567+jme*(360007.6982779+jme*(0.03032028+jme*(1/49931+jme*(-1/15300+jme*(-1/2000000))))));
  const eot=limitMin(4*(mL-0.0057183-alpha+delPsi*Math.cos(d2r(eps))));

  const calcAlphaDelta=(jdBase,dT)=>{
    const jd2=jdBase;
    const jce2=(jd2-2451545)/36525;
    const jme2=jce2/10;
    const Ls=L_SUBCOUNT.map((c,i)=>earthPeriodicSum(L_TERMS[i],c,jme2));
    const Lv=limitDeg(r2d(earthValues(Ls,6,jme2)));
    const Bs=B_SUBCOUNT.map((c,i)=>earthPeriodicSum(B_TERMS[i],c,jme2));
    const Bv=r2d(earthValues(Bs,2,jme2));
    const Rs=R_SUBCOUNT.map((c,i)=>earthPeriodicSum(R_TERMS[i],c,jme2));
    const Rv=earthValues(Rs,5,jme2);
    const th=Lv+180>=360?Lv+180-360:Lv+180;
    const be=-Bv;
    const x0t=poly3(1/189474,-0.0019142,445267.11148,297.85036,jce2);
    const x1t=poly3(-1/300000,-0.0001603,35999.05034,357.52772,jce2);
    const x2t=poly3(1/56250,0.0086972,477198.867398,134.96298,jce2);
    const x3t=poly3(1/327270,-0.0036825,483202.017538,93.27191,jce2);
    const x4t=poly3(1/450000,0.0020708,-1934.136261,125.04452,jce2);
    const xt=[x0t,x1t,x2t,x3t,x4t];
    let sp=0,se=0;
    for(let i=0;i<63;i++){
      const s=d2r(Y_TERMS[i].reduce((a,v,j)=>a+v*xt[j],0));
      sp+=(PE_TERMS[i][0]+jce2*PE_TERMS[i][1])*Math.sin(s);
      se+=(PE_TERMS[i][2]+jce2*PE_TERMS[i][3])*Math.cos(s);
    }
    const dp=sp/36000000,de=se/36000000;
    const u2=jme2/10;
    const e02=84381.448+u2*(-4680.93+u2*(-1.55+u2*(1999.25+u2*(-51.38+u2*(-249.67+u2*(-39.05+u2*(7.12+u2*(27.87+u2*(5.79+u2*2.45)))))))));
    const ep=de+e02/3600;
    const dt2=-20.4898/(3600*Rv);
    const lam=th+dp+dt2;
    const lamR=d2r(lam),epR=d2r(ep),beR=d2r(be);
    const al=limitDeg(r2d(Math.atan2(Math.sin(lamR)*Math.cos(epR)-Math.tan(beR)*Math.sin(epR),Math.cos(lamR))));
    const de2=r2d(Math.asin(Math.sin(beR)*Math.cos(epR)+Math.cos(beR)*Math.sin(epR)*Math.sin(lamR)));
    return {alpha:al,delta:de2};
  };

  const jdMid=julianDay(year,month,day,0,0,0,0,0);
  const nu0rts=(limitDeg(280.46061837+360.98564736629*(jdMid-2451545)+(((jdMid-2451545)/36525)**2)*(0.000387933-((jdMid-2451545)/36525)/38710000)));

  const ad=[-1,0,1].map(i=>calcAlphaDelta(jdMid+i,0));

  const mTransit=(ad[1].alpha-lon-nu0rts)/360;
  const h0Prime=-1*(SUN_RADIUS+atmosRefract);
  const cosH0=(Math.sin(d2r(h0Prime))-Math.sin(d2r(lat))*Math.sin(d2r(ad[1].delta)))/(Math.cos(d2r(lat))*Math.cos(d2r(ad[1].delta)));

  if(Math.abs(cosH0)<=1){
    const H0=limitDeg180(r2d(Math.acos(cosH0)));
    const h0Dfrac=H0/360;
    const mRts=[
      limitZeroOne(mTransit),
      limitZeroOne(mTransit-h0Dfrac),
      limitZeroOne(mTransit+h0Dfrac)
    ];

    const nuRts=mRts.map((m,i)=>nu0rts+360.985647*m);

    const interp=(arr,n)=>{
      let a=arr[1]-arr[0],b=arr[2]-arr[1];
      if(Math.abs(a)>=2)a=limitZeroOne(a);
      if(Math.abs(b)>=2)b=limitZeroOne(b);
      return arr[1]+n*(a+b+(b-a)*n)/2;
    };

    const alphas=[ad[0].alpha,ad[1].alpha,ad[2].alpha];
    const deltas=[ad[0].delta,ad[1].delta,ad[2].delta];

    const alphaPrime=mRts.map((m,i)=>interp(alphas,m+deltaT/86400));
    const deltaPrimeRts=mRts.map((m,i)=>interp(deltas,m+deltaT/86400));
    const hPrime=mRts.map((m,i)=>limitDeg180pm(nuRts[i]+lon-alphaPrime[i]));
    const hRts=mRts.map((m,i)=>r2d(Math.asin(Math.sin(d2r(lat))*Math.sin(d2r(deltaPrimeRts[i]))+Math.cos(d2r(lat))*Math.cos(d2r(deltaPrimeRts[i]))*Math.cos(d2r(hPrime[i])))));

    const sunRiseSet=(idx)=>mRts[idx]+(hRts[idx]-h0Prime)/(360*Math.cos(d2r(deltaPrimeRts[idx]))*Math.cos(d2r(lat))*Math.sin(d2r(hPrime[idx])));
    suntransit=dayFracToLocalHr(mRts[0]-hPrime[0]/360,tz);
    sunrise=dayFracToLocalHr(sunRiseSet(1),tz);
    sunset=dayFracToLocalHr(sunRiseSet(2),tz);
  }

  return {zenith,azimuth,altitude:e,incidence,sunrise,sunset,suntransit,eot,jd,R,alpha,delta,H,nu};
}


/**
 * 
 * @param {*} weather
 * @param {*} incidenceDeg
 * @param {*} tiltDeg
 * @param {*} zenithDeg
 * @returns 
 */
export function computePOA(weather, incidenceDeg, tiltDeg, zenithDeg) {
  const tiltRad = d2r(tiltDeg);
  const incidenceRad = d2r(incidenceDeg);
  const cosInc = Math.max(0, Math.cos(incidenceRad));

  // TODO: maybe in the future
  if (weather) {
    const { dni, dhi, ghi } = weather;
    const beam      = dni * cosInc;
    const diffuse   = dhi * (1 + Math.cos(tiltRad)) / 2;
    const reflected = ghi * 0.2 * (1 - Math.cos(tiltRad)) / 2;
    return Math.max(0, beam + diffuse + reflected);
  } else {
    // idfk
    if (zenithDeg >= 90) return 0;
    const cosZ = Math.max(0.01, Math.cos(d2r(zenithDeg)));
    const airMass = 1 / cosZ;
    const m = Math.min(airMass, 10);
    const ghi_est = 1000 * Math.exp(-0.18 * (m - 1));
    const dni_est = ghi_est * 0.85;
    const dhi_est = ghi_est * 0.15;
    const beam = Math.max(0, dni_est) * cosInc;
    const diffuse = dhi_est * (1 + Math.cos(tiltRad)) / 2;
    const reflected = ghi_est * 0.2 * (1 - Math.cos(tiltRad)) / 2;
    return Math.max(0, beam + diffuse + reflected);
  }
}


/** 
 * Simplification irradiance estimation.
 * @deprecated
 */
export function orientationFactor(sunAzimuth,roofAzimuth,sunZenith,panelSlope){
  if(sunZenith>90)return 0;
  const zr=d2r(sunZenith),sr=d2r(panelSlope),ar=d2r(sunAzimuth-roofAzimuth);
  const ct=Math.cos(zr)*Math.cos(sr)+Math.sin(zr)*Math.sin(sr)*Math.cos(ar);
  return ct>0?ct:0;
}

