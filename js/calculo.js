// calculo.js — toda la lógica de negocio. Sin DOM ni almacenamiento: funciones puras.

import { clamp } from './util.js';

// Climatización durante el trayecto. Es lo que más mueve el consumo eléctrico
// fuera de la forma de conducir, y el usuario la conoce con certeza, tanto al
// medir como antes de salir. No hay factores estimados: el efecto de cada una
// sale solo de las mediciones hechas con esa misma climatización.
export const CLIMAS = ['calefaccion', 'aire', 'nada'];

// A baja potencia las pérdidas fijas del cargador de a bordo pesan mucho más.
export function efficiencyPenalty(power){
  if(power < 2.5) return 0.82;
  if(power < 4)   return 0.93;
  if(power < 6)   return 0.98;
  return 1;
}

// Punto donde el coche empieza a bajar la corriente, y cuánto se ralentiza.
// Depende de la química: la LFP aguanta más arriba y luego cae de golpe.
// También depende de la tasa C (potencia de carga ÷ batería): a esa
// frenada la impone el BMS para no forzar las celdas, así que solo hace
// falta cuando la corriente ya es alta para el tamaño del paquete. Los
// knee/slow de abajo están calibrados para carga rápida en torno a 1C;
// una recarga en AC de un enchufable suele quedarse muy por debajo
// (0,2-0,5C, ver medidas reales), y ahí apenas hace falta frenar hasta
// el último tramo. Punto de partida razonable, no una curva medida: se
// irá afinando con más recargas reales (sección 10 del plan de pruebas).
const C_KNEE_MAX = 97;  // techo del knee a tasas muy bajas (0 < cRate < C_MIN)
const C_REF = 1;        // tasa C a la que se usan los knee/slow calibrados
const C_MIN = 0.2;      // por debajo de esto, frenada ya mínima

export function taper(chem, cRate){
  const base = chem === 'lfp' ? { knee: 90, slow: 2.5 }
    : chem === 'nmc' ? { knee: 80, slow: 2.0 }
    : { knee: 85, slow: 2.2 };

  if(!(cRate > 0)) return base; // sin tasa C: comportamiento de siempre

  const t = clamp((cRate - C_MIN) / (C_REF - C_MIN), 0, 1);
  return {
    knee: base.knee + (C_KNEE_MAX - base.knee) * (1 - t),
    slow: 1 + (base.slow - 1) * t
  };
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

  const cRate = c.battery > 0 ? power / c.battery : 0;
  const { knee: KNEE, slow: SLOW } = taper(c.chem, cRate);

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
// Las medidas se agrupan por climatización (ver rParaClima). Dentro de cada
// grupo solo cuentan las recientes: el desgaste de la batería mueve R un 0,5%
// al año, así que una medida con calefacción del invierno pasado sigue valiendo
// este invierno. Las medidas sin clasificar (anteriores a la climatización)
// mezclan estaciones, así que para ellas se mantiene la ventana corta de antes.
export const MEAS_MAX = 8;                    // como mucho, las 8 últimas de cada grupo
export const MEAS_MESES = 12;                 // de los últimos 12 meses
export const MEAS_MESES_SIN_CLASIFICAR = 6;   // o de los últimos 6, si no están clasificadas

/** Devuelve las medidas vigentes, de más antigua a más reciente. */
export function measVigentes(list, ahora = Date.now(), meses = MEAS_MESES){
  const limite = ahora - meses * 30 * 86400000;
  const recientes = list.filter(m => {
    const t = new Date(m.date).getTime();
    return isFinite(t) ? t >= limite : true;
  });
  // si todas son antiguas, nos quedamos con las últimas para no perder la referencia
  const base = recientes.length ? recientes : list;
  return base.slice(-MEAS_MAX);
}

// Valor crítico de la t de Student (bilateral, 90 %: el mismo nivel que el
// 1,645 de la normal) para 1 a 7 grados de libertad, es decir, de 2 a 8
// medidas (MEAS_MAX). Con pocas medidas la desviación estimada es muy poco
// fiable: dos valores casi iguales dan una desviación casi nula por pura
// casualidad. La normal (1,645) se queda corta ahí y la t lo compensa: con
// 2 medidas vale 6,31, casi cuatro veces más.
const T90 = [6.314, 2.920, 2.353, 2.132, 2.015, 1.943, 1.895];
const tCrit = df => T90[Math.min(Math.max(df, 1), T90.length) - 1];

// Con una sola medida la banda es del 15 %. Con dos medidas casi idénticas la
// t de Student seguiría dando una banda de ~0 %, lo que sería más optimista que
// con una sola medida solo por la casualidad de que coincidan. Por eso, con
// exactamente dos medidas la banda nunca baja de la de una sola.
export const BAND_UNA_MEDIDA = 0.15;

// R se calcula como km eléctricos totales ÷ kWh totales, no como media de los
// R de cada medida: así una recarga de 2 kWh (donde 0,5 kWh de error en el
// contador mueve mucho su R) no pesa lo mismo que una de 12 kWh. Si alguna
// medida no trae km y kWh (datos antiguos), se usa la media simple de todas.
// La dispersión (cv y banda) sigue siendo la de los R individuales.
export function measStats(list, ahora = Date.now(), meses = MEAS_MESES){
  const usadas = measVigentes(list, ahora, meses);
  const descartadas = list.length - usadas.length;
  if(!usadas.length) return { n: 0, R: null, cv: null, band: 0.30, descartadas: 0 };
  const mean = usadas.reduce((s, m) => s + m.R, 0) / usadas.length;
  const ponderable = usadas.every(m => m.kwh > 0 && m.kmElec > 0);
  const R = ponderable
    ? usadas.reduce((s, m) => s + m.kmElec, 0) / usadas.reduce((s, m) => s + m.kwh, 0)
    : mean;
  if(usadas.length < 2) return { n: 1, R, cv: null, band: BAND_UNA_MEDIDA, descartadas };
  const v = usadas.reduce((s, m) => s + (m.R - mean) ** 2, 0) / (usadas.length - 1);
  const cv = mean > 0 ? Math.sqrt(v) / mean : 0;
  let band = tCrit(usadas.length - 1) * cv / Math.sqrt(usadas.length);
  if(usadas.length === 2) band = Math.max(band, BAND_UNA_MEDIDA);
  return { n: usadas.length, R, cv, band, descartadas };
}

/** Medidas sin climatización: guardadas antes de que la app la preguntara. */
export const sinClasificar = m => !m || CLIMAS.indexOf(m.clima) === -1;

/**
 * R para una climatización concreta, solo con datos medidos.
 * 1) Si hay medidas con esa climatización, solo esas.
 * 2) Si no, las medidas sin clasificar (antiguas), con su ventana corta: no
 *    se sabe con qué climatización se hicieron, pero no se ha medido nada mejor.
 * 3) Si tampoco, n = 0: se usa el consumo declarado con su banda del 30%.
 * Nunca se toman prestadas medidas de otra climatización: una de verano con
 * aire no dice nada de cuánto gasta la calefacción.
 * `frio` se guarda en cada medida pero aún no separa grupos: primero hay que
 * ver con datos si el frío sin calefacción cambia R de forma apreciable.
 */
export function rParaClima(list, clima, ahora = Date.now()){
  const grupo = (list || []).filter(m => m && m.clima === clima);
  if(grupo.length) return { ...measStats(grupo, ahora, MEAS_MESES), fuente: 'clima' };
  const viejas = (list || []).filter(sinClasificar);
  if(viejas.length) return { ...measStats(viejas, ahora, MEAS_MESES_SIN_CLASIFICAR), fuente: 'sin-clasificar' };
  return { ...measStats([], ahora), fuente: 'ninguna' };
}

/** Ids de las medidas que cuentan ahora mismo en algún grupo (para atenuar el resto). */
export function measEnUso(list, ahora = Date.now()){
  const ids = new Set();
  const add = (l, meses) => measVigentes(l, ahora, meses).forEach(m => ids.add(m.id));
  CLIMAS.forEach(c => add((list || []).filter(m => m && m.clima === c), MEAS_MESES));
  add((list || []).filter(sinClasificar), MEAS_MESES_SIN_CLASIFICAR);
  return ids;
}

/** Valida una medición y devuelve {ok, R, error}. */
export function buildMeasurement({ km1, km2, kwh, litres, fuelCons, clima, frio }){
  const fail = error => ({ ok: false, error });
  if(!isFinite(km1) || !isFinite(km2)) return fail('Faltan los kilómetros.');
  if(km2 <= km1) return fail('Los km del final deben ser mayores que los del principio.');
  if(!isFinite(kwh) || kwh <= 0) return fail('Indica los kWh cargados en total.');
  if(!isFinite(litres) || litres < 0) litres = 0;

  const kmTot = km2 - km1;
  const kmGas = fuelCons > 0 ? (litres / fuelCons) * 100 : 0;
  const kmElec = kmTot - kmGas;

  if(kmElec <= 0) return fail('Según la gasolina gastada, todos esos km los hizo el motor. Esta medida no sirve.');
  if(kmGas / kmTot > 0.5) return fail('Más de la mitad de los km fueron con gasolina: la medida sería poco fiable.');

  const R = kmElec / kwh;
  if(R < 0.5 || R > 15) return fail('El resultado no es creíble. Revisa los datos.');

  if(CLIMAS.indexOf(clima) === -1) return fail('Indica si usaste la calefacción, el aire o nada.');
  if(frio !== true && frio !== false) return fail('Indica si hizo frío esos días.');

  return { ok: true, km: kmTot, kmElec, kwh, litres, R, clima, frio };
}
