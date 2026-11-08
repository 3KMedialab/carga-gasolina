// calculo.js — toda la lógica de negocio. Sin DOM ni almacenamiento: funciones puras.

import { clamp, norm } from './util.js';

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

/** Parte de los kWh facturados que llega a la batería a esa potencia. */
function eficienciaA(power, chargeEff){
  return clamp(clamp(chargeEff, 1, 100) / 100 * efficiencyPenalty(power), 0.30, 0.99);
}

/**
 * Lo que costaría meter en casa la misma energía en la batería. A otra potencia
 * se pierde otra cantidad (un enchufe normal pierde más que una wallbox), así
 * que los kWh facturados en casa no son los mismos que aquí. La potencia de casa
 * también la limita lo que admita el coche.
 */
export function costeEnCasa(energyIn, casa, chargeEff, maxPower){
  if(!casa || !(energyIn > 0)) return 0;
  const power = maxPower > 0 ? Math.min(casa.potencia, maxPower) : casa.potencia;
  return energyIn / eficienciaA(power, chargeEff) * casa.precio;
}

/** Valida los datos de la carga en casa. Devuelve {ok, precio, potencia} o {ok:false, error}. */
export function buildCasa({ precio, potencia }){
  const fail = error => ({ ok: false, error });
  if(!isFinite(precio) || precio < 0) return fail('Indica lo que pagas por kWh en casa.');
  if(precio > 1) return fail('Más de 1 €/kWh no es creíble para casa. Revisa la cifra.');
  if(!isFinite(potencia) || potencia <= 0) return fail('Indica la potencia del enchufe o la wallbox.');
  if(potencia > 22) return fail('En casa no se carga a más de 22 kW. Revisa la cifra.');
  return { ok: true, precio, potencia };
}

/**
 * Calcula una sesión de carga completa.
 * Es la única fuente de verdad: la usan tanto el veredicto como la hora límite.
 * Con `c.casa` ({precio, potencia}) la alternativa es cargar esa misma energía en
 * casa (el usuario va a llegar a casa antes de gastar la batería); sin él, la
 * gasolina. El desvío se sigue valorando en gasolina: son km de más.
 */
export function simulate(c){
  const power = Math.min(c.chargerPower, c.maxPower > 0 ? c.maxPower : c.chargerPower);
  const powerCapped = c.maxPower > 0 && c.chargerPower > c.maxPower;

  const penalty = efficiencyPenalty(power);
  const eff = eficienciaA(power, c.chargeEff);

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
  const vs = c.casa ? 'casa' : 'gasolina';
  const homeCost = c.casa ? costeEnCasa(energyIn, c.casa, c.chargeEff, c.maxPower) : 0;
  const altCost = c.casa ? homeCost : equivFuel;   // lo que te habría costado la alternativa
  const gross = altCost - sessionCost;
  const detourCost = (c.mode === 'trip' ? Math.max(0, c.detourKm) : 0) * 2 * costPerKmFuel;
  const net = gross - detourCost;

  return {
    power, powerCapped, eff, effReduced: penalty < 1,
    sessionKwh, capped, energyIn, finalSoc, chargeHours, occupiedHours, nothingToCharge,
    energyCost, overCost, overHours,
    km, sessionCost, equivFuel, vs, homeCost, altCost, gross, detourCost, net,
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
// Estadística común a R y al consumo en híbrido: valor central (ponderado si
// se puede), dispersión de los valores individuales y banda con la t de Student.
function estadistica(list, ahora, meses, valor, ponderado){
  const usadas = measVigentes(list, ahora, meses);
  const descartadas = list.length - usadas.length;
  if(!usadas.length) return { n: 0, valor: null, cv: null, band: 0.30, descartadas: 0 };
  const mean = usadas.reduce((s, m) => s + valor(m), 0) / usadas.length;
  const p = ponderado(usadas);
  const centro = p !== null ? p : mean;
  if(usadas.length < 2) return { n: 1, valor: centro, cv: null, band: BAND_UNA_MEDIDA, descartadas };
  const v = usadas.reduce((s, m) => s + (valor(m) - mean) ** 2, 0) / (usadas.length - 1);
  const cv = mean > 0 ? Math.sqrt(v) / mean : 0;
  let band = tCrit(usadas.length - 1) * cv / Math.sqrt(usadas.length);
  if(usadas.length === 2) band = Math.max(band, BAND_UNA_MEDIDA);
  return { n: usadas.length, valor: centro, cv, band, descartadas };
}

export function measStats(list, ahora = Date.now(), meses = MEAS_MESES){
  const s = estadistica(list, ahora, meses, m => m.R, usadas =>
    usadas.every(m => m.kwh > 0 && m.kmElec > 0)
      ? usadas.reduce((t, m) => t + m.kmElec, 0) / usadas.reduce((t, m) => t + m.kwh, 0)
      : null);
  return { n: s.n, R: s.valor, cv: s.cv, band: s.band, descartadas: s.descartadas };
}

// Una medida de R puede quedar sin valor (R = null) si, con el consumo en
// híbrido de ahora, sus litros explican casi todos los km: ver medidasConConsumo.
const cuentaR = m => m && m.R !== null;

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
  list = (list || []).filter(cuentaR);
  const grupo = list.filter(m => m.clima === clima);
  if(grupo.length) return { ...measStats(grupo, ahora, MEAS_MESES), fuente: 'clima' };
  const viejas = list.filter(sinClasificar);
  if(viejas.length) return { ...measStats(viejas, ahora, MEAS_MESES_SIN_CLASIFICAR), fuente: 'sin-clasificar' };
  return { ...measStats([], ahora), fuente: 'ninguna' };
}

/**
 * Km que daría la energía de esta recarga con cada climatización, solo con R
 * medido: null para las que no tienen medidas propias (no se estima nada).
 * Equivale a simulate().km con elecCons = chargeEff / R.
 */
export function kmPorClima(energyIn, list, chargeEff, ahora = Date.now()){
  const out = {};
  CLIMAS.forEach(c => {
    const s = rParaClima(list, c, ahora);
    out[c] = s.fuente === 'clima' && chargeEff > 0 && energyIn > 0 ? energyIn * s.R * 100 / chargeEff : null;
  });
  return out;
}

/**
 * Ids de las medidas que cuentan ahora mismo en algún grupo (para atenuar el resto).
 * Sirve para cualquier lista agrupada por climatización: las de R y las de consumo.
 */
export function measEnUso(list, ahora = Date.now()){
  const ids = new Set();
  const add = (l, meses) => measVigentes(l, ahora, meses).forEach(m => ids.add(m.id));
  list = (list || []).filter(cuentaR);
  CLIMAS.forEach(c => add(list.filter(m => m.clima === c), MEAS_MESES));
  add(list.filter(sinClasificar), MEAS_MESES_SIN_CLASIFICAR);
  return ids;
}

/**
 * Km eléctricos y R de un periodo, descontando los km que hizo el motor:
 * litros ÷ consumo en híbrido × 100. Devuelve {ok, kmElec, R} o {ok:false, error}.
 * Lo usan la medida nueva y el recálculo de las guardadas, con las mismas reglas.
 */
function rDelPeriodo(kmTot, kwh, litres, fuelCons){
  const fail = error => ({ ok: false, error });
  const kmGas = fuelCons > 0 ? (litres / fuelCons) * 100 : 0;
  const kmElec = kmTot - kmGas;
  if(kmElec <= 0) return fail('Según la gasolina gastada, todos esos km los hizo el motor. Esta medida no sirve.');
  if(kmGas / kmTot > 0.5) return fail('Más de la mitad de los km fueron con gasolina: la medida sería poco fiable.');
  const R = kmElec / kwh;
  if(R < 0.5 || R > 15) return fail('El resultado no es creíble. Revisa los datos.');
  return { ok: true, kmElec, R };
}

/** Valida una medición y devuelve {ok, R, error}. */
export function buildMeasurement({ km1, km2, kwh, litres, fuelCons, clima, frio }){
  const fail = error => ({ ok: false, error });
  if(!isFinite(km1) || !isFinite(km2)) return fail('Faltan los kilómetros.');
  if(km2 <= km1) return fail('Los km del final deben ser mayores que los del principio.');
  if(!isFinite(kwh) || kwh <= 0) return fail('Indica los kWh cargados en total.');
  if(!isFinite(litres) || litres < 0) litres = 0;

  const kmTot = km2 - km1;
  const r = rDelPeriodo(kmTot, kwh, litres, fuelCons);
  if(!r.ok) return r;

  if(CLIMAS.indexOf(clima) === -1) return fail('Indica si usaste la calefacción, el aire o nada.');
  if(frio !== true && frio !== false) return fail('Indica si hizo frío esos días.');

  return { ok: true, km: kmTot, kmElec: r.kmElec, kwh, litres, R: r.R, clima, frio };
}

/**
 * Las medidas de R guardadas, con el consumo en híbrido de ahora.
 * Cada medida guarda sus km, kWh y litros, así que sus km eléctricos se pueden
 * rehacer sin inventarse nada cuando cambia el consumo (porque se ha medido o
 * porque se ha corregido el declarado). `consumoDe(clima)` da el consumo que
 * toca a cada medida: el medido con su climatización o, si no hay, el declarado.
 * Una medida sin litros no cambia. Una que con el consumo nuevo ya no pasa las
 * reglas de buildMeasurement queda con R = null y `invalida: true`: no cuenta,
 * pero sigue en la lista para que se vea y se pueda borrar.
 */
export function medidasConConsumo(list, consumoDe){
  return (list || []).map(m => {
    if(!m || !(m.km > 0) || !(m.kwh > 0) || !(m.litres > 0)) return m;
    const fc = consumoDe(m.clima);
    if(!(fc > 0)) return m;
    const r = rDelPeriodo(m.km, m.kwh, m.litres, fc);
    return r.ok
      ? { ...m, kmElec: r.kmElec, R: r.R, invalida: false }
      : { ...m, kmElec: 0, R: null, invalida: true };
  });
}

// ================= CONSUMO EN HÍBRIDO MEDIDO =================
// Lo que gasta el coche en el modo que mantiene la carga: con la batería en el
// nivel más bajo que conserva sin enchufe, toda la energía sale del depósito.
// Ese modo existe en cualquier PHEV (serie, paralelo o reparto de potencia) y
// la homologación WLTP lo define igual para todos; el nivel lo pone cada coche
// (0% en muchos, el SOC objetivo que elige el conductor en otros). La medida
// vale si la batería empieza y acaba en ese mismo nivel y no se enchufa entre
// medias. No sirven la cifra ponderada que se anuncia ni el promedio acumulado
// del ordenador de a bordo: los dos mezclan km hechos con electricidad de la red.

/**
 * En qué viene la gasolina gastada. Para la cuenta solo importa esto, no de
 * dónde sale el dato (surtidor, resumen de trayectos del coche o contador):
 * 'L':    litros (del surtidor al rellenar, o sumando el resumen de cada trayecto).
 * 'L100': L/100 km (el contador de consumo del coche, puesto a cero al empezar).
 */
export const UNIDADES_GASOLINA = ['L', 'L100'];
// La batería oscila un poco alrededor de su nivel mínimo; cuanto más largo el
// tramo, menos pesa esa oscilación en el resultado.
export const CONSUMO_KM_MIN = 50;
// Límites de credibilidad, como los de R. Gastándolo todo con gasolina, ni los
// híbridos más eficientes homologan menos de unos 4 L/100 km; por debajo de 3
// casi seguro es un promedio con km eléctricos (como el acumulado del ordenador
// de a bordo de un enchufable, que suele rondar los 1–3 L/100 km).
export const CONSUMO_MIN = 3, CONSUMO_MAX = 30;
// La batería tiene que acabar como empezó: si acaba más llena, parte de la
// gasolina se quedó guardada en ella; si acaba más vacía, parte de los km los
// pagó la batería. Se admite 1 punto de diferencia, lo mínimo que distingue el
// indicador del coche (va en % enteros). No se corrige la diferencia con una
// fórmula: haría falta suponer cuánta gasolina cuesta cada kWh que el motor
// mete en la batería, y eso depende de cada coche.
export const SOC_TOLERANCIA = 1;

/** Valida una medida del consumo en híbrido y devuelve {ok, km, litres, L, ...} o {ok:false, error}. */
export function buildFuelMeasurement({ km1, km2, valor, unidad, socIni, socFin, clima, frio }){
  const fail = error => ({ ok: false, error });
  if(UNIDADES_GASOLINA.indexOf(unidad) === -1) return fail('Indica si la gasolina va en litros o en L/100 km.');
  if(!isFinite(km1) || !isFinite(km2)) return fail('Faltan los kilómetros.');
  if(km2 <= km1) return fail('Los km del final deben ser mayores que los del principio.');
  const km = km2 - km1;
  if(km < CONSUMO_KM_MIN) return fail(`Haz al menos ${CONSUMO_KM_MIN} km: en un tramo corto pesa demasiado lo que oscila la batería.`);
  if(!isFinite(valor) || valor <= 0) return fail('Indica la gasolina gastada.');

  const litres = unidad === 'L100' ? valor * km / 100 : valor;
  const L = litres / km * 100;
  if(L < CONSUMO_MIN) return fail('Es demasiado bajo para gastarlo todo con gasolina: seguramente incluye km eléctricos. ' +
    'Empieza y acaba con la batería en su nivel mínimo, sin enchufar entre medias.');
  if(L > CONSUMO_MAX) return fail('El resultado no es creíble. Revisa los datos.');

  if(!isFinite(socIni) || !isFinite(socFin)) return fail('Indica el % de batería al empezar y al terminar.');
  if(socIni < 0 || socIni > 100 || socFin < 0 || socFin > 100) return fail('El % de batería va de 0 a 100.');
  if(Math.abs(socFin - socIni) > SOC_TOLERANCIA) return fail(
    `La batería empezó en el ${socIni}% y acabó en el ${socFin}%: ` +
    (socFin > socIni ? 'parte de la gasolina se quedó guardada en ella' : 'parte de los km los puso la batería') +
    ', y el consumo saldría falseado. Sigue conduciendo hasta que vuelva a marcar lo mismo que al empezar ' +
    `(como mucho ${SOC_TOLERANCIA} punto de diferencia).`);

  if(CLIMAS.indexOf(clima) === -1) return fail('Indica si usaste la calefacción, el aire o nada.');
  if(frio !== true && frio !== false) return fail('Indica si hizo frío esos días.');

  return { ok: true, km, litres, L, unidad, socIni, socFin, clima, frio };
}

/** Estadística del consumo medido: litros totales ÷ km totales, y la banda de los valores individuales. */
export function consumoStats(list, ahora = Date.now(), meses = MEAS_MESES){
  const s = estadistica(list, ahora, meses, m => m.L, usadas =>
    usadas.every(m => m.km > 0 && m.litres > 0)
      ? usadas.reduce((t, m) => t + m.litres, 0) / usadas.reduce((t, m) => t + m.km, 0) * 100
      : null);
  return { n: s.n, L: s.valor, cv: s.cv, band: s.band, descartadas: s.descartadas };
}

/**
 * Consumo en híbrido para una climatización, solo con sus propias medidas.
 * Igual que con R, nunca se toman prestadas las de otra: si no hay, n = 0 y
 * se usa el consumo declarado (fuente 'ninguna').
 */
export function consumoParaClima(list, clima, ahora = Date.now()){
  const grupo = (list || []).filter(m => m && m.clima === clima);
  if(grupo.length) return { ...consumoStats(grupo, ahora, MEAS_MESES), fuente: 'clima' };
  return { ...consumoStats([], ahora), fuente: 'ninguna' };
}

// ================= DESCUENTOS EN LA GASOLINA =================
// Los pone el usuario: cuánto, en qué unidad y en qué marcas (las del rótulo
// que da el Ministerio). La app no sabe qué descuentos existen ni sus
// condiciones (topes, promociones): usa lo que se le dice. A cada gasolinera se
// le aplica el mejor descuento que le corresponda; no se suman, porque que se
// puedan combinar depende de cada oferta.

/** 'cent': céntimos por litro. 'pct': porcentaje del precio del surtidor. */
export const UNIDADES_DESCUENTO = ['cent', 'pct'];
// Límites de credibilidad, para cazar erratas (50 en vez de 5, o un % en c€/L).
export const DESCUENTO_MAX = { cent: 50, pct: 30 };

/** Marcas de un texto libre («Shell, Galp») normalizadas: mayúsculas, sin tildes ni espacios sobrantes. */
export function marcasDe(texto){
  return String(texto || '').split(/[,;]/).map(normMarca).filter(Boolean);
}
function normMarca(s){
  return norm(s).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

/** ¿El rótulo es de esa marca? Por palabras enteras: «BP» no casa con «BPX». */
export function esDeMarca(rotulo, marca){
  const r = ' ' + normMarca(rotulo) + ' ', m = normMarca(marca);
  return !!m && r.indexOf(' ' + m + ' ') !== -1;
}

/** Valida un descuento escrito por el usuario. Devuelve {ok, valor, unidad, marcas} o {ok:false, error}. */
export function buildDescuento({ valor, unidad, marcas }){
  const fail = error => ({ ok: false, error });
  if(UNIDADES_DESCUENTO.indexOf(unidad) === -1) return fail('Indica si es en céntimos por litro o en %.');
  if(!isFinite(valor) || valor <= 0) return fail('Indica cuánto te descuentan.');
  if(valor > DESCUENTO_MAX[unidad]) return fail(unidad === 'cent'
    ? `Más de ${DESCUENTO_MAX.cent} céntimos por litro no es creíble. Revisa la cifra.`
    : `Más de un ${DESCUENTO_MAX.pct}% no es creíble. Revisa la cifra.`);
  const lista = marcasDe(marcas);
  if(!lista.length) return fail('Indica en qué marcas vale, como salen en la lista de gasolineras (por ejemplo, REPSOL).');
  return { ok: true, valor, unidad, marcas: lista };
}

/** Precio por litro con un descuento concreto. */
export function aplicarDescuento(precio, d){
  return d.unidad === 'pct' ? precio * (1 - d.valor / 100) : precio - d.valor / 100;
}

/**
 * Lo que pagas en una gasolinera: su precio con el mejor descuento de su marca.
 * Devuelve {precio, descuento}; descuento es null si no le corresponde ninguno.
 */
export function precioConDescuento(precio, rotulo, descuentos){
  let mejor = { precio, descuento: null };
  (descuentos || []).forEach(d => {
    if(!d || !(d.marcas || []).some(m => esDeMarca(rotulo, m))) return;
    const p = aplicarDescuento(precio, d);
    if(p < mejor.precio) mejor = { precio: p, descuento: d };
  });
  return mejor;
}
