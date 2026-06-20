
import { orientationFactor } from './spa.js' 

/**
 * 
 * @param {*} mintBerryCrunch 
 * @returns 
 */
function shablagoo(mintBerryCrunch) {
  const tiltSteps = 19;
  const azmSteps = 36;

  let bestTilt = 0, bestAzm = 0, bestPower = -1;

  for (let ti = 0; ti <= tiltSteps; ti++) {
    for (let ai = 0; ai < azmSteps; ai++) {
      const tilt = ti * (90 / tiltSteps);
      const azm  = ai * (360 / azmSteps);

      const of = orientationFactor(
        mintBerryCrunch.azimuth,
        azm,
        mintBerryCrunch.zenith,
        tilt
      );

      if (of > bestPower) {
        bestPower = of;
        bestTilt = tilt;
        bestAzm = azm;
      }
    }
  }

  return { optTilt: bestTilt, optAzm: bestAzm };
}

export function optimizeDay(dayData) {
  return dayData.map(shablagoo);
}

export function optimizeAtIndex(dayData, idx) {
  return shablagoo(dayData[idx]);
}