// pruebas.mjs — suite de pruebas. Ejecutar con:  node pruebas.mjs
// No se despliega: es solo para desarrollo.

import { simulate, findLimitHours, measStats, buildMeasurement,
         PRESET_FACTORS, efficiencyPenalty, taper } from './js/calculo.js';
import { procesarPOI, pareceRecargoPorTiempo, frescura, _test as ocmTest } from './js/cargadores.js';
const { esConectorTipo2, esUsoValido, conexionOperativa, refCaducada } = ocmTest;

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

// ================= RESUMEN =================
console.log('\n' + '='.repeat(50));
if(falla){
  console.log(`FALLAN ${falla} de ${pasa+falla} comprobaciones:\n`);
  fallos.forEach(f => console.log('  x ' + f));
  process.exit(1);
} else {
  console.log(`${pasa} comprobaciones correctas.`);
}
