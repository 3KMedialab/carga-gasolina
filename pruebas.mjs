// pruebas.mjs — suite de pruebas. Ejecutar con:  node pruebas.mjs
// No se despliega: es solo para desarrollo.

import { simulate, findLimitHours, measStats, buildMeasurement,
         PRESET_FACTORS, efficiencyPenalty, taper } from './js/calculo.js';

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
  // Ojo: en el 85% las dos curvas se cruzan y coinciden. Se comprueba a ambos lados.
  const alto = (c, soc) => simulate({ ...base('parked'), chem:c, currentSoc:soc, parkHours:4 });
  ok('bajo el cruce, la NMC tarda más que la LFP',
    alto('nmc', 70).chargeHours > alto('lfp', 70).chargeHours + 0.01);
  ok('sobre el cruce, la LFP tarda más que la NMC',
    alto('lfp', 92).chargeHours > alto('nmc', 92).chargeHours + 0.01);
  ok('los kWh cargados no dependen de la química',
    Math.abs(alto('lfp', 70).sessionKwh - alto('nmc', 70).sessionKwh) < 1e-9);
}

// ================= MODOS DE CONDUCCIÓN =================
seccion('Modos de conducción y frío');

{
  const be = (fc, ec) => {
    const c = { ...base('parked'), fuelCons:fc, elecCons:ec };
    const eff = (c.chargeEff/100)*efficiencyPenalty(6.6);
    return (c.fuelPrice*fc/100)/(ec/100)*eff;
  };
  const F = PRESET_FACTORS;
  const ciudad    = be(5*F.ciudad.fuel,    22*F.ciudad.elec);
  const mixto     = be(5*F.mixto.fuel,     22*F.mixto.elec);
  const carretera = be(5*F.carretera.fuel, 22*F.carretera.elec);
  ok('cargar compensa más en ciudad que en carretera', ciudad > mixto && mixto > carretera,
     `${ciudad.toFixed(3)} / ${mixto.toFixed(3)} / ${carretera.toFixed(3)}`);

  let peor = true;
  for(const k of ['ciudad','mixto','carretera']){
    const f = F[k];
    const t = be(5*f.fuel, 22*f.elec);
    const c = be(5*f.fuel*f.coldFuel, 22*f.elec*f.coldElec);
    if(c >= t) peor = false;
  }
  ok('el frío siempre empeora, en los tres modos', peor);
  ok('el frío castiga más en ciudad que en carretera',
     F.ciudad.coldElec > F.carretera.coldElec);
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
  const m = buildMeasurement({ km1:0, km2:250, kwh:64, litres:0, fuelCons:5 });
  ok('medición válida se acepta', m.ok);
  casi('R = km / kWh', m.R, 250/64, 1e-9);

  ok('rechaza km al revés',      !buildMeasurement({ km1:250, km2:0, kwh:64, litres:0, fuelCons:5 }).ok);
  ok('rechaza sin kWh',          !buildMeasurement({ km1:0, km2:250, kwh:0, litres:0, fuelCons:5 }).ok);
  ok('rechaza demasiada gasolina',!buildMeasurement({ km1:0, km2:250, kwh:64, litres:9, fuelCons:5 }).ok);
  ok('rechaza R imposible',      !buildMeasurement({ km1:0, km2:250, kwh:5, litres:0, fuelCons:5 }).ok);

  const conGas = buildMeasurement({ km1:0, km2:250, kwh:50, litres:3, fuelCons:5 });
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
