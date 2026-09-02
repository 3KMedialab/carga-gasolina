// calculo.js — toda la lógica de negocio. Sin DOM ni almacenamiento: funciones puras.

import { clamp } from './util.js';

// Cómo cambian los consumos según el tipo de conducción y el frío.
// En ciudad el eléctrico rinde mejor y la gasolina peor; en carretera al revés.
// Con frío la calefacción pesa más por km cuanto más despacio se va.
export const PRESET_FACTORS = {
  ciudad:    { elec: 0.86, fuel: 1.20, coldElec: 1.45, coldFuel: 1.20 },
  mixto:     { elec: 1.00, fuel: 1.00, coldElec: 1.30, coldFuel: 1.12 },
  carretera: { elec: 1.18, fuel: 0.92, coldElec: 1.18, coldFuel: 1.06 }
};

export const COLD_EFF = 0.95;

// A baja potencia las pérdidas fijas del cargador de a bordo pesan mucho más.
export function efficiencyPenalty(power){
  if(power < 2.5) return 0.82;
  if(power < 4)   return 0.93;
  if(power < 6)   return 0.98;
  return 1;
}

// Punto donde el coche empieza a bajar la corriente, y cuánto se ralentiza.
// Depende de la química: la LFP aguanta más arriba y luego cae de golpe.
export function taper(chem){
  if(chem === 'lfp') return { knee: 90, slow: 2.5 };
  if(chem === 'nmc') return { knee: 80, slow: 2.0 };
  return { knee: 85, slow: 2.2 };
}

/**
 * Calcula una sesión de carga completa.
 * Es la única fuente de verdad: la usan tanto el veredicto como la hora límite.
 */
export function simulate(c){
  const power = Math.min(c.chargerPower, c.maxPower > 0 ? c.maxPower : c.chargerPower);
  const powerCapped = c.maxPower > 0 && c.chargerPower > c.maxPower;

  const penalty = efficiencyPenalty(power);
  const eff = clamp(clamp(c.chargeEff, 1, 100) / 100 * penalty, 0.30, 0.99);

  const { knee: KNEE, slow: SLOW } = taper(c.chem);

  // Factor medio de tiempo entre dos niveles de carga
  function timeFactor(from, to){
    if(to <= KNEE) return 1;
    const fast = Math.max(0, Math.min(to, KNEE) - Math.min(from, KNEE));
    const slow = Math.max(0, to - Math.max(from, KNEE));
    const total = fast + slow;
    return total <= 0 ? 1 : (fast + slow * SLOW) / total;
  }

  const soc = clamp(c.currentSoc, 0, 100);
  const billedForRoom = eff > 0 ? (c.battery * (100 - soc) / 100) / eff : 0;

  let sessionKwh, capped;
  if(c.mode === 'parked'){
    const hours = Math.max(0, c.parkHours);
    const kwhToKnee = Math.max(0, eff > 0 ? (c.battery * Math.max(0, KNEE - soc) / 100) / eff : 0);
    const hoursToKnee = power > 0 ? kwhToKnee / power : 0;
    sessionKwh = hours <= hoursToKnee
      ? hours * power
      : kwhToKnee + (hours - hoursToKnee) * (power / SLOW);
    sessionKwh = Math.min(sessionKwh, billedForRoom);
    capped = billedForRoom <= sessionKwh + 0.0001 && billedForRoom < hours * power;
  } else {
    sessionKwh = Math.min(Math.max(0, c.sessionKwh), billedForRoom);
    capped = billedForRoom < c.sessionKwh;
  }

  const energyIn = sessionKwh * eff;
  const finalSoc = c.battery > 0 ? clamp(soc + (energyIn / c.battery) * 100, 0, 100) : 0;
  const chargeHours = power > 0 ? (sessionKwh / power) * timeFactor(soc, finalSoc) : 0;
  const nothingToCharge = sessionKwh <= 0.001;

  // El recargo se cobra por ocupar la plaza, no por cargar
  const occupiedHours = c.mode === 'parked' ? Math.max(0, c.parkHours) : chargeHours;
  const energyCost = c.byMinute ? c.pricePerMin * chargeHours * 60 : c.chargerPrice * sessionKwh;
  const overHours = (c.overMin > 0 && c.freeHours >= 0) ? Math.max(0, occupiedHours - c.freeHours) : 0;
  const overCost = overHours * 60 * (c.overMin || 0);

  const costPerKmFuel = (c.fuelPrice * c.fuelCons) / 100;
  const km = c.elecCons > 0 ? (energyIn / c.elecCons) * 100 : 0;
  const sessionCost = energyCost + overCost + (c.sessionFee || 0);
  const equivFuel = costPerKmFuel * km;
  const gross = equivFuel - sessionCost;
  const detourCost = (c.mode === 'trip' ? Math.max(0, c.detourKm) : 0) * 2 * costPerKmFuel;
  const net = gross - detourCost;

  return {
    power, powerCapped, eff, effReduced: penalty < 1,
    sessionKwh, capped, energyIn, finalSoc, chargeHours, occupiedHours, nothingToCharge,
    energyCost, overCost, overHours,
    km, sessionCost, equivFuel, gross, detourCost, net,
    effectivePerKwh: sessionKwh > 0 ? energyCost / sessionKwh : 0
  };
}

/** Hora a partir de la cual el recargo por tiempo se come todo el ahorro. */
export function findLimitHours(cfg){
  if(!(cfg.overMin > 0)) return null;
  for(let h = cfg.freeHours; h <= 12; h += 0.05){
    if(simulate({ ...cfg, parkHours: h, mode: 'parked' }).net < 0) return h;
  }
  return null;
}

/**
 * Estadística de las mediciones reales.
 * R = km eléctricos por kWh facturado. Absorbe eficiencia, consumo y errores
 * de capacidad declarada, así que sustituye a las tres estimaciones.
 */
export function measStats(list){
  if(!list.length) return { n: 0, R: null, cv: null, band: 0.30 };
  const mean = list.reduce((s, m) => s + m.R, 0) / list.length;
  if(list.length < 2) return { n: 1, R: mean, cv: null, band: 0.15 };
  const v = list.reduce((s, m) => s + (m.R - mean) ** 2, 0) / (list.length - 1);
  const cv = mean > 0 ? Math.sqrt(v) / mean : 0;
  return { n: list.length, R: mean, cv, band: 1.645 * cv / Math.sqrt(list.length) };
}

/** Valida una medición y devuelve {ok, R, error}. */
export function buildMeasurement({ km1, km2, kwh, litres, fuelCons }){
  const fail = error => ({ ok: false, error });
  if(!isFinite(km1) || !isFinite(km2)) return fail('Faltan los kil\u00f3metros.');
  if(km2 <= km1) return fail('Los km del final deben ser mayores que los del principio.');
  if(!isFinite(kwh) || kwh <= 0) return fail('Indica los kWh cargados en total.');
  if(!isFinite(litres) || litres < 0) litres = 0;

  const kmTot = km2 - km1;
  const kmGas = fuelCons > 0 ? (litres / fuelCons) * 100 : 0;
  const kmElec = kmTot - kmGas;

  if(kmElec <= 0) return fail('Seg\u00fan la gasolina gastada, todos esos km los hizo el motor. Esta medida no sirve.');
  if(kmGas / kmTot > 0.5) return fail('M\u00e1s de la mitad de los km fueron con gasolina: la medida ser\u00eda poco fiable.');

  const R = kmElec / kwh;
  if(R < 0.5 || R > 15) return fail('El resultado no es cre\u00edble. Revisa los datos.');

  return { ok: true, km: kmTot, kmElec, kwh, litres, R };
}
