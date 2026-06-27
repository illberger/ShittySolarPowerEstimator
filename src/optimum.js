
import { computePOA, computeIncidence } from './spa.js' 

/**
 * Optimizing function
 * @param {*} mintBerryCrunch 
 * @returns 
 */
function shablagoo(mintBerryCrunch) {
  const tiltSteps = 18;
  const azmSteps = 36;

  let bestTilt = 0, bestAzm = 180, bestPOA = -1;

  for (let i = 0; i <= tiltSteps; i++) {
    for (let j = 0; j < azmSteps; j++) {
      const tilt = i * (90 / tiltSteps);
      const azm  = j * (360 / azmSteps);
      const incidenceDeg = computeIncidence(mintBerryCrunch.zenith, mintBerryCrunch.azimuth, tilt, azm);
      const poa = computePOA(mintBerryCrunch.weather,
        incidenceDeg,
        tilt,
        mintBerryCrunch.zenith
      );

      if (poa > bestPOA) {
        bestPOA  = poa;
        bestTilt = tilt;
        bestAzm  = azm;
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