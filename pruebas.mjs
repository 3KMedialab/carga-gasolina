// pruebas.mjs — suite de pruebas. Ejecutar con:  node pruebas.mjs
// No se despliega: es solo para desarrollo.

import { simulate, findLimitHours, measStats, buildMeasurement, rParaClima, measEnUso,
         sinClasificar, CLIMAS, MEAS_MAX, MEAS_MESES, MEAS_MESES_SIN_CLASIFICAR,
         efficiencyPenalty, taper } from './js/calculo.js';
import * as calculo from './js/calculo.js';
import { procesarPOI, pareceRecargoPorTiempo, frescura, _test as ocmTest } from './js/cargadores.js';
const { esConectorTipo2, esUsoValido, conexionOperativa, refCaducada } = ocmTest;
import { parseConsulta, provinciaDeAddress, lugaresDeNominatim, centroDeCP,
         parseEstaciones } from './js/gasolineras.js';

let pasa = 0, falla = 0;
const fallos = [];

function ok(nombre, cond, detalle = ''){
  if(cond){ pasa++; }
  else { falla++; fallos.push(nombre + (detalle ? '  ->  ' + detalle : '')); }
}
function casi(nombre, a, b, tol = 1e-9){
  ok(nombre, Math.abs(a - b) < tol, `${a} vs ${b}`);
}
function seccion(t){ console.log('\n' + t); }

// ---------- datos base ----------
const ATTO = { battery:18, maxPower:6.6, chargeEff:86, chem:'lfp' };
const base = mode => ({
  ...ATTO, mode,
  chargerPower:6.6, currentSoc:30, parkHours:1.5, sessionKwh:12, detourKm:0,
  chargerPrice:0.30, byMinute:false, pricePerMin:0, sessionFee:0,
  fuelPrice:1.744, fuelCons:5.0, elecCons:22, freeHours:0, overMin:0
});

// ================= INVARIANTES =================
seccion('Invariantes del cálculo');

['parked','trip'].forEach(m => {
  const c = base(m), r = simulate(c);
  const eff = (c.chargeEff/100) * efficiencyPenalty(Math.min(c.chargerPower, c.maxPower));
  const maxBilled = (c.fuelPrice*c.fuelCons/100)/(c.elecCons/100)*eff;
  casi(`[${m}] ahorro = margen x kWh`, r.net, (maxBilled - c.chargerPrice) * r.sessionKwh, 1e-9);
});

{
  const c = base('parked');
  const eff = (c.chargeEff/100)*efficiencyPenalty(6.6);
  c.chargerPrice = (c.fuelPrice*c.fuelCons/100)/(c.elecCons/100)*eff;
  casi('en el punto de equilibrio el ahorro es cero', simulate(c).net, 0, 1e-9);
}

// monotonía: subir el precio nunca mejora
{
  let prev = Infinity, monotono = true;
  for(let p = 0.05; p <= 0.8; p += 0.05){
    const n = simulate({ ...base('parked'), chargerPrice:p }).net;
    if(n > prev + 1e-9) monotono = false;
    prev = n;
  }
  ok('subir el precio del cargador siempre empeora', monotono);
}

// monotonía: más tiempo nunca da menos kWh
{
  let prev = -1, monotono = true;
  for(let h = 0.25; h <= 8; h += 0.25){
    const k = simulate({ ...base('parked'), parkHours:h }).sessionKwh;
    if(k < prev - 1e-9) monotono = false;
    prev = k;
  }
  ok('más tiempo aparcado nunca carga menos', monotono);
}

// monotonía: más batería inicial, menos que cargar
{
  let prev = Infinity, monotono = true;
  for(let s = 10; s <= 95; s += 5){
    const k = simulate({ ...base('parked'), currentSoc:s, parkHours:8 }).sessionKwh;
    if(k > prev + 1e-9) monotono = false;
    prev = k;
  }
  ok('más batería al empezar, menos que cargar', monotono);
}

// ================= LÍMITES FÍSICOS =================
seccion('Límites físicos');

{
  let sobrepasa = false;
  for(let s = 0; s <= 100; s += 10)
    for(const h of [0.5, 2, 6, 12])
      if(simulate({ ...base('parked'), currentSoc:s, parkHours:h }).finalSoc > 100.0001) sobrepasa = true;
  ok('la batería nunca pasa del 100%', !sobrepasa);
}

{
  const r = simulate({ ...base('parked'), currentSoc:100 });
  ok('batería llena: no carga nada', r.nothingToCharge && r.sessionKwh <= 0.001);
}

{
  const r = simulate({ ...base('parked'), currentSoc:100, sessionFee:1 });
  ok('batería llena con tarifa fija: se pierde dinero', r.net < 0, `net=${r.net}`);
}

{
  const a = simulate({ ...base('parked'), chargerPower:22 });
  const b = simulate({ ...base('parked'), chargerPower:6.6 });
  ok('cargador más potente que el coche no aumenta los kWh', Math.abs(a.sessionKwh-b.sessionKwh) < 1e-9);
  ok('y avisa de que se ha topado', a.powerCapped === true);
}

{
  const lento = simulate({ ...base('parked'), chargerPower:2.3, maxPower:6.6 });
  ok('a baja potencia baja la eficiencia', lento.effReduced === true && lento.eff < 0.86);
}

{
  const r = simulate({ ...base('trip'), currentSoc:80, sessionKwh:15 });
  ok('no se puede cargar más de lo que cabe', r.capped === true && r.sessionKwh < 15);
}

// valores absurdos no deben producir NaN
{
  let malo = false;
  const raros = [0, -5, 1e9];
  for(const v of raros){
    const r = simulate({ ...base('parked'), battery:v, chargerPower:v, elecCons:v, fuelCons:v });
    for(const k in r) if(typeof r[k] === 'number' && !isFinite(r[k])) malo = true;
  }
  ok('valores absurdos no producen NaN ni Infinity', !malo);
}

// ================= QUÍMICA Y CURVA =================
seccion('Química de la batería');

ok('LFP frena más arriba que NMC', taper('lfp').knee > taper('nmc').knee);

{
  const bajo = c => simulate({ ...base('parked'), chem:c, currentSoc:30, parkHours:1 });
  ok('por debajo del codo las químicas coinciden',
    Math.abs(bajo('lfp').sessionKwh - bajo('nmc').sessionKwh) < 1e-9);
}
{
  // El cruce entre curvas (antes fijo en ~85%) solo se da tal cual a la
  // tasa C de referencia (cargador tan potente como la batería, 1C).
  // Se fuerza aquí con battery = maxPower para aislar el efecto.
  const altoC = (c, soc) => simulate({
    ...base('parked'), battery:6.6, chem:c, currentSoc:soc, parkHours:4
  });
  ok('a 1C, bajo el cruce la NMC tarda más que la LFP',
    altoC('nmc', 70).chargeHours > altoC('lfp', 70).chargeHours + 0.01);
  ok('a 1C, sobre el cruce la LFP tarda más que la NMC',
    altoC('lfp', 92).chargeHours > altoC('nmc', 92).chargeHours + 0.01);
  ok('a 1C, los kWh cargados no dependen de la química',
    Math.abs(altoC('lfp', 70).sessionKwh - altoC('nmc', 70).sessionKwh) < 1e-9);
}
{
  // Caso real de un enchufable en AC: el ATTO base carga a 6,6kW/18kWh =
  // 0,37C. A una tasa tan baja, la química ya casi no cambia el tiempo.
  const bajoC = c => simulate({ ...base('parked'), chem:c, currentSoc:70, parkHours:4 });
  const dif = Math.abs(bajoC('lfp').chargeHours - bajoC('nmc').chargeHours);
  ok('a 0,37C (caso real de carga en AC), LFP y NMC casi no se diferencian',
    dif < 0.02, `dif=${dif}h`);
}
{
  // Ancla del modelo: a la tasa de referencia, taper(chem, cRate) debe
  // coincidir con taper(chem) sin tasa C (el comportamiento de siempre).
  const a = taper('lfp', 1), b = taper('lfp');
  ok('a la tasa de referencia el taper coincide con el calibrado por química',
    Math.abs(a.knee - b.knee) < 1e-9 && Math.abs(a.slow - b.slow) < 1e-9);
}
{
  // Bajar la tasa C nunca debe adelantar el knee ni acentuar la frenada.
  let prevKnee = Infinity, prevSlow = -Infinity, monotono = true;
  for(let c = 0.05; c <= 1.2; c += 0.05){
    const { knee, slow } = taper('lfp', c);
    if(knee > prevKnee + 1e-9) monotono = false;
    if(slow < prevSlow - 1e-9) monotono = false;
    prevKnee = knee; prevSlow = slow;
  }
  ok('a más tasa C, el knee no sube y el frenazo no se suaviza', monotono);
}

// ================= RECARGA REAL DE REFERENCIA =================
seccion('Recarga real (Atto 2 DM-i Boost, 18kWh / 6,6kW AC / LFP)');

{
  // Medida en un cargador de 45kW, coche solo (sin repartir potencia con
  // otro vehículo): 82% → 100% en 39 min, 3,932 kWh facturados según el
  // punto de carga. Ancla el modelo (taper por tasa C incluido) a un
  // caso real, no solo a invariantes teóricos.
  const real = simulate({
    ...base('parked'), chargerPower:45, currentSoc:82, parkHours:39/60
  });
  ok('llega al 100% en los 39 min, como en la recarga real',
    real.finalSoc > 99.9, `finalSoc=${real.finalSoc}`);
  ok('los kWh previstos están a menos del 10% de los 3,932 kWh reales',
    Math.abs(real.sessionKwh - 3.932) / 3.932 < 0.10, `previsto=${real.sessionKwh}`);
  ok('el tiempo previsto está a menos del 10% de los 39 min reales',
    Math.abs(real.chargeHours * 60 - 39) / 39 < 0.10,
    `previsto=${(real.chargeHours * 60).toFixed(1)}min`);
}

// ================= CLIMATIZACIÓN =================
seccion('Climatización: R medido por grupo, sin factores estimados');

{
  ok('ya no hay factores estimados de ciudad, carretera ni frío',
     calculo.PRESET_FACTORS === undefined && calculo.COLD_EFF === undefined);
  ok('las tres climatizaciones', CLIMAS.join(',') === 'calefaccion,aire,nada');

  const DIA = 86400000, AHORA = Date.parse('2026-11-02T12:00:00Z');
  const hace = d => new Date(AHORA - d * DIA).toISOString();
  const med = (R, clima, dias = 1, extra = {}) => ({ id: clima + R + dias, R, clima, frio: false, date: hace(dias), ...extra });

  const lista = [med(3.2, 'calefaccion'), med(3.4, 'calefaccion'), med(4.6, 'nada'), med(4.8, 'nada'), med(4.4, 'aire')];
  const cal = rParaClima(lista, 'calefaccion', AHORA);
  ok('con calefacción solo usa las medidas con calefacción', cal.fuente === 'clima' && cal.n === 2);
  casi('...y su R es la media de esas dos', cal.R, 3.3, 1e-9);
  casi('sin climatización, solo las suyas', rParaClima(lista, 'nada', AHORA).R, 4.7, 1e-9);
  ok('una sola medida con aire: se usa, con la banda de una medida (15%)',
     rParaClima(lista, 'aire', AHORA).n === 1 && rParaClima(lista, 'aire', AHORA).band === 0.15);

  // nunca se toman prestadas medidas de otra climatización
  const soloVerano = [med(4.6, 'nada'), med(4.4, 'aire')];
  const sinCal = rParaClima(soloVerano, 'calefaccion', AHORA);
  ok('sin medidas con calefacción no se usan las de verano: consumo declarado, ±30%',
     sinCal.fuente === 'ninguna' && sinCal.n === 0 && sinCal.R === null && sinCal.band === 0.30);

  // las medidas sin clasificar solo cuentan si no hay nada mejor
  const viejas = [{ id:'v1', R:4.0, clima:null, date: hace(10) }, { id:'v2', R:4.2, date: hace(20) }];
  ok('sinClasificar: clima null, ausente o desconocido',
     sinClasificar({ clima:null }) && sinClasificar({}) && sinClasificar({ clima:'mixto' }) && !sinClasificar({ clima:'aire' }));
  const r1 = rParaClima(viejas, 'calefaccion', AHORA);
  ok('sin medidas del grupo, usa las sin clasificar y lo dice',
     r1.fuente === 'sin-clasificar' && r1.n === 2, JSON.stringify(r1));
  const r2 = rParaClima([...viejas, med(3.0, 'calefaccion')], 'calefaccion', AHORA);
  ok('en cuanto hay una del grupo, las sin clasificar dejan de contar',
     r2.fuente === 'clima' && r2.n === 1 && r2.R === 3.0);

  // ventanas: 12 meses por grupo, 6 para las sin clasificar
  ok('ventana de 12 meses por grupo, 6 sin clasificar', MEAS_MESES === 12 && MEAS_MESES_SIN_CLASIFICAR === 6);
  const deHaceUnAnio = [med(3.0, 'calefaccion', 300), med(3.1, 'calefaccion', 400)];
  ok('una medida con calefacción de hace 10 meses sigue contando; la de hace 13, no',
     rParaClima(deHaceUnAnio, 'calefaccion', AHORA).n === 1 &&
     rParaClima(deHaceUnAnio, 'calefaccion', AHORA).R === 3.0);
  const viejaSin = [{ id:'a', R:4.0, clima:null, date: hace(200) }, { id:'b', R:4.4, clima:null, date: hace(30) }];
  ok('una sin clasificar de hace 7 meses ya no cuenta',
     rParaClima(viejaSin, 'nada', AHORA).n === 1 && rParaClima(viejaSin, 'nada', AHORA).R === 4.4);

  // hasta 8 por grupo, cada grupo por su cuenta
  const muchas = [
    ...Array.from({ length: 10 }, (_, i) => med(3 + i * 0.01, 'calefaccion', 20 - i)),
    ...Array.from({ length: 10 }, (_, i) => med(4.5 + i * 0.01, 'nada', 20 - i))
  ];
  ok('como mucho 8 por grupo', MEAS_MAX === 8 &&
     rParaClima(muchas, 'calefaccion', AHORA).n === 8 && rParaClima(muchas, 'nada', AHORA).n === 8);
  ok('las medidas de un grupo no desplazan a las del otro',
     rParaClima(muchas, 'calefaccion', AHORA).descartadas === 2 && rParaClima(muchas, 'nada', AHORA).descartadas === 2);
  ok('measEnUso: 8 + 8, las 2 más antiguas de cada grupo quedan fuera',
     measEnUso(muchas, AHORA).size === 16 && !measEnUso(muchas, AHORA).has(muchas[0].id));

  // el frío se guarda pero todavía no separa grupos
  const conFrio = [med(3.0, 'nada', 1, { frio: true }), med(4.0, 'nada', 2, { frio: false })];
  ok('el frío no separa grupos (todavía): mismo grupo con y sin frío',
     rParaClima(conFrio, 'nada', AHORA).n === 2);

  // de la medida al cálculo: más consumo con calefacción => menos km y menos ahorro
  const eff = base('parked').chargeEff;
  const kmCal  = simulate({ ...base('parked'), elecCons: eff / cal.R }).km;
  const kmNada = simulate({ ...base('parked'), elecCons: eff / rParaClima(lista, 'nada', AHORA).R }).km;
  ok('con el R medido con calefacción salen menos km que sin climatización', kmCal < kmNada,
     `${kmCal.toFixed(1)} vs ${kmNada.toFixed(1)}`);

  // km por climatización (los botones): los mismos que daría simulate()
  const sim = simulate({ ...base('parked'), elecCons: eff / cal.R });
  const kpc = calculo.kmPorClima(sim.energyIn, lista, eff, AHORA);
  casi('kmPorClima coincide con simulate() para la climatización medida', kpc.calefaccion, sim.km, 1e-9);
  ok('kmPorClima: sin medidas propias -> null, nunca estimado',
     calculo.kmPorClima(sim.energyIn, soloVerano, eff, AHORA).calefaccion === null);
  ok('kmPorClima: sin energía (batería llena) -> null',
     calculo.kmPorClima(0, lista, eff, AHORA).nada === null);
}

// ================= RECARGO POR TIEMPO =================
seccion('Recargo por exceso de tiempo');

{
  const merc = { ...base('parked'), chargerPrice:0.25, chargerPower:7.4, freeHours:1.5, overMin:0.07 };
  ok('sin pasarse no hay recargo', simulate({ ...merc, parkHours:1.5 }).overCost === 0);
  ok('pasándose sí hay recargo',   simulate({ ...merc, parkHours:2 }).overCost > 0);
  ok('con mucho tiempo se pierde dinero', simulate({ ...merc, parkHours:4 }).net < 0);

  const lim = findLimitHours(merc);
  ok('existe una hora límite', lim !== null, String(lim));
  if(lim !== null){
    ok('justo antes del límite compensa', simulate({ ...merc, parkHours:lim-0.05 }).net >= 0);
    ok('justo después ya no',             simulate({ ...merc, parkHours:lim }).net < 0);
  }
  ok('sin recargo no hay hora límite', findLimitHours({ ...merc, overMin:0 }) === null);
}

// ================= TARIFA POR MINUTO =================
seccion('Tarifa por minuto');

{
  const porMin = { ...base('parked'), byMinute:true, pricePerMin:0.10, parkHours:2 };
  const r = simulate(porMin);
  ok('paga por minuto, no por energía', r.energyCost > 0 && Math.abs(r.energyCost - 0.30*r.sessionKwh) > 0.5);
  ok('el equivalente por kWh es muy caro', r.effectivePerKwh > 0.6, String(r.effectivePerKwh));

  const lento = simulate({ ...porMin, chargerPower:3.3, maxPower:3.3 });
  ok('cargar más despacio sale más caro por kWh', lento.effectivePerKwh > r.effectivePerKwh);
}

// ================= MEDICIONES =================
seccion('Mediciones reales');

{
  const CL = { clima:'nada', frio:false };
  const m = buildMeasurement({ km1:0, km2:250, kwh:64, litres:0, fuelCons:5, ...CL });
  ok('medición válida se acepta', m.ok);
  casi('R = km / kWh', m.R, 250/64, 1e-9);
  ok('devuelve la climatización y el frío', m.clima === 'nada' && m.frio === false);

  ok('rechaza km al revés',      !buildMeasurement({ km1:250, km2:0, kwh:64, litres:0, fuelCons:5, ...CL }).ok);
  ok('rechaza sin kWh',          !buildMeasurement({ km1:0, km2:250, kwh:0, litres:0, fuelCons:5, ...CL }).ok);
  ok('rechaza demasiada gasolina',!buildMeasurement({ km1:0, km2:250, kwh:64, litres:9, fuelCons:5, ...CL }).ok);
  ok('rechaza R imposible',      !buildMeasurement({ km1:0, km2:250, kwh:5, litres:0, fuelCons:5, ...CL }).ok);

  const sinClima = buildMeasurement({ km1:0, km2:250, kwh:64, litres:0, fuelCons:5, frio:false });
  ok('rechaza sin climatización, con su mensaje', !sinClima.ok && sinClima.error.includes('calefacción'));
  ok('rechaza una climatización desconocida',
     !buildMeasurement({ km1:0, km2:250, kwh:64, litres:0, fuelCons:5, clima:'mixto', frio:false }).ok);
  const sinFrio = buildMeasurement({ km1:0, km2:250, kwh:64, litres:0, fuelCons:5, clima:'aire' });
  ok('rechaza sin indicar si hizo frío', !sinFrio.ok && sinFrio.error.includes('frío'));
  ok('acepta frío = true', buildMeasurement({ km1:0, km2:250, kwh:64, litres:0, fuelCons:5,
     clima:'calefaccion', frio:true }).frio === true);

  const conGas = buildMeasurement({ km1:0, km2:250, kwh:50, litres:3, fuelCons:5, ...CL });
  ok('descuenta los km hechos con gasolina', conGas.ok && conGas.kmElec === 250 - 60);
}

{
  ok('sin medidas, banda del 30%', measStats([]).band === 0.30);
  ok('con una medida, banda del 15%', measStats([{R:3.9}]).band === 0.15);
  const tres = measStats([{R:3.8},{R:3.9},{R:4.0}]);
  ok('con tres medidas la banda se estrecha', tres.band < 0.15, String(tres.band));
  const ocho = measStats(Array.from({length:8}, (_,i) => ({ R: 3.9 + (i%2?0.1:-0.1) })));
  ok('con ocho medidas se estrecha aún más', ocho.band < tres.band);
  casi('R medio correcto', measStats([{R:3},{R:5}]).R, 4, 1e-9);
  // Con km y kWh, R = km totales ÷ kWh totales: la recarga grande pesa más.
  casi('R ponderado por kWh (2 kWh a R=3 y 12 kWh a R=5)',
       measStats([{R:3, kmElec:6, kwh:2}, {R:5, kmElec:60, kwh:12}]).R, 66/14, 1e-9);
  casi('una sola medida con kWh da su propio R',
       measStats([{R:3.9, kmElec:39, kwh:10}]).R, 3.9, 1e-9);
  casi('si a alguna medida le faltan los kWh, media simple',
       measStats([{R:3, kmElec:6, kwh:2}, {R:5}]).R, 4, 1e-9);
  {
    const sin = measStats([{R:3},{R:5}]);
    const con = measStats([{R:3, kmElec:6, kwh:2}, {R:5, kmElec:60, kwh:12}]);
    ok('ponderar no cambia la banda', con.band === sin.band && con.cv === sin.cv);
  }

  // Con pocas medidas la banda usa la t de Student, no la normal (1,645):
  // con dos medidas el valor crítico es 6,31, casi cuatro veces mayor.
  const dos = measStats([{R:6.33},{R:6.71}]);
  casi('con dos medidas la banda usa la t de Student (6,314)',
       dos.band, 6.314 * dos.cv / Math.sqrt(2), 1e-9);
  ok('con dos medidas la banda es mucho mayor que con la normal',
     dos.band > 3 * (1.645 * dos.cv / Math.sqrt(2)));
  ok('dos medidas reales (6,33 y 6,71) dan alrededor de ±18%',
     Math.abs(dos.band - 0.184) < 0.005, String(dos.band));
  // Con exactamente dos medidas la banda nunca baja de la de una sola (15 %):
  // si coinciden casi exactamente, la t de Student daría ~0 % por pura casualidad.
  ok('dos medidas casi idénticas (6,706 y 6,714) no bajan de ±15%',
     measStats([{R:6.706},{R:6.714}]).band === 0.15,
     String(measStats([{R:6.706},{R:6.714}]).band));
  ok('dos medidas idénticas tampoco bajan de ±15%',
     measStats([{R:6.5},{R:6.5}]).band === 0.15);
  ok('con tres medidas casi idénticas el suelo ya no se aplica',
     measStats([{R:6.706},{R:6.710},{R:6.714}]).band < 0.01);
  const tresReales = measStats([{R:6.33},{R:6.52},{R:6.71}]);
  ok('una tercera medida estrecha mucho la banda', tresReales.band < dos.band / 2,
     `${tresReales.band} vs ${dos.band}`);
  {
    let prev = Infinity, baja = true;
    for(let n = 2; n <= 8; n++){
      const b = measStats(Array.from({length:n}, (_,i) => ({ R: 3.9 + (i%2 ? 0.1 : -0.1) }))).band;
      if(b >= prev) baja = false;
      prev = b;
    }
    ok('la banda baja siempre al sumar medidas, de 2 a 8', baja);
  }
}

// ================= CONSUMO EN HÍBRIDO MEDIDO =================
seccion('Consumo en híbrido medido (vale para cualquier PHEV)');

{
  const { buildFuelMeasurement, consumoStats, consumoParaClima, medidasConConsumo,
          METODOS_CONSUMO, CONSUMO_KM_MIN, CONSUMO_MIN } = calculo;
  const CL = { clima:'nada', frio:false };

  ok('dos métodos: contador y depósito', METODOS_CONSUMO.join(',') === 'contador,deposito');
  const cont = buildFuelMeasurement({ km1:1000, km2:1200, metodo:'contador', valor:5.4, ...CL });
  ok('contador: se acepta', cont.ok, cont.error);
  casi('contador: los litros salen del L/100km y los km', cont.litres, 10.8, 1e-9);
  casi('contador: el consumo es el que marca', cont.L, 5.4, 1e-9);
  const dep = buildFuelMeasurement({ km1:0, km2:250, metodo:'deposito', valor:12.5, ...CL });
  casi('depósito: litros ÷ km × 100', dep.L, 5, 1e-9);
  ok('devuelve método, climatización y frío', dep.metodo === 'deposito' && dep.clima === 'nada' && dep.frio === false);

  ok('rechaza sin método', !buildFuelMeasurement({ km1:0, km2:250, valor:12.5, ...CL }).ok);
  ok('rechaza km al revés', !buildFuelMeasurement({ km1:250, km2:0, metodo:'deposito', valor:12.5, ...CL }).ok);
  const corto = buildFuelMeasurement({ km1:0, km2:CONSUMO_KM_MIN - 1, metodo:'contador', valor:5, ...CL });
  ok(`rechaza menos de ${CONSUMO_KM_MIN} km, explicando por qué`, !corto.ok && corto.error.includes('oscila'), corto.error);
  ok('rechaza sin consumo o sin litros', !buildFuelMeasurement({ km1:0, km2:250, metodo:'contador', valor:0, ...CL }).ok);
  // el promedio acumulado de un enchufable (aquí 2,5) mezcla km eléctricos: no es el consumo en híbrido
  const acumulado = buildFuelMeasurement({ km1:0, km2:3000, metodo:'contador', valor:2.5, ...CL });
  ok(`rechaza menos de ${CONSUMO_MIN} L/100km: es un promedio con km eléctricos`,
     !acumulado.ok && acumulado.error.includes('km eléctricos'), acumulado.error);
  ok('rechaza un consumo imposible', !buildFuelMeasurement({ km1:0, km2:100, metodo:'deposito', valor:40, ...CL }).ok);
  ok('rechaza sin climatización', !buildFuelMeasurement({ km1:0, km2:250, metodo:'deposito', valor:12.5, frio:false }).ok);
  ok('rechaza sin indicar si hizo frío', !buildFuelMeasurement({ km1:0, km2:250, metodo:'deposito', valor:12.5, clima:'aire' }).ok);

  // estadística: litros totales ÷ km totales, el tramo largo pesa más
  casi('consumo ponderado por km (100 km a 5 y 300 km a 6)',
       consumoStats([{ km:100, litres:5, L:5 }, { km:300, litres:18, L:6 }]).L, 23 / 400 * 100, 1e-9);
  ok('sin medidas, banda del 30%', consumoStats([]).band === 0.30 && consumoStats([]).L === null);
  ok('con una medida, banda del 15%', consumoStats([{ km:200, litres:10, L:5 }]).band === 0.15);

  // por climatización, sin tomar prestadas las de otra
  const hoy = new Date().toISOString();
  const lista = [{ id:'a', date:hoy, km:200, litres:10, L:5, clima:'nada' },
                 { id:'b', date:hoy, km:200, litres:12, L:6, clima:'calefaccion' }];
  casi('con calefacción, solo su medida', consumoParaClima(lista, 'calefaccion').L, 6, 1e-9);
  ok('con aire y sin medidas suyas: declarado (fuente ninguna), nunca prestado',
     consumoParaClima(lista, 'aire').fuente === 'ninguna' && consumoParaClima(lista, 'aire').L === null);
  ok('una medida antigua sin climatización no tiene grupo: declarado', consumoParaClima(lista, null).fuente === 'ninguna');

  // las medidas de R se recalculan con el consumo en híbrido de ahora
  const conGas = buildMeasurement({ km1:0, km2:250, kwh:50, litres:3, fuelCons:5, ...CL });
  const guardada = { id:'m1', date:hoy, km:conGas.km, kmElec:conGas.kmElec, kwh:50, litres:3, R:conGas.R, clima:'nada' };
  casi('R guardado con 5 L/100km: (250 − 60) ÷ 50', guardada.R, 3.8, 1e-9);
  const [rehecha] = medidasConConsumo([guardada], () => 6);
  casi('con 6 L/100km, 3 L son 50 km: (250 − 50) ÷ 50 = 4,0', rehecha.R, 4.0, 1e-9);
  ok('...y no toca lo guardado', guardada.R === 3.8);
  casi('con el mismo consumo, el mismo R', medidasConConsumo([guardada], () => 5)[0].R, 3.8, 1e-9);
  const sinLitros = { id:'m2', date:hoy, km:250, kmElec:250, kwh:64, litres:0, R:250/64, clima:'nada' };
  ok('sin litros no cambia nada', medidasConConsumo([sinLitros], () => 6)[0] === sinLitros);
  ok('una medida antigua sin km ni kWh se queda como estaba',
     medidasConConsumo([{ id:'x', R:4.1 }], () => 6)[0].R === 4.1);
  // 3 L a 2,5 L/100km serían 120 km de 250: casi la mitad con gasolina; a 2 son 150 km, más de la mitad
  const invalida = medidasConConsumo([guardada], () => 2)[0];
  ok('si con el consumo nuevo ya no vale, queda marcada y sin R', invalida.invalida === true && invalida.R === null);
  ok('...y no cuenta para R ni para «en uso»',
     rParaClima([invalida], 'nada').fuente === 'ninguna' && measEnUso([invalida]).size === 0);
  const porClima = medidasConConsumo([guardada, { ...guardada, id:'m3', clima:'calefaccion' }],
    c => c === 'calefaccion' ? 6 : 5);
  ok('cada medida usa el consumo de su climatización', porClima[0].R === 3.8 && Math.abs(porClima[1].R - 4.0) < 1e-9);

  // sin medir, el error se nota en el veredicto: con 2,5 la gasolina parece la mitad de barata
  const bajo = simulate({ ...base('parked'), fuelCons:2.5 }), real = simulate({ ...base('parked'), fuelCons:5.1 });
  ok('con el promedio acumulado (2,5) el ahorro sale mucho menor que con el de verdad (5,1)',
     bajo.net < real.net && bajo.equivFuel < real.equivFuel / 2 + 1e-9, `${bajo.net.toFixed(2)} vs ${real.net.toFixed(2)}`);
}

// ================= CARGA EN CASA =================
seccion('Carga en casa: comparar con casa en vez de con la gasolina');

{
  const { costeEnCasa, buildCasa } = calculo;
  const pub = { ...base('parked'), chargerPrice:0.30 };   // 6,6 kW, eficiencia 86 %
  const sinCasa = simulate(pub);
  ok('sin casa, como siempre: frente a la gasolina', sinCasa.vs === 'gasolina' && sinCasa.altCost === sinCasa.equivFuel &&
     sinCasa.homeCost === 0);

  // wallbox de 7,4 kW: el coche la limita a 6,6, sin pérdidas de más -> mismos kWh facturados que aquí
  const wallbox = { precio:0.12, potencia:7.4 };
  const conCasa = simulate({ ...pub, casa: wallbox });
  ok('con casa: se compara con casa', conCasa.vs === 'casa' && conCasa.altCost === conCasa.homeCost);
  casi('misma energía en casa a la misma eficiencia: kWh × precio de casa', conCasa.homeCost, conCasa.sessionKwh * 0.12, 1e-9);
  casi('ahorro = casa − aquí', conCasa.net, conCasa.sessionKwh * (0.12 - 0.30), 1e-9);
  ok('público a 0,30 frente a casa a 0,12: no compensa, aunque frente a la gasolina sí',
     conCasa.net < 0 && sinCasa.net > 0, `${conCasa.net.toFixed(2)} / ${sinCasa.net.toFixed(2)}`);
  ok('la energía y los km no cambian: solo la alternativa', conCasa.energyIn === sinCasa.energyIn && conCasa.km === sinCasa.km);

  // con un enchufe normal se pierde más: meter la misma energía cuesta más kWh
  const schuko = simulate({ ...pub, casa: { precio:0.12, potencia:2.3 } });
  casi('enchufe de 2,3 kW: pierde un 18 % más (penalización 0,82)', schuko.homeCost, conCasa.homeCost / 0.82, 1e-9);
  casi('costeEnCasa coincide con simulate()', costeEnCasa(conCasa.energyIn, wallbox, pub.chargeEff, pub.maxPower), conCasa.homeCost, 1e-9);
  ok('sin energía, sin coste en casa', costeEnCasa(0, wallbox, 86, 6.6) === 0);

  ok('un público más barato que casa sí compensa', simulate({ ...pub, chargerPrice:0.08, casa: wallbox }).net > 0);
  const gratis = simulate({ ...pub, chargerPrice:0, casa: wallbox });
  casi('gratis frente a casa: te ahorras lo que costaría en casa', gratis.net, gratis.homeCost, 1e-9);

  // el desvío son km de más: se sigue valorando en gasolina
  const viaje = { ...base('trip'), detourKm:3, chargerPrice:0.30 };
  ok('el desvío cuesta lo mismo con y sin casa',
     simulate({ ...viaje, casa: wallbox }).detourCost === simulate(viaje).detourCost && simulate(viaje).detourCost > 0);

  // la hora límite del recargo también es frente a casa: llega antes, porque casa es más barata que la gasolina
  const merc = { ...base('parked'), chargerPrice:0.05, chargerPower:7.4, freeHours:1.5, overMin:0.07 };
  const limG = findLimitHours(merc), limC = findLimitHours({ ...merc, casa: wallbox });
  ok('con casa, el recargo se come el ahorro antes', limG !== null && limC !== null && limC < limG, `${limC} vs ${limG}`);

  // validación
  ok('casa válida', buildCasa({ precio:0.12, potencia:2.3 }).ok);
  ok('casa gratis (placas solares) también vale', buildCasa({ precio:0, potencia:7.4 }).ok);
  ok('rechaza sin precio o negativo', !buildCasa({ precio:NaN, potencia:2.3 }).ok && !buildCasa({ precio:-1, potencia:2.3 }).ok);
  ok('rechaza más de 1 €/kWh (errata)', !buildCasa({ precio:12, potencia:2.3 }).ok);
  ok('rechaza sin potencia o de más de 22 kW', !buildCasa({ precio:0.12, potencia:0 }).ok && !buildCasa({ precio:0.12, potencia:50 }).ok);
}

// ================= DESCUENTOS EN LA GASOLINA =================
seccion('Descuentos en la gasolina');

{
  const { buildDescuento, precioConDescuento, aplicarDescuento, esDeMarca, marcasDe,
          UNIDADES_DESCUENTO, DESCUENTO_MAX } = calculo;

  ok('dos unidades: céntimos por litro y %', UNIDADES_DESCUENTO.join(',') === 'cent,pct');
  ok('marcas: separadas por comas, en mayúsculas y sin tildes',
     marcasDe(' shell, Galp ;  ') .join('|') === 'SHELL|GALP');
  ok('la marca casa con el rótulo por palabras enteras',
     esDeMarca('REPSOL', 'repsol') && esDeMarca('E.S. Repsol Butano', 'REPSOL') && esDeMarca('GALP', 'galp'));
  ok('...y no por trozos: «BP» no casa con «BPX» ni con «SHELL»',
     !esDeMarca('BPX', 'BP') && !esDeMarca('SHELL', 'BP') && esDeMarca('BP OIL', 'BP'));
  ok('sin marca no casa nada', !esDeMarca('REPSOL', ''));

  // validación
  const waylet = buildDescuento({ valor:5, unidad:'cent', marcas:'Repsol' });
  ok('céntimos por litro: se acepta', waylet.ok && waylet.marcas[0] === 'REPSOL', waylet.error);
  const ing = buildDescuento({ valor:3, unidad:'pct', marcas:'Shell, Galp' });
  ok('porcentaje en varias marcas: se acepta', ing.ok && ing.marcas.length === 2, ing.error);
  ok('rechaza sin unidad', !buildDescuento({ valor:5, marcas:'REPSOL' }).ok);
  ok('rechaza sin cantidad', !buildDescuento({ valor:0, unidad:'cent', marcas:'REPSOL' }).ok);
  ok('rechaza sin marcas, explicando cómo escribirlas',
     !buildDescuento({ valor:5, unidad:'cent', marcas:' , ' }).ok &&
     buildDescuento({ valor:5, unidad:'cent', marcas:'' }).error.includes('REPSOL'));
  ok(`rechaza cantidades no creíbles (más de ${DESCUENTO_MAX.cent} c€/L o del ${DESCUENTO_MAX.pct}%)`,
     !buildDescuento({ valor:60, unidad:'cent', marcas:'REPSOL' }).ok &&
     !buildDescuento({ valor:40, unidad:'pct', marcas:'SHELL' }).ok);

  // cuentas
  casi('5 c€/L sobre 1,529: 1,479', aplicarDescuento(1.529, waylet), 1.479, 1e-9);
  casi('3 % sobre 1,600: 1,552', aplicarDescuento(1.600, ing), 1.552, 1e-9);

  const mios = [waylet, ing];
  const enRepsol = precioConDescuento(1.529, 'REPSOL', mios);
  ok('en una Repsol se aplica el suyo', enRepsol.descuento === waylet && Math.abs(enRepsol.precio - 1.479) < 1e-9);
  const enGalp = precioConDescuento(1.600, 'GALP', mios);
  ok('en una Galp, el %', enGalp.descuento === ing && Math.abs(enGalp.precio - 1.552) < 1e-9);
  const enBp = precioConDescuento(1.500, 'BP', mios);
  ok('sin descuento de su marca: el precio del surtidor y descuento null', enBp.precio === 1.5 && enBp.descuento === null);
  ok('sin descuentos guardados, tampoco', precioConDescuento(1.5, 'REPSOL', []).descuento === null &&
     precioConDescuento(1.5, 'REPSOL', undefined).precio === 1.5);

  // dos que coinciden: el mejor, nunca la suma
  const dos = [{ valor:5, unidad:'cent', marcas:['REPSOL'] }, { valor:4, unidad:'pct', marcas:['REPSOL'] }];
  const mejor = precioConDescuento(1.500, 'REPSOL', dos);
  casi('dos descuentos en la misma marca: el mejor (4 % de 1,50 = 6 c€ > 5 c€)', mejor.precio, 1.44, 1e-9);
  ok('...y no se suman', mejor.precio > 1.500 - 0.05 - 0.06);

  // en el cálculo: el descuento abarata la gasolina y cargar compensa algo menos
  const sin = simulate({ ...base('parked'), fuelPrice:1.529 });
  const con = simulate({ ...base('parked'), fuelPrice:1.479 });
  ok('con el descuento, el ahorro de cargar baja', con.net < sin.net, `${con.net.toFixed(2)} vs ${sin.net.toFixed(2)}`);
}

// ================= CARGADORES PÚBLICOS (OCM) =================
seccion('Cargadores públicos (OCM)');

// Los 43 conectores y 8 usos reales de la respuesta de /v3/referencedata
// que se comprobó a mano en la conversación de diseño.
const CONECTORES_REALES = [
  {ID:7,Title:'Avcon Connector'},{ID:4,Title:'Blue Commando (2P+E)'},
  {ID:3,Title:'BS1363 3 Pin 13 Amp'},{ID:32,Title:'CCS (Type 1)'},
  {ID:33,Title:'CCS (Type 2)'},{ID:16,Title:'CEE 3 Pin'},{ID:17,Title:'CEE 5 Pin'},
  {ID:28,Title:'CEE 7/4 - Schuko - Type F'},{ID:23,Title:'CEE 7/5'},
  {ID:18,Title:'CEE+ 7 Pin'},{ID:2,Title:'CHAdeMO'},
  {ID:1044,Title:'ChaoJi / CHAdeMO 3.x'},{ID:13,Title:'Europlug 2-Pin (CEE 7/16)'},
  {ID:1038,Title:'GB-T AC - GB/T 20234.2 (Socket)'},
  {ID:1039,Title:'GB-T AC - GB/T 20234.2 (Tethered Cable)'},
  {ID:1040,Title:'GB-T DC - GB/T 20234.3'},{ID:34,Title:'IEC 60309 3-pin'},
  {ID:35,Title:'IEC 60309 5-pin'},{ID:5,Title:'LP Inductive'},
  {ID:27,Title:'NACS / Tesla Supercharger'},{ID:10,Title:'NEMA 14-30'},
  {ID:11,Title:'NEMA 14-50'},{ID:22,Title:'NEMA 5-15R'},{ID:9,Title:'NEMA 5-20R'},
  {ID:15,Title:'NEMA 6-15'},{ID:14,Title:'NEMA 6-20'},{ID:1042,Title:'NEMA TT-30R'},
  {ID:36,Title:'SCAME Type 3A (Low Power)'},
  {ID:26,Title:'SCAME Type 3C (Schneider-Legrand)'},{ID:6,Title:'SP Inductive'},
  {ID:1037,Title:'T13 - SEC1011 ( Swiss domestic 3-pin ) - Type J'},
  {ID:30,Title:'Tesla (Model S/X)'},{ID:8,Title:'Tesla (Roadster)'},
  {ID:31,Title:'Tesla Battery Swap'},{ID:1041,Title:'Three Phase 5-Pin (AS/NZ 3123)'},
  {ID:1,Title:'Type 1 (J1772)'},{ID:25,Title:'Type 2 (Socket Only)'},
  {ID:1036,Title:'Type 2 (Tethered Connector) '},{ID:29,Title:'Type I (AS 3112)'},
  {ID:1043,Title:'Type M'},{ID:0,Title:'Unknown'},{ID:24,Title:'Wireless Charging'},
  {ID:21,Title:'XLR Plug (4 pin)'}
];
const USOS_REALES = [
  {ID:0,Title:'(Unknown)'},{ID:6,Title:'Private - For Staff, Visitors or Customers'},
  {ID:2,Title:'Private - Restricted Access'},{ID:3,Title:'Privately Owned - Notice Required'},
  {ID:1,Title:'Public'},{ID:4,Title:'Public - Membership Required'},
  {ID:7,Title:'Public - Notice Required'},{ID:5,Title:'Public - Pay At Location'}
];

{
  const ids = CONECTORES_REALES.filter(esConectorTipo2).map(c => c.ID).sort((a,b) => a-b);
  ok('esConectorTipo2: exactamente 25 y 1036, entre los 43 reales',
     ids.length === 2 && ids[0] === 25 && ids[1] === 1036, JSON.stringify(ids));
  ok('esConectorTipo2: "CCS (Type 2)" no cuela por contener "Type 2"',
     esConectorTipo2({ Title: 'CCS (Type 2)' }) === false);
}
{
  const ids = USOS_REALES.filter(esUsoValido).map(u => u.ID).sort((a,b) => a-b);
  ok('esUsoValido: exactamente 1,4,5,6,7, entre los 8 reales',
     ids.join(',') === '1,4,5,6,7', ids.join(','));
  ok('esUsoValido: descarta "Private - Restricted Access" (ID 2)',
     esUsoValido({ Title: 'Private - Restricted Access' }) === false);
  ok('esUsoValido: descarta "Privately Owned - Notice Required" (ID 3)',
     esUsoValido({ Title: 'Privately Owned - Notice Required' }) === false);
}

// La referencia para las pruebas de procesarPOI de aquí en adelante: calculada
// a partir de las dos funciones ya probadas arriba, no hardcodeada a mano.
const REF = {
  connectorIds: CONECTORES_REALES.filter(esConectorTipo2).map(c => c.ID),
  usageIds: USOS_REALES.filter(esUsoValido).map(u => u.ID),
  operationalIds: [50], // Operational; 100 (Not Operational) y 150 (Planned) fuera
  operators: { 91: 'Operador de prueba', 3583: 'Operador de prueba MASID' }
};

{
  ok('conexionOperativa: sin StatusTypeID propio, hereda el del POI (true)',
     conexionOperativa({ StatusTypeID: null }, true, REF.operationalIds) === true);
  ok('conexionOperativa: sin StatusTypeID propio, hereda el del POI (false)',
     conexionOperativa({ StatusTypeID: null }, false, REF.operationalIds) === false);
  ok('conexionOperativa: con StatusTypeID propio operativo, ignora el del POI',
     conexionOperativa({ StatusTypeID: 50 }, false, REF.operationalIds) === true);
  ok('conexionOperativa: con StatusTypeID propio no operativo, ignora el del POI',
     conexionOperativa({ StatusTypeID: 150 }, true, REF.operationalIds) === false);
}

{
  const hace10 = new Date(Date.now() - 10*86400000).toISOString();
  const hace31 = new Date(Date.now() - 31*86400000).toISOString();
  ok('refCaducada: null -> caducada', refCaducada(null) === true);
  ok('refCaducada: sin campo fecha -> caducada', refCaducada({}) === true);
  ok('refCaducada: hace 10 días -> vigente', refCaducada({ fecha: hace10 }) === false);
  ok('refCaducada: hace 31 días -> caducada (límite: 30)', refCaducada({ fecha: hace31 }) === true);
}

{
  const poi = {
    ID: 271110, UsageTypeID: 4, StatusTypeID: 50, OperatorID: 3583,
    UsageCost: '0,39€/kWh DC - 0,29€/kWh AC + parking fee', GeneralComments: null,
    AddressInfo: { Title: 'Parking MASID', Distance: 0.2592328644704152,
      AddressLine1: 'Travesía de Poniente' },
    Connections: [
      { ConnectionTypeID: 33, StatusTypeID: 50, PowerKW: 60, Quantity: 2 },
      { ConnectionTypeID: 25, StatusTypeID: 50, PowerKW: 22, Quantity: 8 },
      { ConnectionTypeID: 33, StatusTypeID: 50, PowerKW: 60, Quantity: 2 }
    ]
  };
  const r = procesarPOI(poi, REF);
  ok('procesarPOI: Parking MASID (2 CCS + 1 Tipo2) pasa el filtro', !!r);
  ok('procesarPOI: ...y queda solo la conexión Tipo2',
     r && r.conexiones.length === 1 && r.conexiones[0].qty === 8 && r.conexiones[0].kw === 22,
     r && JSON.stringify(r.conexiones));
  ok('procesarPOI: resuelve el nombre del operador', r && r.operatorName === 'Operador de prueba MASID');
  ok('procesarPOI: dirección real de OCM tal cual (solo AddressLine1)',
     r && r.address === 'Travesía de Poniente', r && r.address);
}

{
  const poi = {
    ID: 235150, UsageTypeID: 4, StatusTypeID: 50,
    AddressInfo: { Title: "McDonald's Tres Cantos", Distance: 0.4305193606907604 },
    Connections: [
      { ConnectionTypeID: 33, StatusTypeID: 50, PowerKW: 60, Quantity: 2 },
      { ConnectionTypeID: 33, StatusTypeID: 50, PowerKW: 60, Quantity: 2 }
    ]
  };
  ok('procesarPOI: McDonald\'s Tres Cantos (solo CCS) -> null', procesarPOI(poi, REF) === null);
}

{
  const poi = {
    ID: 470469, UsageTypeID: 2, StatusTypeID: 50,
    AddressInfo: { Title: 'Indra Alcobendas', Distance: 10.260134756794654 },
    Connections: [{ ConnectionTypeID: 25, StatusTypeID: 50, PowerKW: 22, Quantity: 2 }]
  };
  ok('procesarPOI: uso "Private - Restricted Access" -> null aunque tenga Tipo2',
     procesarPOI(poi, REF) === null);
}

{
  const poi = {
    ID: 235149, UsageTypeID: 1, StatusTypeID: 100,
    AddressInfo: { Title: 'Ayuntamiento Tres Cantos', Distance: 0.9018127292515176 },
    Connections: [{ ConnectionTypeID: 25, StatusTypeID: 50, PowerKW: 11, Quantity: 2 }]
  };
  ok('procesarPOI: StatusTypeID 100 de POI (Ayuntamiento Tres Cantos) -> null',
     procesarPOI(poi, REF) === null);
}

{
  const poi = {
    ID: 201638, UsageTypeID: 6, StatusTypeID: 50, OperatorID: 91, UsageCost: null,
    AddressInfo: { Title: 'Repsol Tres Cantos: REE', Distance: 1.0965851859415627 },
    Connections: [
      { ConnectionTypeID: 33, StatusTypeID: 50, PowerKW: 50, Quantity: 1 },
      { ConnectionTypeID: 2,  StatusTypeID: 50, PowerKW: 50, Quantity: 1 },
      { ConnectionTypeID: 1036, StatusTypeID: 50, PowerKW: 43, Quantity: 1 },
      { ConnectionTypeID: 25, StatusTypeID: 50, PowerKW: 22, Quantity: 1 }
    ]
  };
  const r = procesarPOI(poi, REF);
  ok('procesarPOI: "...For Staff, Visitors or Customers" pasa, con 2 de 4 conexiones',
     r && r.conexiones.length === 2, r && JSON.stringify(r.conexiones));
  ok('procesarPOI: ...las dos correctas (43 y 22 kW)',
     r && r.conexiones[0].kw === 43 && r.conexiones[1].kw === 22);
  ok('procesarPOI: UsageCost null -> price null, nunca inventado', r && r.price === null);
}

{
  // No visto en datos reales (ahí el Tipo2 siempre venía Operational);
  // construido para forzar esta rama de conexionOperativa().
  const poi = {
    ID: 999001, UsageTypeID: 1, StatusTypeID: 50,
    AddressInfo: { Title: 'Sintético: Tipo2 planeado', Distance: 1 },
    Connections: [{ ConnectionTypeID: 25, StatusTypeID: 150, PowerKW: 22, Quantity: 1 }]
  };
  ok('procesarPOI [sintético]: la única conexión Tipo2 está "Planned" -> null',
     procesarPOI(poi, REF) === null);
}

{
  const poi = {
    ID: 999002, UsageTypeID: 1, StatusTypeID: 50,
    AddressInfo: { Title: 'Sintético: hereda del POI', Distance: 1 },
    Connections: [{ ConnectionTypeID: 25, StatusTypeID: null, PowerKW: 22, Quantity: 1 }]
  };
  const r = procesarPOI(poi, REF);
  ok('procesarPOI [sintético]: conexión sin StatusTypeID propio hereda el operativo del POI',
     r && r.conexiones.length === 1);
}

{
  const poi = {
    ID: 999003, UsageTypeID: 1, StatusTypeID: 50,
    AddressInfo: { Title: 'Sintético: sin Quantity', Distance: 1 },
    Connections: [{ ConnectionTypeID: 25, StatusTypeID: 50, PowerKW: 22 }]
  };
  const r = procesarPOI(poi, REF);
  ok('procesarPOI: Quantity ausente cuenta como 1, nunca 0', r && r.conexiones[0].qty === 1);
}

{
  // Carrefour Alcobendas real: AddressLine1 solo trae el municipio (no es
  // una calle útil por sí sola), y AddressLine2 el barrio -> se combinan.
  const poi = {
    ID: 999004, UsageTypeID: 1, StatusTypeID: 50,
    AddressInfo: { Title: 'Sintético: dirección combinada', Distance: 1,
      AddressLine1: 'Alcobendas', AddressLine2: 'Valdelasfuentes' },
    Connections: [{ ConnectionTypeID: 25, StatusTypeID: 50, PowerKW: 22, Quantity: 1 }]
  };
  const r = procesarPOI(poi, REF);
  ok('procesarPOI: AddressLine1 + AddressLine2 se combinan tal cual, sin reordenar',
     r && r.address === 'Alcobendas, Valdelasfuentes', r && r.address);
}

{
  const poi = {
    ID: 999005, UsageTypeID: 1, StatusTypeID: 50,
    AddressInfo: { Title: 'Sintético: sin dirección', Distance: 1 },
    Connections: [{ ConnectionTypeID: 25, StatusTypeID: 50, PowerKW: 22, Quantity: 1 }]
  };
  const r = procesarPOI(poi, REF);
  ok('procesarPOI: sin AddressLine1 ni AddressLine2 -> address null, nunca inventado',
     r && r.address === null);
}

{
  ok('pareceRecargoPorTiempo: "then at 0,07€/min" (Mercadona real) -> true',
     pareceRecargoPorTiempo("app Waylet(Repsol). 90' free parking, then at 0,07€/min") === true);
  ok('pareceRecargoPorTiempo: "Free parking... Cannot reserve." (Tres Cantos Mall) -> false',
     pareceRecargoPorTiempo('Free parking, free charging. Cannot reserve.') === false);
  ok('pareceRecargoPorTiempo: "parked without charging" (Ahorramas real) -> true',
     pareceRecargoPorTiempo('0,42€/kWh (0,05€/min parked without charging)') === true);
  ok('pareceRecargoPorTiempo: mira varios textos a la vez (price + note)',
     pareceRecargoPorTiempo('0,25€/kWh', '3,3€/hour + parking fee') === true &&
     pareceRecargoPorTiempo('0,25€/kWh', 'Solo para clientes') === false);
  ok('pareceRecargoPorTiempo: null/vacío -> false, nunca lanza',
     pareceRecargoPorTiempo(null, undefined, '') === false);
}

{
  const hace1mes  = new Date(Date.now() - 30*86400000).toISOString();
  const hace6meses = new Date(Date.now() - 6*30*86400000).toISOString();
  const hace2anios = new Date(Date.now() - 2*365*86400000).toISOString();
  ok('frescura: sin fecha -> "mal"', frescura(null).nivel === 'mal');
  ok('frescura: hace 1 mes -> "bien"', frescura(hace1mes).nivel === 'bien');
  ok('frescura: hace 6 meses -> "regular"', frescura(hace6meses).nivel === 'regular');
  ok('frescura: hace 2 años -> "mal"', frescura(hace2anios).nivel === 'mal');
  ok('frescura: fecha inválida -> "mal", nunca NaN ni excepción',
     frescura('no-es-una-fecha').nivel === 'mal');
}

// ================= GASOLINERAS POR LUGAR =================
seccion('Gasolineras por código postal o municipio');

{
  const err = f => { try{ f(); return null; }catch(e){ return e.message; } };
  const cp = parseConsulta(' 28013 ');
  ok('CP: 5 cifras -> tipo cp y provincia por sus 2 primeras',
     cp.tipo === 'cp' && cp.cp === '28013' && cp.provincia === '28', JSON.stringify(cp));
  ok('CP: conserva el cero inicial (07001 -> Baleares 07)', parseConsulta('07001').provincia === '07');
  ok('CP: provincia 00 o mayor de 52 -> cp-invalido',
     err(() => parseConsulta('00123')) === 'cp-invalido' && err(() => parseConsulta('53001')) === 'cp-invalido');
  ok('CP: longitud distinta de 5 -> cp-invalido',
     err(() => parseConsulta('2801')) === 'cp-invalido' && err(() => parseConsulta('280130')) === 'cp-invalido');
  ok('vacío o una letra -> lugar-vacio',
     err(() => parseConsulta('  ')) === 'lugar-vacio' && err(() => parseConsulta('a')) === 'lugar-vacio' &&
     err(() => parseConsulta(null)) === 'lugar-vacio');
  const n = parseConsulta('  Villanueva   de la Serena ');
  ok('nombre: se limpian espacios', n.tipo === 'nombre' && n.nombre === 'Villanueva de la Serena', n.nombre);
}

{
  // direcciones reales devueltas por Nominatim
  ok('provincia por ISO de provincia (Cáceres)',
     provinciaDeAddress({ 'ISO3166-2-lvl6':'ES-CC', 'ISO3166-2-lvl4':'ES-EX' }) === '10');
  ok('comunidad uniprovincial sin nivel de provincia (Madrid, La Rioja, Ceuta)',
     provinciaDeAddress({ 'ISO3166-2-lvl4':'ES-MD' }) === '28' &&
     provinciaDeAddress({ 'ISO3166-2-lvl4':'ES-RI' }) === '26' &&
     provinciaDeAddress({ 'ISO3166-2-lvl4':'ES-CE' }) === '51');
  ok('Baleares: ES-PM es la provincia 07', provinciaDeAddress({ 'ISO3166-2-lvl6':'ES-PM' }) === '07');
  ok('Canarias no es uniprovincial: sin lvl6 no se adivina',
     provinciaDeAddress({ 'ISO3166-2-lvl4':'ES-CN', state:'Canarias' }) === null);
  ok('sin ISO, se recurre al nombre', provinciaDeAddress({ province:'Sevilla' }) === '41');
  ok('dirección vacía o nula -> null', provinciaDeAddress(null) === null && provinciaDeAddress({}) === null);
}

{
  const nom = (name, iso6, iso4, lat, lon, extra = {}) =>
    ({ name, lat: String(lat), lon: String(lon),
       address: { ...(iso6 ? { 'ISO3166-2-lvl6': iso6 } : {}), 'ISO3166-2-lvl4': iso4, ...extra } });

  const arroyo = [
    nom('Arroyomolinos', 'ES-CC', 'ES-EX', 39.18, -6.16, { province:'Cáceres' }),
    nom('Arroyomolinos', null, 'ES-MD', 40.27, -3.91, { state:'Comunidad de Madrid' }),
    nom('Arroyomolinos de la Vera', 'ES-CC', 'ES-EX', 40.05, -5.85, { province:'Cáceres' })
  ];
  const l = lugaresDeNominatim(arroyo, 'arroyomolinos');
  ok('nombre ambiguo: quedan solo las coincidencias exactas, una por provincia',
     l.length === 2 && l[0].provincia === '10' && l[1].provincia === '28', JSON.stringify(l));
  ok('cada lugar trae su provincia por nombre para distinguirlo', l[0].zona === 'Cáceres' && l[1].zona === 'Madrid',
     l.map(x => x.zona).join());

  const valde = [nom('Valdemorillo', null, 'ES-MD', 40.50, -4.07),
                 nom('Valdemorillo de la Sierra', 'ES-CU', 'ES-CM', 40.04, -1.78)];
  ok('una sola coincidencia exacta -> se elige sola',
     lugaresDeNominatim(valde, 'Valdemorillo').length === 1);
  ok('sin coincidencia exacta -> se ofrecen todos',
     lugaresDeNominatim(valde, 'Valdemori').length === 2);

  const logrono = [nom('Logroño', null, 'ES-RI', 42.46, -2.44), nom('Logroño', null, 'ES-RI', 42.47, -2.45)];
  ok('mismo municipio repetido (ciudad y término) -> uno solo',
     lugaresDeNominatim(logrono, 'logrono').length === 1);

  ok('el artículo no impide la coincidencia: "Zarza (La)" = "La Zarza"',
     lugaresDeNominatim([nom('La Zarza', 'ES-BA', 'ES-EX', 38.7, -6.2)], 'Zarza (La)').length === 1);
  ok('...pero no recorta nombres que solo empiezan por esa letra ("Olot" no es "lot")',
     lugaresDeNominatim([nom('Olot', 'ES-GI', 'ES-CT', 42.18, 2.49), nom('Lot', 'ES-GI', 'ES-CT', 42, 2)], 'lot')
       .map(x => x.nombre).join() === 'Lot');

  ok('se descartan los que no se pueden situar (sin provincia o sin coordenadas)',
     lugaresDeNominatim([nom('X', null, 'ES-CN', 28, -15), { name:'Y', lat:'', lon:'',
       address:{ 'ISO3166-2-lvl6':'ES-M' } }], 'x').length === 0);
  ok('lista nula -> vacía, nunca lanza', lugaresDeNominatim(null, 'x').length === 0);
}

{
  const data = { Fecha: '18/10/2026', ListaEESSPrecio: [
    { 'C.P.':'28864', 'Latitud':'40,5', 'Longitud (WGS84)':'-3,4', 'Precio Gasolina 95 E5':'1,839',
      'Rótulo':'REPSOL', 'Dirección':'M-114', 'Municipio':'Ajalvir' },
    { 'C.P.':'28864', 'Latitud':'40,7', 'Longitud (WGS84)':'-3,6', 'Precio Gasolina 95 E5':'',
      'Precio Gasolina 98 E5':'1,999', 'Rótulo':'BP', 'Dirección':'C/ Mayor', 'Municipio':'Ajalvir' },
    { 'C.P.':'28001', 'Latitud':'', 'Longitud (WGS84)':'-3,6', 'Precio Gasolina 95 E5':'1,7' },
    { 'C.P.':'28001', 'Latitud':'40,4', 'Longitud (WGS84)':'-3,7', 'Precio Gasoleo A':'1,6' }
  ]};
  const all = parseEstaciones(data);
  ok('parseEstaciones: descarta sin coordenadas o sin precio de gasolina', all.length === 2, String(all.length));
  ok('parseEstaciones: si no hay 95, usa 98', all[1].price === 1.999);
  ok('parseEstaciones: guarda CP y municipio', all[0].cp === '28864' && all[0].localidad === 'Ajalvir');
  ok('parseEstaciones: datos nulos -> lista vacía', parseEstaciones(null).length === 0);

  const c = centroDeCP(all, '28864');
  casi('centroDeCP: media de las latitudes', c.lat, 40.6, 1e-9);
  casi('centroDeCP: media de las longitudes', c.lon, -3.5, 1e-9);
  ok('centroDeCP: CP sin gasolineras -> null, no se inventa un punto', centroDeCP(all, '28013') === null);
}

// ================= MODO SIN CONEXIÓN =================
seccion('Modo sin conexión (sw.js y manifest)');

{
  const { readFileSync, readdirSync, existsSync } = await import('node:fs');
  const leer = f => readFileSync(new URL('./' + f, import.meta.url), 'utf8');
  const existe = f => existsSync(new URL('./' + f, import.meta.url));

  const sw = leer('sw.js');
  const lista = (sw.match(/const ARCHIVOS = \[([\s\S]*?)\];/) || [])[1] || '';
  const archivos = [...lista.matchAll(/'([^']+)'/g)].map(m => m[1]);
  ok('sw.js: se lee la lista de archivos', archivos.length > 0);

  const modulos = readdirSync(new URL('./js/', import.meta.url)).filter(f => f.endsWith('.js'));
  const faltan = modulos.filter(f => !archivos.includes('js/' + f));
  ok('sw.js guarda todos los módulos de js/ (si no, sin red la app no arranca)', !faltan.length, faltan.join(', '));
  const noExisten = archivos.filter(f => !existe(f));
  ok('cada archivo de la lista existe (si no, el service worker no se instala)', !noExisten.length, noExisten.join(', '));
  ok('version.json no se guarda: es la pregunta de si hay versión nueva', !archivos.includes('version.json'));

  let man = null;
  try{ man = JSON.parse(leer('manifest.webmanifest')); }catch(e){}
  ok('manifest.webmanifest es JSON válido', !!man);
  const iconos = (man && man.icons || []).map(i => i.src);
  ok('el manifest tiene iconos de 192 y 512', iconos.includes('icono-192.png') && iconos.includes('icono-512.png'));
  ok('los iconos del manifest existen y se guardan para sin red',
     iconos.every(i => existe(i) && archivos.includes(i)), iconos.join(', '));
  ok('index.html enlaza el manifest', leer('index.html').includes('rel="manifest" href="manifest.webmanifest"'));

  // la autoactualización depende de que coincidan: si no, recarga en bucle o nunca
  const vJson = JSON.parse(leer('version.json')).v;
  const vApp = (leer('js/app.js').match(/const VERSION = '([^']+)'/) || [])[1];
  ok('VERSION de app.js y version.json coinciden', vJson === vApp, vApp + ' / ' + vJson);

  // la guía rápida de Ayuda remite al manual completo: que el enlace no quede roto
  const enlace = (leer('index.html').match(/id="btn-manual" href="([^"]+)"/) || [])[1] || '';
  const fichero = (enlace.match(/\/blob\/main\/([^/?#]+)$/) || [])[1];
  ok('Ayuda enlaza al manual completo del repositorio', !!fichero && enlace.startsWith('https://github.com/'), enlace);
  ok('...y ese fichero existe', !!fichero && existe(fichero), fichero);
  // fuera de la app, para que con la app instalada se abra en el navegador y no sin forma de volver
  ok('...y se abre en el navegador', /id="btn-manual"[^>]*target="_blank"[^>]*rel="noopener"/.test(leer('index.html')));
}

// ================= RESUMEN =================
console.log('\n' + '='.repeat(50));
if(falla){
  console.log(`FALLAN ${falla} de ${pasa+falla} comprobaciones:\n`);
  fallos.forEach(f => console.log('  x ' + f));
  process.exit(1);
} else {
  console.log(`${pasa} comprobaciones correctas.`);
}
