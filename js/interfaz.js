// interfaz.js — une el DOM con el cálculo y el almacenamiento.
// Exporta iniciar() para que las pruebas puedan importar sin arrancar la app.

import {
  $, show, openOverlay, num, byId, clamp, fmt, esc, fmtTime,
  tono, EURO
} from './util.js';

import {
  CLIMAS, simulate, findLimitHours, rParaClima, measEnUso, sinClasificar, buildMeasurement, kmPorClima,
  MEAS_MAX, MEAS_MESES, MEAS_MESES_SIN_CLASIFICAR,
  medidasConConsumo, buildFuelMeasurement, consumoParaClima,
  buildDescuento, precioConDescuento, buildCasa
} from './calculo.js';

import * as D from './datos.js';
import { buscarCercanas, resolverLugar, buscarEnLugar, MENSAJES } from './gasolineras.js';
import {
  buscarCercanos as buscarCargadoresOCM, MENSAJES as MENSAJES_OCM,
  pareceRecargoPorTiempo, frescura as frescuraOCM
} from './cargadores.js';

const SESSION_KEYS = [
  'chargerPrice','fuelPrice','chargerPower','currentSoc','parkHours',
  'sessionKwh','detourKm','sessionFee',
  'pricingMode','pricePerMin'
];

// --- estado de la vista ---
const els = {};
let mode = 'parked';
let parkUnit = 'h'; // 'h' o 'min' — solo cambia cómo se muestra/escribe inp-parkHours
let clima = 'nada';           // climatización del trayecto: 'calefaccion' | 'aire' | 'nada'
let selectedChargerId = null;
let editingChargerId = null;
let editingVehicleId = null;
let lastCalc = null;
let lastStations = [];
let estacionElegida = null;    // índice de la que tocó el usuario (null = ninguna)
let editingDescuento = null;   // índice del descuento que se está editando en Ajustes
let lastLugar = null;          // lugar de la última lista de gasolineras (null = tu ubicación)
let lugaresPendientes = [];    // candidatos cuando el municipio buscado es ambiguo
let lastOcmResults = [];
let selectedOcmResult = null;
let mostrarTodosOcm = false;
let ocmPlegado = false;        // lista de cargadores públicos oculta (salvo la tarjeta abierta)
const OCM_VISIBLES = 5; // tarjetas antes de "Ver más"


const CON_CLIMA    = { calefaccion: 'con calefacción', aire: 'con aire', nada: 'sin climatización' };

const RELOJ = '<svg class="chip-clock" aria-hidden="true"><use href="#i-clock"/></svg>';

/** Marca un botón de un grupo (control segmentado, chips) como elegido o no. */
function pulsado(el, on){
  el.classList.toggle('active', !!on);
  if(el.setAttribute) el.setAttribute('aria-pressed', on ? 'true' : 'false');
}

// ======================= CÁLCULO PRINCIPAL =======================

/** Consumo en híbrido para una climatización: el medido con ella si lo hay, el declarado si no. */
function baseFuelCons(prof, c){
  const s = consumoParaClima(D.loadFuel(), c);
  return s.L > 0 ? s.L : prof.fuelCons;
}

/**
 * Las medidas de R con el consumo en híbrido de ahora: los litros de cada una
 * se descuentan con el consumo de su climatización. Todo lo que muestra o usa R
 * pasa por aquí, no por D.loadMeas() directamente.
 */
function medidasR(prof){
  const l = D.loadMeas();
  return prof ? medidasConConsumo(l, c => baseFuelCons(prof, c)) : l;
}

/**
 * Precio de la gasolina que entra en el cálculo. Si el campo tiene el precio de
 * la gasolinera tocada en la lista, se le aplica el descuento de su marca; la
 * media de la zona y un precio escrito a mano se usan tal cual.
 * Devuelve {precio, descuento} (descuento null si no se aplica ninguno).
 */
function precioGasolina(){
  const p = num(els.fuelPrice), est = D.getEstacion();
  if(!est || Math.abs(p - est.price) > 0.0005) return { precio: p, descuento: null };
  return precioConDescuento(p, est.name, D.loadDescuentos());
}

/** Lo que pagas en cada gasolinera de la lista, con tus descuentos. */
const pagasEn = s => precioConDescuento(s.price, s.name, D.loadDescuentos());

/** La más barata de la lista con lo que pagas tú, no con el precio del surtidor. */
function masBarata(){
  return lastStations.reduce((b, s) => (!b || pagasEn(s).precio < pagasEn(b).precio) ? s : b, null);
}

const textoDescuento = d => d.unidad === 'pct'
  ? fmt(d.valor, d.valor % 1 ? 1 : 0) + ' %'
  : fmt(d.valor, d.valor % 1 ? 1 : 0) + ' c€/L';

/** Consumo eléctrico base: el medido con esta climatización si lo hay, el declarado si no. */
function baseElecCons(prof){
  const s = rParaClima(medidasR(prof), clima);
  return s.R > 0 ? prof.chargeEff / s.R : prof.elecCons;
}

function render(){
  const prof = D.activeProfile();
  if(!prof) return;

  const ch = selectedCharger();
  const gasolina = precioGasolina();
  const pagas = $('fuel-pagas');
  pagas.textContent = gasolina.descuento
    ? 'Pagas ' + fmt(gasolina.precio, 3) + ' ' + EURO + '/L con tu descuento de ' +
      textoDescuento(gasolina.descuento) + '. Es el precio que usa el cálculo.'
    : '';
  const cfg = {
    mode,
    chargerPower: num(els.chargerPower), maxPower: prof.maxPower,
    chargeEff: prof.chargeEff, chem: prof.chem || 'unknown',
    battery: prof.battery, currentSoc: num(els.currentSoc),
    parkHours: parkHoursValue(), sessionKwh: num(els.sessionKwh),
    detourKm: num(els.detourKm),
    chargerPrice: num(els.chargerPrice), byMinute: num(els.pricingMode) === 1,
    pricePerMin: num(els.pricePerMin), sessionFee: num(els.sessionFee),
    // los consumos no se escriben a mano: el medido con esta climatización o el declarado
    fuelPrice: gasolina.precio, fuelCons: baseFuelCons(prof, clima),
    elecCons: baseElecCons(prof),
    freeHours: ch && ch.overMin > 0 ? ch.freeHours : 0,
    overMin:   ch && ch.overMin > 0 ? ch.overMin   : 0,
    // con casa configurada y «sí, voy a cargar en casa antes», se compara con casa
    casa: casaActiva()
  };
  const r = simulate(cfg);
  const enCasa = r.vs === 'casa';
  syncCasaUI(r);

  // gratis y sin ataduras: no hay nada que decidir
  const precio = cfg.byMinute ? cfg.pricePerMin : cfg.chargerPrice;
  const isFree = precio <= 0 && cfg.sessionFee <= 0 && cfg.overMin <= 0 && cfg.detourKm <= 0;

  const worth = !r.nothingToCharge && r.net > 0;
  const tight = !r.nothingToCharge && !isFree && r.net >= 0 && Math.abs(r.net) < 0.10;
  // el color del veredicto entero sale de esta clase (ver .verdict.v-* en estilos.css)
  const estado = (r.nothingToCharge || tight) ? 'warn' : (worth ? 'good' : 'bad');
  ['good', 'bad', 'warn'].forEach(s => $('verdict').classList.toggle('v-' + s, s === estado));

  $('badge').textContent = r.nothingToCharge ? 'Batería llena'
    : isFree ? 'Gratis'
    : tight ? 'Casi igual'
    : enCasa ? (worth ? 'Compensa cargar aquí' : 'Mejor esperar a casa')
    : worth ? 'Compensa cargar' : 'Mejor repostar';

  $('amount').innerHTML = (r.net >= 0 ? '+' : '−') + fmt(Math.abs(r.net)) +
    '<span class="unit"> ' + EURO + '</span>';

  $('amount-label').textContent = (r.nothingToCharge
    ? 'no cabe energía en la batería'
    : isFree ? (enCasa ? 'que te habría costado en casa' : 'que te habrías gastado en gasolina')
    : (r.net >= 0 ? 'de ahorro en esta recarga' : 'de sobrecoste en esta recarga') +
      (enCasa ? ' frente a casa' : ''))
    + (clima !== 'nada' ? ' · ' + CON_CLIMA[clima] : '');

  const detail = $('detail');
  if(r.nothingToCharge){
    detail.innerHTML = 'Tu batería ya está al ' + fmt(cfg.currentSoc, 0) + '%.' +
      (cfg.sessionFee > 0
        ? ' Enchufar aquí solo te costaría la tarifa fija de ' + fmt(cfg.sessionFee) + ' ' + EURO + '.'
        : '');
  } else if(isFree){
    detail.innerHTML = '<strong class="num">' + fmt(r.km, 0) + ' km</strong> sin coste.';
  } else if(enCasa && r.homeCost > 0){
    detail.innerHTML = 'Meter esa energía en casa te costaría <strong class="num">' + fmt(r.homeCost) + ' ' + EURO +
      '</strong>; aquí, <strong class="num">' + fmt(r.sessionCost) + ' ' + EURO + '</strong>.' + (cfg.byMinute
        ? ' Pagando por minuto, te salen <strong class="num">' + fmt(r.effectivePerKwh, 2) + ' ' + EURO + '/kWh</strong>.'
        : '');
  } else if(r.equivFuel > 0){
    const pct = Math.abs(r.net) / r.equivFuel * 100;
    detail.innerHTML = 'Hacer esos <strong class="num">' + fmt(r.km, 0) + ' km</strong> enchufado te sale un ' +
      '<strong class="num">' + fmt(pct, 0) + '%</strong> ' + (r.net >= 0 ? 'más barato' : 'más caro') +
      ' que en gasolina.' + (cfg.byMinute
        ? ' Pagando por minuto, te salen <strong class="num">' + fmt(r.effectivePerKwh, 2) + ' ' + EURO + '/kWh</strong>.'
        : '');
  } else { detail.textContent = ''; }

  // --- tarjeta del modo activo ---
  const pre = mode === 'parked' ? 'pk' : 'tr';
  const pctNow = clamp(cfg.currentSoc, 0, 100);
  const pctGain = clamp(r.finalSoc - pctNow, 0, 100);
  $(pre + '-fill-now').style.width = pctNow + '%';
  const g = $(pre + '-fill-gain');
  g.style.left = pctNow + '%'; g.style.width = pctGain + '%';
  $(pre + '-legend').innerHTML = 'Batería ' + fmt(pctNow, 0) +
    '% → <strong>' + fmt(r.finalSoc, 0) + '%</strong>';
  $(pre + '-kwh').textContent = fmt(r.sessionKwh, 1) + ' kWh en ' + fmtTime(r.chargeHours);
  $(pre + '-km').textContent = '≈ ' + fmt(r.km, 0) + ' km';
  $(pre + '-cost').textContent = fmt(r.sessionCost) + ' ' + EURO;
  $(pre + '-equiv-k').textContent = enCasa ? 'En casa te habría costado' : 'En gasolina habrían sido';
  $(pre + '-equiv').textContent = fmt(r.altCost) + ' ' + EURO;

  const overRow = $(pre + '-row-over');
  if(r.overCost > 0){
    overRow.style.display = '';
    $(pre + '-over').textContent = '+' + fmt(r.overCost) + ' ' + EURO + ' (' + fmtTime(r.overHours) + ' de más)';
  } else { overRow.style.display = 'none'; }

  const limit = ch && ch.overMin > 0 ? findLimitHours({ ...cfg, mode: 'parked' }) : null;

  if(mode === 'parked'){
    const note = $('pk-note');
    if(r.nothingToCharge){
      note.innerHTML = `<span class="c-warn">No tiene sentido enchufar</span>: tu batería ya está llena.`;
    } else if(isFree){
      note.innerHTML = 'Enchufa el tiempo que quieras: no hay nada que decidir.';
    } else if(limit !== null && cfg.parkHours >= limit){
      note.innerHTML = `<span class="c-bad">Llevas demasiado tiempo.</span> A partir de ` +
        fmtTime(limit) + ' el recargo se come el ahorro. Desconecta antes.';
    } else if(limit !== null){
      note.innerHTML = `<span class="c-warn">Desconecta antes de ${fmtTime(limit)}</span>` +
        ' o el recargo empezará a costarte dinero.';
    } else if(r.capped){
      note.innerHTML = 'La batería se llena en ' + fmtTime(r.chargeHours) +
        ', antes de que te vayas. El tiempo de más no suma nada.';
    } else if(worth){
      note.innerHTML = 'Ahorro limpio: no te cuesta ni tiempo ni desvío, porque ibas a estar aquí igualmente.';
    } else {
      note.innerHTML = enCasa
        ? `<span class="c-bad">Sale más caro que cargar en casa</span>: espera a llegar.`
        : `<span class="c-bad">Sale más caro que la gasolina</span>, aunque no te cueste tiempo.`;
    }
  } else {
    const rowD = $('tr-row-detour');
    if(cfg.detourKm > 0){
      rowD.style.display = '';
      $('tr-detour').textContent = '−' + fmt(r.detourCost) + ' ' + EURO;
    } else rowD.style.display = 'none';

    const note = $('tr-note');
    const perHour = r.chargeHours > 0 ? r.net / r.chargeHours : 0;
    if(r.nothingToCharge){
      note.innerHTML = `<span class="c-warn">No tiene sentido desviarte</span>: tu batería ya está llena.`;
    } else if(r.capped){
      note.innerHTML = 'Pediste ' + fmt(cfg.sessionKwh, 0) + ' kWh pero solo caben ' +
        fmt(r.sessionKwh, 1) + ' antes del 100%. El cálculo usa esa cifra.';
    } else if(cfg.detourKm > 0 && r.gross > 0 && r.net < 0){
      note.innerHTML = `<span class="c-bad">El desvío se come el ahorro.</span> ` +
        'Sin el rodeo habrías ahorrado ' + fmt(r.gross) + ' ' + EURO + '.';
    } else if(worth){
      note.innerHTML = 'Son ' + fmtTime(r.chargeHours) + ' de espera para ahorrar ' + fmt(r.net) +
        ' ' + EURO + ' — unos ' + fmt(perHour) + ' ' + EURO + ' por hora.';
    } else {
      note.innerHTML = `<span class="c-bad">No merece la pena esta parada</span> a este precio` +
        (enCasa ? ': te sale mejor cargar en casa.' : '.');
    }
  }

  // --- el cargador elegido: recargo por tiempo (con la hora límite) y notas ---
  const avisoRecargo = $('charger-recargo');
  if(ch && ch.overMin > 0){
    // la hora límite va en la nota de «La recarga», junto al tiempo: aquí solo las condiciones
    avisoRecargo.innerHTML = 'Cobra <strong class="num">' + fmt(ch.overMin, 2) + ' ' + EURO + '/min</strong> si ocupas ' +
      'la plaza más de <strong>' + fmtTime(ch.freeHours) + '</strong>.' + (limit !== null && mode === 'trip'
        ? ' Aparcando aquí, desconecta antes de <strong>' + fmtTime(limit) + '</strong>.'
        : '');
  } else avisoRecargo.innerHTML = '';
  show(avisoRecargo, !!(ch && ch.overMin > 0));

  const noteEl = $('charger-note');
  noteEl.textContent = ch && ch.note ? ch.note : '';
  show(noteEl, !!(ch && ch.note));

  const ph = $('power-hint');
  if(r.powerCapped){
    ph.textContent = prof.name + ' carga a ' + fmt(prof.maxPower, 1) + ' kW como máximo: se usa ese límite';
    ph.classList.add('warn');
  } else if(r.effReduced){
    ph.textContent = 'A ' + fmt(r.power, 1) + ' kW se pierde más energía: eficiencia ajustada a ' +
      fmt(r.eff * 100, 0) + '%';
    ph.classList.add('warn');
  } else {
    ph.textContent = 'La del punto donde estás';
    ph.classList.remove('warn');
  }

  $('field-price-kwh').classList.toggle('hidden', cfg.byMinute);
  $('field-price-min').classList.toggle('hidden', !cfg.byMinute);
  pulsado($('pricing-energia'), !cfg.byMinute);
  pulsado($('pricing-tiempo'), cfg.byMinute);

  $('soc-valor').textContent = fmt(pctNow, 0) + ' %';

  // km de esta recarga con cada climatización, solo donde hay medidas propias
  const kpc = kmPorClima(r.energyIn, medidasR(prof), prof.chargeEff);
  CLIMAS.forEach(c => {
    $('km-' + c).textContent = r.nothingToCharge ? '' : kpc[c] !== null ? '≈ ' + fmt(kpc[c], 0) + ' km' : 'sin medidas';
  });

  renderConsumosUso(prof, cfg.elecCons, cfg.fuelCons);

  lastCalc = {
    chargerPrice: cfg.byMinute ? r.effectivePerKwh : cfg.chargerPrice,
    savings: r.net, km: r.km, free: r.sessionCost <= 0, vs: r.vs
  };
  renderChargers();
  D.saveSessionFrom(els, SESSION_KEYS, num);
}

// ======================= CLIMATIZACIÓN =======================

/** Guarda la climatización elegida y actualiza sus botones y pistas. */
function aplicarClima(){
  if(!D.activeProfile()) return;
  D.setClima(clima);
  syncClimaUI();
}

/**
 * Mi coche → «Consumos que usa el cálculo»: el valor con el que se calcula
 * ahora mismo y de dónde sale (medido con la climatización elegida o declarado).
 * Solo se muestra: un consumo escrito a mano no sería ni medido ni declarado.
 */
function renderConsumosUso(prof, elecCons, fuelCons){
  const sR = rParaClima(medidasR(prof), clima);
  const sG = consumoParaClima(D.loadFuel(), clima);
  const medidas = s => s.n + (s.n === 1 ? ' medida' : ' medidas') + ', ±' + fmt(s.band * 100, 0) + '%';

  $('uso-elec').innerHTML = fmt(elecCons, 1) + ' <small>kWh/100km</small>';
  const oe = $('uso-elec-origen');
  oe.textContent = sR.fuente === 'clima' ? 'Medido: ' + medidas(sR)
    : sR.fuente === 'sin-clasificar' ? 'Medido sin climatización indicada: ' + medidas(sR)
    : 'Declarado, sin medir: margen de error del 30%';
  tono(oe, sR.fuente === 'clima' ? null : 'warn');

  $('uso-fuel').innerHTML = fmt(fuelCons, 1) + ' <small>L/100km</small>';
  const of = $('uso-fuel-origen');
  of.textContent = sG.fuente === 'clima' ? 'Medido: ' + medidas(sG) : 'Declarado, sin medir';
  tono(of, sG.fuente === 'clima' ? null : 'warn');

  $('uso-nota').textContent = 'Con la climatización elegida en Calcular (' + CON_CLIMA[clima] + '). ' +
    'Los declarados de ' + prof.name + ' son ' + fmt(prof.elecCons, 1) + ' kWh/100km y ' +
    fmt(prof.fuelCons, 1) + ' L/100km; cada uno se sustituye por el medido en cuanto lo midas.';
}

function elegirClima(c){
  if(CLIMAS.indexOf(c) === -1) return;
  clima = c;
  aplicarClima();
  render();
}

function syncClimaUI(){
  document.querySelectorAll('#clima-row [data-clima]').forEach(b => {
    pulsado(b, b.getAttribute('data-clima') === clima);
  });
  const prof = D.activeProfile();
  const s = rParaClima(medidasR(prof), clima);
  const hint = $('clima-hint');
  if(s.fuente === 'clima'){
    hint.textContent = (s.n === 1 ? 'Con tu medida ' : 'Con tus ' + s.n + ' medidas ') + CON_CLIMA[clima] +
      ': ' + fmt(s.R, 2) + ' km/kWh, ±' + fmt(s.band * 100, 0) + '%.';
    hint.classList.remove('warn');
  } else if(s.fuente === 'sin-clasificar'){
    hint.textContent = 'No tienes medidas ' + CON_CLIMA[clima] + '. Se usan las que no tienen climatización ' +
      'indicada (' + fmt(s.R, 2) + ' km/kWh, ±' + fmt(s.band * 100, 0) + '%). Clasifícalas o haz una nueva.';
    hint.classList.add('warn');
  } else {
    hint.textContent = 'No tienes medidas ' + CON_CLIMA[clima] + ': se usa el consumo declarado, ' +
      'con un margen de error del 30%. Haz una medida para que el cálculo sea fiable.';
    hint.classList.add('warn');
  }

  // la gasolina: el consumo en híbrido medido con esta climatización, o el declarado
  const g = consumoParaClima(D.loadFuel(), clima);
  const gh = $('gas-hint');
  if(g.fuente === 'clima'){
    gh.textContent = 'Gasolina: ' + fmt(g.L, 1) + ' L/100km en híbrido, ' +
      (g.n === 1 ? 'con tu medida ' : 'con tus ' + g.n + ' medidas ') + CON_CLIMA[clima] +
      ', ±' + fmt(g.band * 100, 0) + '%.';
    gh.classList.remove('warn');
  } else {
    gh.textContent = 'Gasolina: se usa el consumo en híbrido declarado' +
      (prof ? ' (' + fmt(prof.fuelCons, 1) + ' L/100km)' : '') +
      ', sin medir ' + CON_CLIMA[clima] + '. Puedes medirlo en Mi coche.';
    gh.classList.add('warn');
  }
}

// ======================= VEHÍCULOS =======================

function renderVehicles(){
  const d = D.loadProfiles(), act = D.activeProfile();

  $('veh-pill-nombre').textContent = act ? act.name : '—';

  // lista para cambiar de vehículo: solo tiene sentido con más de uno
  $('veh-row').innerHTML = d.list.map(p => {
    const on = act && p.id === act.id;
    return `<button type="button" class="item" data-veh="${p.id}" aria-pressed="${on}">` +
      `<span class="n">${esc(p.name)}</span><span class="radio${on ? ' on' : ''}" aria-hidden="true"></span></button>`;
  }).join('');
  show($('veh-row'), d.list.length > 1);

  const sum = $('veh-summary');
  if(act){
    const chem = act.chem === 'lfp' ? 'Batería LFP' : act.chem === 'nmc' ? 'Batería NMC' : 'Química sin indicar';
    sum.innerHTML = `<div class="veh-head"><span class="nombre">${esc(act.name)}</span><span class="quim">${chem}</span></div>` +
      '<div class="spec">' +
      `<div><div class="k">Batería útil</div><div class="v num">${fmt(act.battery, 1)} kWh</div></div>` +
      `<div><div class="k">Carga máx. en AC</div><div class="v num">${fmt(act.maxPower, 1)} kW</div></div>` +
      `<div><div class="k">Consumo eléctrico declarado</div><div class="v num">${fmt(act.elecCons, 1)} kWh/100km</div></div>` +
      `<div><div class="k">Consumo en híbrido declarado</div><div class="v num">${fmt(act.fuelCons, 1)} L/100km</div></div>` +
      `<div><div class="k">Eficiencia de carga</div><div class="v num">${fmt(act.chargeEff, 0)}%</div></div>` +
      '</div>';
  } else sum.innerHTML = '';
}

function openVehicle(id){
  editingVehicleId = id || null;
  const p = id ? byId(D.loadProfiles().list, id) : null;
  $('ov-title').textContent = p ? 'Editar vehículo' : 'Configura tu vehículo';
  $('ov-lead').textContent = p
    ? 'Cambia lo que necesites. Los cálculos se actualizarán al guardar.'
    : 'Todos los cálculos dependen de estos datos. Los encontrarás en la ficha técnica, el manual o la web del fabricante.';
  $('ov-name').value      = p ? p.name : '';
  $('ov-battery').value   = p ? p.battery : '';
  $('ov-maxPower').value  = p ? p.maxPower : '';
  $('ov-elecCons').value  = p ? p.elecCons : '';
  $('ov-fuelCons').value  = p ? p.fuelCons : '';
  $('ov-chargeEff').value = p ? p.chargeEff : 85;
  $('ov-chem').value      = p ? (p.chem || 'unknown') : 'unknown';
  $('ov-err').classList.remove('show');
  $('ov-cancel').style.display = D.loadProfiles().list.length > 0 ? '' : 'none';
  $('ov-delete').style.display = (p && D.loadProfiles().list.length > 1) ? '' : 'none';
  openOverlay('overlay', true);
}

function saveVehicle(){
  const err = $('ov-err');
  const bad = msg => { err.textContent = msg; err.classList.add('show'); };
  const positive = (v, msg) => (!isFinite(v) || v <= 0) ? (bad(msg), true) : false;

  const name      = $('ov-name').value.trim().slice(0, 24);
  const battery   = parseFloat($('ov-battery').value);
  const maxPower  = parseFloat($('ov-maxPower').value);
  const elecCons  = parseFloat($('ov-elecCons').value);
  const fuelCons  = parseFloat($('ov-fuelCons').value);
  const chargeEff = parseFloat($('ov-chargeEff').value);
  const chem      = $('ov-chem').value;

  if(!name) return bad('Ponle un nombre al vehículo.');
  if(positive(battery,  'La capacidad de batería debe ser mayor que cero.')) return;
  if(positive(maxPower, 'La potencia máxima debe ser mayor que cero.')) return;
  if(positive(elecCons, 'El consumo eléctrico debe ser mayor que cero.')) return;
  if(positive(fuelCons, 'El consumo en híbrido debe ser mayor que cero.')) return;
  if(!isFinite(chargeEff) || chargeEff <= 0 || chargeEff > 100)
    return bad('La eficiencia debe estar entre 1 y 100%.');

  const d = D.loadProfiles();
  const entry = { id: editingVehicleId || ('v' + Date.now()),
    name, battery, maxPower, elecCons, fuelCons, chargeEff, chem };
  if(editingVehicleId){
    const cur = byId(d.list, editingVehicleId);
    if(cur) d.list[d.list.indexOf(cur)] = entry;
  } else {
    d.list.push(entry);
    d.activeId = entry.id;
  }
  D.saveProfiles(d);
  openOverlay('overlay', false);
  refreshAll();
}

function deleteVehicle(){
  if(!editingVehicleId) return;
  const d = D.loadProfiles();
  if(d.list.length <= 1){ alert('Debe quedar al menos un vehículo.'); return; }
  const p = byId(d.list, editingVehicleId);
  if(!p) return;
  const hist = D.loadHistory();
  let msg = `¿Eliminar "${p.name}"?`;
  if(hist.length) msg += '\n\nSe borrarán también sus ' + hist.length +
    (hist.length === 1 ? ' recarga guardada' : ' recargas guardadas') +
    ' y su calibración. No se puede deshacer.';
  if(!confirm(msg)) return;
  D.deleteProfile(editingVehicleId);
  openOverlay('overlay', false);
  refreshAll();
}

function switchVehicle(id){
  D.setActiveProfile(id);
  aplicarClima();
  refreshAll();
}

// ======================= CARGADORES =======================

const selectedCharger = () => selectedChargerId ? byId(D.loadChargers(), selectedChargerId) : null;

function setSelectedCharger(id){
  selectedChargerId = id;
  D.setSelectedChargerId(id);
}

const CHIPS_VISIBLES = 3;   // con más, aparece «Ver los N»

/** Precio de un cargador guardado tal como se ve en su chip y en la lista. */
function precioCargador(c){
  if(c.mode === 1) return fmt(c.perMin || 0, 2) + ' ' + EURO + '/min';
  return c.price > 0 ? fmt(c.price, 2) + ' ' + EURO + '/kWh' : 'gratis';
}

let ultimoHtmlChips = '';
function renderChargers(){
  const list = D.loadChargers();
  const sel = list.find(c => c.id === selectedChargerId);
  const chips = list.map(c => {
    const on = c.id === selectedChargerId;
    const reloj = c.overMin > 0 ? RELOJ : '';
    return `<button type="button" class="chip${on ? ' active' : ''}" data-id="${c.id}" aria-pressed="${on}"` +
      (c.overMin > 0 ? ' title="Cobra recargo si ocupas la plaza demasiado tiempo"' : '') + '>' +
      `<span class="n">${reloj}${esc(c.name)}</span><span class="p num">${precioCargador(c)}</span></button>`;
  }).join('');
  const todos = list.length > CHIPS_VISIBLES
    ? `<button type="button" class="chip chip-add" id="chip-todos">Ver los ${list.length}</button>` : '';
  const html = '<div class="chips"><button type="button" class="chip chip-add" id="chip-add">+ Guardar</button>' +
    chips + todos + '</div>' +
    (sel ? `<button type="button" class="chips-edit" data-editar="${sel.id}">Editar ${esc(sel.name)}</button>` : '') +
    (list.length ? '' : '<p class="saved-hint">Guarda aquí los puntos donde cargas para no reescribir sus datos.</p>');
  // solo se repinta si cambia: así la fila no vuelve al principio cada vez que escribes un número
  if(html !== ultimoHtmlChips){ $('saved-chargers').innerHTML = html; ultimoHtmlChips = html; }
}

function renderTodosCargadores(){
  $('chs-list').innerHTML = D.loadChargers().map(c => {
    const extra = [fmt(c.power, 1) + ' kW', precioCargador(c)];
    if(c.overMin > 0) extra.push('recargo desde ' + fmtTime(c.freeHours));
    return `<div class="item${c.id === selectedChargerId ? ' active' : ''}">` +
      `<button type="button" class="item-main" data-usar="${c.id}"><div class="n">${esc(c.name)}</div>` +
      `<div class="d num">${extra.join(' · ')}</div></button>` +
      `<button type="button" class="item-edit" data-editar="${c.id}">Editar</button></div>`;
  }).join('');
}

/** Usa un cargador guardado: rellena sus datos y lo marca. */
function usarCargador(id){
  const c = byId(D.loadChargers(), id);
  if(!c) return;
  setSelectedCharger(id);
  applyCharger(c);
  if(selectedOcmResult){ selectedOcmResult = null; renderCargadoresResultados(); }
  render();
}

// prefill (opcional): { name, power, helpText } — viene de un resultado de
// búsqueda de cargadores públicos (OCM) que el usuario tocó "+ Guardar
// este" sobre. helpText es el UsageCost + GeneralComments tal cual los dio
// OCM: solo texto de ayuda, nunca rellena freeHours/overMin (ver por qué
// en cargadores.js, junto a pareceRecargoPorTiempo).
function openCharger(id, prefill){
  editingChargerId = id || null;
  const c = id ? byId(D.loadChargers(), id) : null;
  $('ch-title').textContent = c ? 'Editar cargador' : 'Guardar cargador';
  $('ch-name').value      = c ? c.name : (prefill ? prefill.name : '');
  $('ch-power').value     = c ? c.power : (prefill ? prefill.power : num(els.chargerPower));
  $('ch-mode').value      = c ? (c.mode || 0) : num(els.pricingMode);
  $('ch-price').value     = c ? c.price : num(els.chargerPrice);
  $('ch-permin').value    = c ? (c.perMin || '') : num(els.pricePerMin);
  $('ch-freehours').value = c && c.overMin > 0 ? c.freeHours : '';
  $('ch-overmin').value   = c && c.overMin > 0 ? c.overMin : '';
  $('ch-note').value      = c ? (c.note || '') : '';
  $('ch-err').classList.remove('show');
  $('ch-delete').style.display = c ? '' : 'none';
  const feeHint = $('ch-fee-hint');
  if(feeHint){
    const texto = !c && prefill ? prefill.helpText : '';
    feeHint.textContent = texto || '';
    show(feeHint, !!texto);
  }
  syncChargerMode();
  openOverlay('ch-overlay', true);
}

function syncChargerMode(){
  const byMin = $('ch-mode').value === '1';
  $('ch-field-kwh').classList.toggle('hidden', byMin);
  $('ch-field-min').classList.toggle('hidden', !byMin);
}

function saveCharger(){
  const err = $('ch-err');
  const bad = m => { err.textContent = m; err.classList.add('show'); return false; };

  const name      = $('ch-name').value.trim().slice(0, 24);
  const power     = parseFloat($('ch-power').value);
  const chMode    = parseInt($('ch-mode').value, 10) || 0;
  const price     = parseFloat($('ch-price').value);
  const perMin    = parseFloat($('ch-permin').value);
  const freeHours = parseFloat($('ch-freehours').value);
  const overMin   = parseFloat($('ch-overmin').value);
  const note      = $('ch-note').value.trim().slice(0, 220);

  if(!name) return bad('Ponle un nombre.');
  if(!isFinite(power) || power <= 0) return bad('Indica la potencia del punto.');
  if(chMode === 0 && (!isFinite(price)  || price  < 0)) return bad('Indica el precio por kWh.');
  if(chMode === 1 && (!isFinite(perMin) || perMin < 0)) return bad('Indica el precio por minuto.');

  const hasOver = isFinite(overMin) && overMin > 0;
  if(hasOver && (!isFinite(freeHours) || freeHours < 0))
    return bad('Indica a partir de cuántas horas se cobra el recargo.');
  if(isFinite(freeHours) && freeHours > 0 && !hasOver)
    return bad('Indica cuánto cobra por minuto tras ese tiempo.');

  const list = D.loadChargers();
  const entry = {
    id: editingChargerId || ('c' + Date.now()), name, power, mode: chMode,
    price: isFinite(price) ? price : 0, perMin: isFinite(perMin) ? perMin : 0,
    freeHours: hasOver ? freeHours : 0, overMin: hasOver ? overMin : 0,
    note, updated: new Date().toISOString()
  };

  if(editingChargerId){
    const old = byId(list, editingChargerId);
    if(old){
      const oldVal = (old.mode || 0) === 1 ? (old.perMin || 0) : old.price;
      const newVal = entry.mode === 1 ? entry.perMin : entry.price;
      if((old.mode || 0) === entry.mode && Math.abs(oldVal - newVal) >= 0.005){
        alert(name + ' pasó de ' + fmt(oldVal, 2) + ' a ' + fmt(newVal, 2) + ' desde el ' +
          new Date(old.updated || Date.now()).toLocaleDateString('es-ES', { day:'2-digit', month:'short' }) + '.');
      }
      list[list.indexOf(old)] = entry;
    }
  } else {
    if(list.some(c => c.name.toLowerCase() === name.toLowerCase()))
      return bad('Ya tienes un cargador con ese nombre.');
    if(list.length >= 8) return bad('Puedes guardar hasta 8 cargadores. Borra alguno primero.');
    list.push(entry);
  }

  D.saveChargers(list);
  setSelectedCharger(entry.id);
  applyCharger(entry);
  openOverlay('ch-overlay', false);
  renderChargers();
  renderTodosCargadores();
  render();
  return true;
}

function deleteCharger(){
  if(!editingChargerId) return;
  const l = D.loadChargers(), c = byId(l, editingChargerId);
  if(!c) return;
  if(!confirm(`¿Borrar "${c.name}"?`)) return;
  D.saveChargers(l.filter(x => x.id !== editingChargerId));
  if(selectedChargerId === editingChargerId) setSelectedCharger(null);
  openOverlay('ch-overlay', false);
  renderChargers();
  renderTodosCargadores();
  render();
}

function applyCharger(c){
  els.chargerPower.value = c.power;
  els.pricingMode.value = c.mode || 0;
  if(c.mode === 1) els.pricePerMin.value = c.perMin;
  else els.chargerPrice.value = c.price;
}

// ======================= HISTORIAL Y CALIBRACIÓN =======================

const HIST_VISIBLES = 5;   // recargas que se ven en la lista

function renderHistory(){
  const p = D.activeProfile(), list = D.loadHistory();
  $('hist-count').textContent = list.length;

  let total = 0, gratis = 0, pagado = 0;
  list.forEach(e => { total += e.savings; if(e.free) gratis += e.savings; else pagado += e.savings; });

  const t = $('hist-total');
  t.textContent = (total >= 0 ? '+' : '\u2212') + fmt(Math.abs(total)) + ' ' + EURO;
  tono(t, total >= 0 ? 'good' : 'bad');

  let nota = '';
  if(list.length && gratis > 0 && pagado !== 0){
    nota = fmt(gratis / total * 100, 0) + '% viene de cargar gratis (' + fmt(gratis) + ' ' + EURO +
           ') y el resto de decisiones de pago (' + fmt(pagado) + ' ' + EURO + ').';
  } else if(list.length && gratis > 0){
    nota = 'Todo el ahorro viene de cargar gratis.';
  } else if(p){ nota = 'Historial de ' + p.name + '.'; }
  const nCasa = list.filter(e => e.vs === 'casa').length;
  if(nCasa) nota += ' ' + (nCasa === 1 ? '1 recarga se comparó' : nCasa + ' recargas se compararon') +
    ' con cargar en casa, no con la gasolina.';
  $('hist-note').textContent = nota.trim();

  // las 5 últimas, de más reciente a más antigua
  $('hist-list').innerHTML = list.slice(-HIST_VISIBLES).reverse().map(e => {
    const d = new Date(e.date);
    const fecha = isFinite(d) ? d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '';
    const signo = e.savings >= 0 ? '+' : '−';
    return `<div class="item"><div><div class="n num">${fecha}${e.free ? ' · gratis' : ''}${e.vs === 'casa' ? ' · frente a casa' : ''}</div>` +
      `<div class="d num">${fmt(e.km || 0, 0)} km${e.free ? '' : ' · ' + fmt(e.chargerPrice || 0, 2) + ' ' + EURO + '/kWh'}</div></div>` +
      `<div class="p num ${e.savings >= 0 ? 'pos' : 'neg'}">${signo}${fmt(Math.abs(e.savings))} ${EURO}</div></div>`;
  }).join('');
}

function renderCalibration(){
  const p = D.activeProfile();
  const dot = $('calib-dot'), main = $('calib-main'), sub = $('calib-sub'), btn = $('btn-mark-full');
  const chem = p ? (p.chem || 'unknown') : 'unknown';

  $('calib-card').classList.remove('hidden');

  if(chem === 'nmc'){
    btn.classList.add('hidden');
    tono(dot, 'muted'); tono(main, null);
    main.textContent = 'No cargues al 100% por costumbre';
    sub.textContent = 'Tu batería es NMC: mantenerla cerca del 100% acelera su desgaste. ' +
      'Para el día a día basta con quedarte entre el 20% y el 80%, y llegar al 100% solo antes de un viaje largo.';
    return;
  }
  if(chem === 'unknown'){
    btn.classList.add('hidden');
    tono(dot, 'muted'); tono(main, null);
    main.textContent = 'Indica el tipo de batería';
    sub.textContent = 'El consejo de carga cambia según sea LFP o NMC. Ponlo en los datos de tu vehículo ' +
      'y aquí verás el que te corresponde.';
    return;
  }

  btn.classList.remove('hidden');
  const raw = D.loadCalib();
  if(!raw){
    tono(dot, 'warn'); tono(main, 'warn');
    main.textContent = 'Sin registro todavía';
    sub.textContent = 'Tu batería es LFP: conviene llegar al 100% una vez por semana para que el coche ' +
      'no pierda precisión al medir la carga.';
    return;
  }
  const last = new Date(raw), days = Math.floor((Date.now() - last) / 86400000);
  const ds = last.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  if(days <= 7){
    tono(dot, 'good'); tono(main, 'good');
    main.textContent = days === 0 ? 'Calibrada hoy' : 'Calibrada hace ' + days + (days === 1 ? ' día' : ' días');
    sub.textContent = 'Última carga completa: ' + ds + '. Todo en orden.';
  } else if(days <= 14){
    tono(dot, 'warn'); tono(main, 'warn');
    main.textContent = 'Toca cargar al 100%';
    sub.textContent = 'Han pasado ' + days + ' días desde la última (' + ds + ').';
  } else {
    tono(dot, 'bad'); tono(main, 'bad');
    main.textContent = 'Calibración pendiente';
    sub.textContent = 'Han pasado ' + days + ' días (' + ds + '). El indicador puede estar desviado.';
  }
}

function flash(btn, txt){
  const o = btn.textContent;
  btn.textContent = txt;
  setTimeout(() => { btn.textContent = o; }, 1400);
}

function saveRecharge(btn){
  if(!lastCalc || !D.activeProfile()) return;
  const l = D.loadHistory();
  l.push({ date: new Date().toISOString(), chargerPrice: lastCalc.chargerPrice,
           savings: lastCalc.savings, km: lastCalc.km, free: !!lastCalc.free,
           // con qué se comparó: el ahorro frente a casa no es ahorro de gasolina
           vs: lastCalc.vs === 'casa' ? 'casa' : 'gasolina' });
  D.storeHistory(l);
  renderHistory();
  flash(btn, '\u2713 Guardada');
}

// ======================= MEDICIONES =======================

/**
 * Lo que rinde el coche con cada climatización, solo con datos medidos.
 * Lo usan la ficha de medición y la pestaña Mi coche.
 */
function resumenClimasHTML(list, prof){
  if(!list.length){
    return '<p class="r-nota" style="padding-top:12px">Todavía no has medido nada. Mientras tanto la app usa ' +
      'el consumo declarado, con un margen de error de alrededor del 30%.</p>';
  }
  const ETIQ = { calefaccion: 'Con calefacción', aire: 'Con aire', nada: 'Sin climatización' };
  let descartadas = 0;
  const filas = CLIMAS.map(c => {
    const s = rParaClima(list, c);
    if(s.fuente !== 'clima'){
      return `<div class="clima-g vacio"><div><div class="k">${ETIQ[c]}</div>` +
        '<div class="d">Se usa el consumo declarado, ±30%</div></div><div class="v">Sin medidas</div></div>';
    }
    descartadas += s.descartadas;
    const base = prof ? prof.chargeEff / s.R : 0;
    return `<div class="clima-g"><div><div class="k">${ETIQ[c]}</div>` +
      `<div class="d num">${s.n} ${s.n === 1 ? 'medida' : 'medidas'} · margen de error ±${fmt(s.band * 100, 0)}% · ` +
      `${fmt(base, 1)} kWh/100km</div></div>` +
      `<div class="v num">${fmt(s.R, 2)} <small>km/kWh</small></div></div>`;
  });
  const viejas = list.filter(sinClasificar).length;
  const notas = [];
  if(viejas) notas.push(`${viejas} ${viejas === 1 ? 'medida no tiene' : 'medidas no tienen'} la climatización ` +
    `indicada. Solo cuentan para una climatización sin medidas propias, y solo las de los ` +
    `${MEAS_MESES_SIN_CLASIFICAR} últimos meses. Clasifícalas en la lista de medidas si lo recuerdas.`);
  if(descartadas) notas.push(`Hay medidas guardadas que no cuentan: de cada climatización solo se usan las ` +
    `${MEAS_MAX} últimas de los ${MEAS_MESES} últimos meses.`);
  return filas.join('') + notas.map(n => `<p class="r-nota">${n}</p>`).join('');
}

function renderMeas(){
  const prof = D.activeProfile(), list = medidasR(prof);
  const chem = prof ? (prof.chem || 'unknown') : 'unknown';

  $('meas-level').innerHTML = chem === 'lfp'
    ? 'Con tu batería LFP, el <strong>100%</strong>: el coche se para solo ahí y además le conviene.'
    : chem === 'nmc'
      ? 'Con tu batería NMC no conviene llegar al 100%. Usa tu límite habitual, normalmente el <strong>80%</strong>, y repite siempre el mismo.'
      : 'Usa siempre el mismo nivel. Si tu batería es LFP, el 100%; si es NMC, tu límite habitual (suele ser el 80%).';

  const resumen = resumenClimasHTML(list, prof);
  $('meas-summary').innerHTML = resumen;
  $('r-resumen').innerHTML = resumen;

  const enUso = measEnUso(list);
  const CORTO = { calefaccion: 'calefacción', aire: 'aire', nada: 'sin clima' };
  $('meas-list').innerHTML = list.slice().reverse().map(m => {
    const d = new Date(m.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    const vieja = enUso.has(m.id) ? '' : ' meas-vieja';
    const etiqueta = sinClasificar(m) ? '' : ' · ' + CORTO[m.clima] + (m.frio ? ', frío' : '');
    // con el consumo en híbrido de ahora, sus litros pueden explicar casi todos los km
    const valor = m.invalida
      ? '<span class="c-warn">no vale con tu consumo en híbrido</span>'
      : `<strong>${fmt(m.R, 2)}</strong> km/kWh`;
    const fila = `<div class="meas-fila"><span>${d} · ${fmt(m.km, 0)} km / ${fmt(m.kwh, 1)} kWh${etiqueta}</span>` +
      `<span>${valor}` +
      `<button class="meas-del" data-mid="${m.id}" aria-label="Borrar">&times;</button></span></div>`;
    if(!sinClasificar(m)) return `<div class="meas-item${vieja}">${fila}</div>`;
    return `<div class="meas-item sin-clima${vieja}">${fila}<div class="meas-clasif">` +
      CLIMAS.map(c => `<button type="button" data-clasif="${m.id}" data-clima="${c}">${CORTO[c]}</button>`).join('') +
      `</div></div>`;
  }).join('');
}

/** Marca la climatización de una medida antigua. El frío se queda sin indicar: no se adivina. */
function clasificarMedida(id, c){
  if(CLIMAS.indexOf(c) === -1) return;
  const l = D.loadMeas();
  const m = l.find(x => x.id === id);
  if(!m) return;
  m.clima = c;
  D.storeMeas(l);
  renderMeas(); aplicarClima(); render();
}

function saveMeas(){
  const err = $('meas-err');
  const prof = D.activeProfile();
  if(!prof) return;

  const climaMedida = $('meas-clima').value;
  const res = buildMeasurement({
    km1: parseFloat($('meas-km1').value),
    km2: parseFloat($('meas-km2').value),
    kwh: parseFloat($('meas-kwh').value),
    litres: parseFloat($('meas-lit').value),
    // el mismo consumo con el que luego se recalcula (medidasR)
    fuelCons: baseFuelCons(prof, climaMedida),
    clima: climaMedida,
    frio: leerFrio('meas-frio')
  });

  if(!res.ok){ err.textContent = res.error; err.classList.add('show'); return; }

  const l = D.loadMeas();
  // el índice evita ids repetidos si se guardan dos medidas en el mismo milisegundo
  l.push({ id: 'm' + Date.now() + '-' + l.length, date: new Date().toISOString(),
           km: res.km, kmElec: res.kmElec, kwh: res.kwh, litres: res.litres,
           clima: res.clima, frio: res.frio, R: res.R });
  D.storeMeas(l);

  ['meas-km1', 'meas-km2', 'meas-kwh', 'meas-clima', 'meas-frio'].forEach(id => { $(id).value = ''; });
  $('meas-lit').value = '0';
  err.classList.remove('show');
  renderMeas();
  aplicarClima();
  render();
}

const leerFrio = id => $(id).value === 'si' ? true : $(id).value === 'no' ? false : null;

// ======================= CONSUMO EN HÍBRIDO =======================

// En qué va la gasolina gastada: 'L' (litros) o 'L100' (L/100 km). Solo cambia
// cómo se lee el número; empieza en litros, que es lo que dan el surtidor y el
// resumen de trayectos.
let unidadGasolina = 'L';

/** Lo que gasta el coche en híbrido con cada climatización, solo con datos medidos. */
function resumenConsumoHTML(list, prof){
  if(!list.length){
    return '<p class="r-nota" style="padding-top:12px">Todavía no lo has medido. Mientras tanto la app usa ' +
      'el consumo en híbrido que declaraste' + (prof ? ' (' + fmt(prof.fuelCons, 1) + ' L/100km)' : '') + '.</p>';
  }
  const ETIQ = { calefaccion: 'Con calefacción', aire: 'Con aire', nada: 'Sin climatización' };
  let descartadas = 0;
  const filas = CLIMAS.map(c => {
    const s = consumoParaClima(list, c);
    if(s.fuente !== 'clima'){
      return `<div class="clima-g vacio"><div><div class="k">${ETIQ[c]}</div>` +
        '<div class="d">Se usa el declarado</div></div><div class="v">Sin medidas</div></div>';
    }
    descartadas += s.descartadas;
    return `<div class="clima-g"><div><div class="k">${ETIQ[c]}</div>` +
      `<div class="d num">${s.n} ${s.n === 1 ? 'medida' : 'medidas'} · margen de error ±${fmt(s.band * 100, 0)}%</div></div>` +
      `<div class="v num">${fmt(s.L, 1)} <small>L/100km</small></div></div>`;
  });
  const nota = descartadas ? `<p class="r-nota">Hay medidas guardadas que no cuentan: de cada climatización solo se ` +
    `usan las ${MEAS_MAX} últimas de los ${MEAS_MESES} últimos meses.</p>` : '';
  return filas.join('') + nota;
}

function syncUnidadGasolina(){
  const l100 = unidadGasolina === 'L100';
  $('fuel-unidad').textContent = l100 ? 'L/100 km' : 'litros';
  $('fuel-valor-hint').textContent = l100
    ? 'El que marca el contador del tramo, no el acumulado. Toca la unidad para cambiarla'
    : 'Los del surtidor, o la suma de los de cada trayecto. Toca la unidad para cambiarla';
}

function cambiarUnidadGasolina(){
  unidadGasolina = unidadGasolina === 'L100' ? 'L' : 'L100';
  syncUnidadGasolina();
}

function renderFuel(){
  const list = D.loadFuel(), prof = D.activeProfile();
  const resumen = resumenConsumoHTML(list, prof);
  $('fuel-summary').innerHTML = resumen;
  $('g-resumen').innerHTML = resumen;
  syncUnidadGasolina();

  const enUso = measEnUso(list);
  const CORTO = { calefaccion: 'calefacción', aire: 'aire', nada: 'sin clima' };
  $('fuel-list').innerHTML = list.slice().reverse().map(m => {
    const d = new Date(m.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    const vieja = enUso.has(m.id) ? '' : ' meas-vieja';
    return `<div class="meas-item${vieja}"><div class="meas-fila">` +
      `<span>${d} · ${fmt(m.km, 0)} km · ${fmt(m.litres, 1)} L` +
      // las medidas anteriores al 2026-11-08-3 no guardaban el % de batería
      (isFinite(m.socIni) && isFinite(m.socFin) ? ` · ${fmt(m.socIni, 0)}→${fmt(m.socFin, 0)} %` : '') +
      ` · ${CORTO[m.clima]}${m.frio ? ', frío' : ''}</span>` +
      `<span><strong>${fmt(m.L, 1)}</strong> L/100km` +
      `<button class="meas-del" data-fid="${m.id}" aria-label="Borrar">&times;</button></span></div></div>`;
  }).join('');
}

/** Tras cambiar las medidas de consumo: cambian la gasolina del cálculo y el R de las medidas eléctricas. */
function trasCambiarConsumo(){
  renderFuel(); renderMeas(); aplicarClima(); render();
}

function saveFuel(){
  const err = $('fuel-err');
  if(!D.activeProfile()) return;

  const res = buildFuelMeasurement({
    km1: parseFloat($('fuel-km1').value),
    km2: parseFloat($('fuel-km2').value),
    valor: parseFloat($('fuel-valor').value),
    unidad: unidadGasolina,
    socIni: parseFloat($('fuel-soc1').value),
    socFin: parseFloat($('fuel-soc2').value),
    clima: $('fuel-clima').value,
    frio: leerFrio('fuel-frio')
  });
  if(!res.ok){ err.textContent = res.error; err.classList.add('show'); return; }

  const l = D.loadFuel();
  l.push({ id: 'f' + Date.now() + '-' + l.length, date: new Date().toISOString(),
           km: res.km, litres: res.litres, L: res.L,
           socIni: res.socIni, socFin: res.socFin, clima: res.clima, frio: res.frio });
  D.storeFuel(l);

  ['fuel-km1', 'fuel-km2', 'fuel-valor', 'fuel-soc1', 'fuel-soc2', 'fuel-clima', 'fuel-frio']
    .forEach(id => { $(id).value = ''; });
  err.classList.remove('show');
  trasCambiarConsumo();
}

function borrarConsumo(id){
  D.storeFuel(D.loadFuel().filter(m => m.id !== id));
  trasCambiarConsumo();
}

// ======================= CARGA EN CASA =======================

/** La casa con la que comparar ahora: configurada y con «sí, voy a cargar en casa antes». */
function casaActiva(){
  const c = D.loadCasa();
  return c && D.getVsCasa() ? c : null;
}

/** La pregunta de Calcular: solo aparece si la casa está configurada en Ajustes. */
function syncCasaUI(r){
  const c = D.loadCasa();
  show($('sec-casa'), !!c);
  if(!c) return;
  const si = D.getVsCasa();
  pulsado($('casa-si'), si);
  pulsado($('casa-no'), !si);
  $('casa-hint').textContent = si
    ? 'Lo que cargues aquí no lo cargarás esta noche en casa, a ' + fmt(c.precio, 3) + ' ' + EURO +
      '/kWh: se compara con eso, no con la gasolina.' +
      (r && r.vs === 'casa' && !r.nothingToCharge ? ' Si estás cargando en casa ahora, elige «No».' : '')
    : 'Se compara con la gasolina: vas de viaje, no llegarás a casa antes de gastar la batería o estás cargando en casa ahora.';
}

function elegirVsCasa(on){
  D.setVsCasa(on);
  render();
}

function renderCasa(){
  const c = D.loadCasa();
  $('casa-estado').textContent = c
    ? 'Guardado: ' + fmt(c.precio, 3) + ' ' + EURO + '/kWh a ' + fmt(c.potencia, 1) + ' kW.'
    : 'No has indicado que cargues en casa: Calcular compara siempre con la gasolina.';
  if(c){ $('casa-precio').value = c.precio; $('casa-potencia').value = c.potencia; }
  show($('casa-borrar'), !!c);
}

function saveCasa(){
  const err = $('casa-err');
  const res = buildCasa({
    precio: parseFloat($('casa-precio').value),
    potencia: parseFloat($('casa-potencia').value)
  });
  if(!res.ok){ err.textContent = res.error; err.classList.add('show'); return; }
  err.classList.remove('show');
  D.saveCasa(res);
  renderCasa(); render();
}

function borrarCasa(){
  D.saveCasa(null);
  $('casa-precio').value = ''; $('casa-potencia').value = '';
  $('casa-err').classList.remove('show');
  renderCasa(); render();
}

// ======================= DESCUENTOS (AJUSTES) =======================

function renderDescuentos(){
  const l = D.loadDescuentos();
  $('dto-list').innerHTML = l.length
    ? l.map((d, i) => `<div class="item"><div class="item-main"><div class="n num">${textoDescuento(d)}</div>` +
        `<div class="d">en ${esc(d.marcas.join(', '))}</div></div>` +
        `<button type="button" class="item-edit" data-dto-editar="${i}">Editar</button>` +
        `<button type="button" class="meas-del" data-dto-borrar="${i}" aria-label="Borrar">&times;</button></div>`).join('')
    : '<p class="r-nota" style="padding-top:12px">No tienes ninguno: se usa el precio del surtidor.</p>';
  $('dto-save').textContent = editingDescuento !== null ? 'Guardar cambios' : 'Añadir descuento';
  show($('dto-cancel'), editingDescuento !== null);
}

function limpiarFormDescuento(){
  editingDescuento = null;
  $('dto-valor').value = ''; $('dto-marcas').value = ''; $('dto-unidad').value = 'cent';
  $('dto-err').classList.remove('show');
}

function editarDescuento(i){
  const d = D.loadDescuentos()[i];
  if(!d) return;
  editingDescuento = i;
  $('dto-valor').value = d.valor; $('dto-unidad').value = d.unidad; $('dto-marcas').value = d.marcas.join(', ');
  $('dto-err').classList.remove('show');
  renderDescuentos();
}

function saveDescuento(){
  const err = $('dto-err');
  const res = buildDescuento({
    valor: parseFloat($('dto-valor').value),
    // el select arranca en la primera opción, como en el navegador
    unidad: $('dto-unidad').value || 'cent',
    marcas: $('dto-marcas').value
  });
  if(!res.ok){ err.textContent = res.error; err.classList.add('show'); return; }
  const l = D.loadDescuentos();
  const d = { valor: res.valor, unidad: res.unidad, marcas: res.marcas };
  if(editingDescuento !== null && l[editingDescuento]) l[editingDescuento] = d; else l.push(d);
  D.saveDescuentos(l);
  limpiarFormDescuento();
  trasCambiarDescuentos();
}

function borrarDescuento(i){
  const l = D.loadDescuentos();
  if(!l[i]) return;
  l.splice(i, 1);
  D.saveDescuentos(l);
  limpiarFormDescuento();
  trasCambiarDescuentos();
}

function trasCambiarDescuentos(){
  renderDescuentos(); pintarEstaciones(); render();
}

// ======================= GASOLINERAS =======================

// Las dos búsquedas (ubicación y lugar) comparten nota y lista; mientras una
// está en marcha se bloquean ambas para que no se pisen los resultados.
function gasolinerasOcupado(on, cual){
  $('btn-refresh').disabled = on;
  $('btn-lugar').disabled = on;
  $('refresh-btn-label').textContent = on && cual === 'gps' ? 'Buscando...' : 'Cerca de mí';
  $('btn-lugar').textContent = on && cual === 'lugar' ? 'Buscando...' : 'Buscar';
}

function ocultarOpcionesLugar(){
  lugaresPendientes = [];
  const el = $('lugar-opciones');
  el.style.display = 'none';
  el.innerHTML = '';
}

function falloGasolineras(e){
  gasolinerasOcupado(false);
  ocultarOpcionesLugar();
  $('refresh-note').innerHTML = `<span class="c-warn">${MENSAJES[e && e.message] || MENSAJES.default}</span> ` +
    `Puedes escribir el precio a mano, o ` +
    `<a href="https://geoportalgasolineras.es/geoportal-instalaciones/Inicio" target="_blank" ` +
    `rel="noopener" class="c-good">verlo en el Geoportal</a>.`;
}

function renderStations({ top, avg, count, fecha, lugar }){
  const hint = $('fuel-hint');
  lastStations = top;
  lastLugar = lugar || null;
  estacionElegida = null;

  // la media es de todas las marcas: sin descuento
  els.fuelPrice.value = avg.toFixed(3);
  D.setEstacion(null);
  hint.textContent = 'Media de ' + count + ' gasolineras ' + (lugar ? 'cerca de ' + lugar.nombre : 'cercanas');
  hint.classList.add('live');
  $('refresh-note').textContent = 'Precios oficiales del Ministerio' + (fecha ? ', ' + fecha : '') + '.' +
    (lugar ? ' Distancias en línea recta desde el centro de ' + lugar.nombre + '.' : '') +
    ' Toca una para usar su precio.';

  $('station-list').classList.remove('open');
  pintarEstaciones();
  render();
}

/**
 * Lista de gasolineras, plegada por defecto: se ve solo la elegida (o la más
 * barata, si no has elegido ninguna) y un botón para ver todas. Todas están en
 * el HTML; las demás se ocultan con la clase .extra.
 */
function pintarEstaciones(){
  const listEl = $('station-list');
  if(!lastStations.length){ listEl.style.display = 'none'; listEl.innerHTML = ''; return; }
  const cheapest = masBarata();
  const visible = estacionElegida !== null ? estacionElegida : Math.max(0, lastStations.indexOf(cheapest));
  const abierta = listEl.classList.contains('open');
  listEl.style.display = 'block';
  listEl.innerHTML = lastStations.map((s, idx) => {
    const tag = s === cheapest ? '<span class="tag">MÁS BARATA</span>' : '';
    const loc = lastLugar && s.localidad ? ' · ' + esc(s.localidad) : '';
    const cls = 'item station' + (idx === visible ? '' : ' extra') + (idx === estacionElegida ? ' active' : '');
    // con descuento: lo que pagas, y debajo el precio del surtidor tachado
    const pg = pagasEn(s);
    const precio = pg.descuento
      ? `${fmt(pg.precio, 3)}<span class="surtidor">${fmt(s.price, 3)}</span>`
      : fmt(s.price, 3);
    const conDto = pg.descuento ? ' · con tu ' + textoDescuento(pg.descuento) : '';
    return `<button type="button" class="${cls}" data-idx="${idx}"><div><div class="n">${esc(s.name)}${tag}</div>` +
      `<div class="d">${esc(s.addr)}${loc} · ${fmt(s.dist, 1)} km${conDto}</div></div>` +
      `<div class="p num">${precio}</div></button>`;
  }).join('') + (lastStations.length > 1
    ? `<button type="button" class="item link" data-est-toggle aria-expanded="${abierta}">` +
      (abierta ? 'Ver solo ' + (estacionElegida !== null ? 'la elegida' : 'la más barata')
               : 'Ver las ' + lastStations.length + ' gasolineras') + '</button>'
    : '');
}

async function fetchRealPrices(){
  gasolinerasOcupado(true, 'gps');
  try{
    const res = await buscarCercanas();
    ocultarOpcionesLugar();
    renderStations(res);
    gasolinerasOcupado(false);
  }catch(e){
    falloGasolineras(e);
  }
}

async function usarLugar(lugar){
  gasolinerasOcupado(true, 'lugar');
  try{
    const res = await buscarEnLugar(lugar);
    ocultarOpcionesLugar();
    renderStations(res);
    gasolinerasOcupado(false);
  }catch(e){
    falloGasolineras(e);
  }
}

async function buscarPorLugar(){
  const input = $('lugar-q'), texto = input.value;
  if(input.blur) input.blur();   // cierra el teclado del móvil
  gasolinerasOcupado(true, 'lugar');
  ocultarOpcionesLugar();
  try{
    const lugares = await resolverLugar(texto);
    D.setLugar(texto);
    if(lugares.length === 1) return await usarLugar(lugares[0]);

    lugaresPendientes = lugares;
    const el = $('lugar-opciones');
    el.style.display = 'block';
    el.innerHTML = lugares.map((l, i) =>
      `<button type="button" class="item" data-lugar="${i}"><div><div class="n">${esc(l.nombre)}</div>` +
      `<div class="d">${esc(l.zona)}</div></div></button>`).join('');
    $('refresh-note').textContent = 'Hay varios lugares con ese nombre. ¿Cuál es?';
    gasolinerasOcupado(false);
  }catch(e){
    falloGasolineras(e);
  }
}

// ======================= CARGADORES PÚBLICOS (OCM) =======================

async function buscarCargadoresCercanos(){
  const btn = $('btn-buscar-cargadores'), label = $('buscar-cargadores-label');
  const note = $('cargadores-note'), listEl = $('cargadores-resultados');

  const reset = () => { btn.disabled = false; label.textContent = 'Buscar cerca'; };
  const fail = msg => {
    reset();
    note.innerHTML = `<span class="c-warn">${msg}</span>`;
    show(note, true);
    listEl.innerHTML = '';
    lastOcmResults = [];
  };

  btn.disabled = true;
  label.textContent = 'Buscando...';

  try{
    const { resultados, radioKm } = await buscarCargadoresOCM();
    lastOcmResults = resultados;
    selectedOcmResult = null;
    mostrarTodosOcm = false;
    ocmPlegado = false;

    note.textContent = 'Distancias en línea recta, no por carretera \u00b7 hasta ' +
      fmt(radioKm, 0) + ' km.';

    renderCargadoresResultados();
    reset();
  }catch(e){
    fail(MENSAJES_OCM[e && e.message] || MENSAJES_OCM.default);
  }
}

/**
 * Lista de cargadores públicos. Desplegada: las 5 primeras y «Ver N más».
 * Plegada: solo la cabecera y, si hay una abierta, esa tarjeta (su potencia
 * es la que está en uso y «+ Guardar» parte de ella).
 */
function renderCargadoresResultados(){
  const listEl = $('cargadores-resultados');
  if(!lastOcmResults.length){ listEl.innerHTML = ''; return; }
  const visibles = ocmPlegado
    ? (selectedOcmResult ? [selectedOcmResult] : [])
    : (mostrarTodosOcm ? lastOcmResults : lastOcmResults.slice(0, OCM_VISIBLES));
  const resto = ocmPlegado ? 0 : lastOcmResults.length - visibles.length;
  const n = lastOcmResults.length;
  // la nota de distancias solo tiene sentido con la lista a la vista
  show($('cargadores-note'), !ocmPlegado);

  const cabecera = `<div class="ocm-cabecera"><span>${n} ${n === 1 ? 'cargador cercano' : 'cargadores cercanos'}</span>` +
    `<button type="button" class="ocm-toggle" data-ocm-toggle="${ocmPlegado ? 'mostrar' : 'ocultar'}" ` +
    `aria-expanded="${!ocmPlegado}">${ocmPlegado ? 'Mostrar' : 'Ocultar'}</button></div>`;

  const tarjetas = visibles.map(r => {
    const sel = selectedOcmResult && selectedOcmResult.id === r.id;
    const maxKw = Math.max(...r.conexiones.map(c => c.kw));
    const resumenKw = (r.conexiones.length > 1 ? 'hasta ' : '') + fmt(maxKw, maxKw % 1 ? 1 : 0) + ' kW';
    const distLabel = r.distanceKm == null ? '' :
      (r.distanceKm < 1 ? Math.round(r.distanceKm * 1000) + ' m' : fmt(r.distanceKm, 1) + ' km');

    let detalle = '';
    if(sel){
      const lineas = r.conexiones.map(c =>
        `<div class="ocm-line">${c.qty > 1 ? c.qty + '\u00d7 ' : ''}Tipo 2 \u00b7 ${fmt(c.kw, c.kw % 1 ? 1 : 0)} kW</div>`
      ).join('');
      const fr = frescuraOCM(r.verified);
      const avisoTiempo = pareceRecargoPorTiempo(r.price, r.note);
      detalle = `<div class="ocm-detalle">
        ${lineas}
        ${r.operatorName ? `<div class="ocm-operator">${esc(r.operatorName)}</div>` : ''}
        ${r.price ? `<div class="ocm-price">${esc(r.price)} \u00b7 orientativo, conf\u00edrmalo al llegar</div>` : ''}
        ${r.note ? `<div class="ocm-note${avisoTiempo ? ' warn' : ''}">${esc(r.note)}</div>` : ''}
        <div class="ocm-verified ocm-verified-${fr.nivel}">${fr.label}</div>
      </div>`;
    }

    return `<button type="button" class="ocm-card${sel ? ' active' : ''}" data-ocm-id="${r.id}">
      <div class="ocm-head">
        <span class="ocm-title"><span class="ocm-chevron">${sel ? '\u25be' : '\u25b8'}</span>${esc(r.name)}${r.yaGuardado ? '<span class="tag">GUARDADO</span>' : ''}</span>
        <span class="ocm-dist">${distLabel}</span>
      </div>
      ${r.address ? `<div class="ocm-address">${esc(r.address)}</div>` : ''}
      <div class="ocm-summary">${resumenKw}</div>
      ${detalle}
    </button>`;
  }).join('');

  const toggle = resto > 0
    ? `<button type="button" class="ocm-toggle" data-ocm-toggle="mas">Ver ${resto} m\u00e1s</button>`
    : (!ocmPlegado && mostrarTodosOcm && lastOcmResults.length > OCM_VISIBLES
        ? `<button type="button" class="ocm-toggle" data-ocm-toggle="menos">Ver menos</button>`
        : '');

  listEl.innerHTML = cabecera + tarjetas + toggle;
}

/** 'ocultar' / 'mostrar' pliegan la lista; 'mas' / 'menos' cambian cuántas se ven. */
function cambiarListaOcm(v){
  if(v === 'ocultar' || v === 'mostrar') ocmPlegado = v === 'ocultar';
  else if(v === 'mas' || v === 'menos') mostrarTodosOcm = v === 'mas';
  renderCargadoresResultados();
}

function seleccionarOcmResultado(id){
  const r = lastOcmResults.find(x => String(x.id) === String(id));
  if(!r) return;
  // toca la ya seleccionada: se contrae (deselecciona), en vez de quedarse fija
  selectedOcmResult = (selectedOcmResult && selectedOcmResult.id === r.id) ? null : r;
  if(selectedOcmResult){
    els.chargerPower.value = Math.max(...selectedOcmResult.conexiones.map(c => c.kw));
    if(selectedChargerId){ setSelectedCharger(null); renderChargers(); }
  }
  renderCargadoresResultados();
  render();
}

// ======================= MODO =======================

const AYUDA_MODO = {
  parked: 'El tiempo no cuenta como coste: el coche iba a estar aquí igualmente.',
  trip: 'Se descuenta el desvío: son kilómetros que no habrías hecho.'
};

function setMode(m){
  mode = m;
  D.setMode(m);
  pulsado($('mode-parked'), m === 'parked');
  pulsado($('mode-trip'), m === 'trip');
  $('mode-help').textContent = AYUDA_MODO[m] || '';
  $('block-parked').classList.toggle('hidden', m !== 'parked');
  $('block-trip').classList.toggle('hidden', m !== 'trip');
  render();
}

// ======================= PESTAÑAS =======================

const TABS = ['tab-calcular', 'tab-coche', 'tab-ajustes', 'tab-ayuda'];

function irA(id){
  if(TABS.indexOf(id) === -1) return;
  TABS.forEach(t => {
    $(t).hidden = t !== id;
    const b = $('tabbtn-' + t.slice(4));
    b.classList.toggle('active', t === id);
    if(b.setAttribute) b.setAttribute('aria-selected', t === id ? 'true' : 'false');
  });
  if(window.scrollTo) window.scrollTo(0, 0);
}

/** Valor de inp-parkHours convertido a horas, sea cual sea la unidad mostrada. */
function parkHoursValue(){
  const v = num(els.parkHours);
  return parkUnit === 'min' ? v / 60 : v;
}

function syncParkUnitUI(){
  $('btn-parkUnit').textContent = parkUnit === 'min' ? 'min' : 'horas';
  els.parkHours.step = parkUnit === 'min' ? '1' : '0.25';
}

/** Cambia min<->horas conservando la duración real (transparente para quien escribe). */
function toggleParkUnit(){
  const horas = parkHoursValue(); // con la unidad todavía antigua
  parkUnit = parkUnit === 'min' ? 'h' : 'min';
  D.setParkUnit(parkUnit);
  const mostrado = parkUnit === 'min' ? horas * 60 : horas;
  const decimales = parkUnit === 'min' ? 0 : 2;
  const factor = 10 ** decimales;
  els.parkHours.value = Math.round(mostrado * factor) / factor;
  syncParkUnitUI();
  render();
}

function refreshAll(){
  renderVehicles();
  aplicarClima();
  renderCalibration();
  renderHistory();
  renderMeas();
  renderFuel();
  renderDescuentos();
  renderCasa();
  render();
}

// ======================= COPIA DE SEGURIDAD =======================

async function exportarCopia(){
  const datos = D.exportAll();
  const nombre = 'carga-vs-gasolina-copia-' + new Date().toISOString().slice(0, 10) + '.json';
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });

  // en el móvil, compartir permite guardar directo en Archivos/iCloud
  if(navigator.share && navigator.canShare){
    try{
      const file = new File([blob], nombre, { type: 'application/json' });
      if(navigator.canShare({ files: [file] })){
        await navigator.share({ files: [file], title: 'Copia de seguridad' });
        return;
      }
    }catch(e){ /* cancelado o sin soporte: sigue con la descarga normal */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function importarCopia(file){
  const nota = $('backup-note');
  const reader = new FileReader();
  reader.onload = () => {
    let datos;
    try{ datos = JSON.parse(reader.result); }
    catch(e){ nota.textContent = 'Ese archivo no es una copia de seguridad válida.'; return; }
    if(!confirm('Esto sustituirá los datos actuales (vehículos, historial, medidas) por los de la copia. ¿Continuar?')) return;
    if(!D.importAll(datos)){
      nota.textContent = 'Ese archivo no es una copia de seguridad válida.';
      return;
    }
    location.reload();
  };
  reader.onerror = () => { nota.textContent = 'No se ha podido leer el archivo.'; };
  reader.readAsText(file);
}

// ======================= EVENTOS =======================

function bindEvents(){
  SESSION_KEYS.forEach(k => els[k].addEventListener('input', render));

  // --- pestañas ---
  $('tabbar').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if(b) irA(b.getAttribute('data-tab'));
  });
  $('veh-pill').addEventListener('click', () => irA('tab-coche'));

  // --- vehículos ---
  $('veh-row').addEventListener('click', e => {
    const b = e.target.closest('[data-veh]');
    if(!b) return;
    const id = b.getAttribute('data-veh');
    const act = D.activeProfile();
    if(act && act.id === id) openVehicle(id); else switchVehicle(id);
  });
  $('ov-save').addEventListener('click', saveVehicle);
  $('ov-cancel').addEventListener('click', () => openOverlay('overlay', false));
  $('ov-delete').addEventListener('click', deleteVehicle);
  $('btn-edit-vehicle').addEventListener('click', () => {
    const p = D.activeProfile(); if(p) openVehicle(p.id);
  });
  $('btn-add-vehicle').addEventListener('click', () => openVehicle(null));

  // --- la recarga ---
  $('mode-parked').addEventListener('click', () => setMode('parked'));
  $('mode-trip').addEventListener('click', () => setMode('trip'));
  $('btn-parkUnit').addEventListener('click', toggleParkUnit);
  $('btn-save-parked').addEventListener('click', function(){ saveRecharge(this); });
  $('btn-save-trip').addEventListener('click', function(){ saveRecharge(this); });

  // --- mi coche ---
  $('btn-mark-full').addEventListener('click', function(){
    if(!D.activeProfile()) return;
    D.storeCalib(new Date().toISOString());
    renderCalibration();
    flash(this, '✓ Registrado');
  });
  $('btn-clear-history').addEventListener('click', () => {
    const p = D.activeProfile(); if(!p) return;
    if(!confirm('¿Borrar el historial de ' + p.name + '?')) return;
    D.storeHistory([]); renderHistory();
  });

  $('clima-row').addEventListener('click', e => {
    const b = e.target.closest('[data-clima]'); if(!b) return;
    elegirClima(b.getAttribute('data-clima'));
  });

  // --- gasolina ---
  $('btn-refresh').addEventListener('click', fetchRealPrices);
  $('form-lugar').addEventListener('submit', e => {
    if(e && e.preventDefault) e.preventDefault();
    buscarPorLugar();
  });
  $('lugar-opciones').addEventListener('click', e => {
    const row = e.target.closest('[data-lugar]'); if(!row) return;
    const l = lugaresPendientes[parseInt(row.getAttribute('data-lugar'), 10)];
    if(l) usarLugar(l);
  });
  $('station-list').addEventListener('click', e => {
    if(e.target.closest('[data-est-toggle]')){
      $('station-list').classList.toggle('open');
      return pintarEstaciones();
    }
    const row = e.target.closest('[data-idx]'); if(!row) return;
    const idx = parseInt(row.getAttribute('data-idx'), 10);
    const st = lastStations[idx];
    if(!st) return;
    estacionElegida = idx;
    els.fuelPrice.value = st.price.toFixed(3);
    D.setEstacion(st);   // su rótulo decide qué descuento le toca
    const hint = $('fuel-hint');
    hint.textContent = st.name + ' · ' + fmt(st.dist, 1) + ' km' +
      (lastLugar ? ' del centro de ' + lastLugar.nombre : '');
    hint.classList.add('live');
    pintarEstaciones();
    render();
  });

  // --- dónde cargas ---
  $('btn-buscar-cargadores').addEventListener('click', buscarCargadoresCercanos);
  $('cargadores-resultados').addEventListener('click', e => {
    const toggle = e.target.closest('[data-ocm-toggle]');
    if(toggle) return cambiarListaOcm(toggle.getAttribute('data-ocm-toggle'));
    const card = e.target.closest('[data-ocm-id]');
    if(card) seleccionarOcmResultado(card.getAttribute('data-ocm-id'));
  });

  $('saved-chargers').addEventListener('click', e => {
    const ed = e.target.closest('[data-editar]');
    if(ed) return openCharger(ed.getAttribute('data-editar'));
    if(e.target.closest('#chip-todos')){
      renderTodosCargadores();
      return openOverlay('chs-overlay', true);
    }
    if(e.target.closest('#chip-add')){
      if(selectedOcmResult){
        const r = selectedOcmResult;
        const helpText = [r.price, r.note].filter(Boolean).join(' · ');
        return openCharger(null, {
          name: r.name,
          power: Math.max(...r.conexiones.map(c => c.kw)),
          helpText
        });
      }
      return openCharger(null);
    }
    const chip = e.target.closest('[data-id]');
    if(!chip) return;
    const id = chip.getAttribute('data-id');
    // tocar el que ya está elegido lo abre para editarlo (además del botón «Editar»)
    if(id === selectedChargerId) return openCharger(id);
    usarCargador(id);
  });
  $('chs-list').addEventListener('click', e => {
    const ed = e.target.closest('[data-editar]');
    if(ed) return openCharger(ed.getAttribute('data-editar'));
    const u = e.target.closest('[data-usar]');
    if(u){ usarCargador(u.getAttribute('data-usar')); openOverlay('chs-overlay', false); }
  });
  $('chs-close').addEventListener('click', () => openOverlay('chs-overlay', false));
  $('ch-save').addEventListener('click', saveCharger);
  $('ch-cancel').addEventListener('click', () => openOverlay('ch-overlay', false));
  $('ch-delete').addEventListener('click', deleteCharger);
  $('ch-mode').addEventListener('change', syncChargerMode);

  const setPricing = m => {
    if(num(els.pricingMode) === m) return;
    els.pricingMode.value = m;
    if(selectedChargerId) setSelectedCharger(null);
    if(selectedOcmResult){ selectedOcmResult = null; renderCargadoresResultados(); }
    render();
  };
  $('pricing-energia').addEventListener('click', () => setPricing(0));
  $('pricing-tiempo').addEventListener('click', () => setPricing(1));

  // tocar los datos del punto a mano deselecciona el cargador guardado
  // y también la tarjeta de búsqueda de OCM, si había una activa
  ['chargerPrice', 'chargerPower', 'pricePerMin', 'pricingMode'].forEach(k => {
    els[k].addEventListener('input', () => {
      if(selectedChargerId){ setSelectedCharger(null); renderChargers(); }
      if(selectedOcmResult){ selectedOcmResult = null; renderCargadoresResultados(); }
    });
  });

  // --- ajustes ---
  $('btn-backup-export').addEventListener('click', exportarCopia);
  $('btn-backup-import').addEventListener('click', () => $('inp-backup-file').click());
  $('inp-backup-file').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if(f) importarCopia(f);
    e.target.value = '';
  });

  // --- medidas ---
  $('btn-measure').addEventListener('click', () => {
    $('meas-err').classList.remove('show'); renderMeas(); openOverlay('meas-overlay', true);
  });
  $('meas-close').addEventListener('click', () => openOverlay('meas-overlay', false));
  $('meas-save').addEventListener('click', saveMeas);
  $('meas-list').addEventListener('click', e => {
    const cl = e.target.closest('[data-clasif]');
    if(cl) return clasificarMedida(cl.getAttribute('data-clasif'), cl.getAttribute('data-clima'));
    const b = e.target.closest('[data-mid]'); if(!b) return;
    if(!confirm('¿Borrar esta medida?')) return;
    const id = b.getAttribute('data-mid');
    D.storeMeas(D.loadMeas().filter(m => m.id !== id));
    renderMeas(); aplicarClima(); render();
  });

  // --- carga en casa ---
  $('casa-si').addEventListener('click', () => elegirVsCasa(true));
  $('casa-no').addEventListener('click', () => elegirVsCasa(false));
  $('casa-save').addEventListener('click', saveCasa);
  $('casa-borrar').addEventListener('click', borrarCasa);

  // --- descuentos (Ajustes) ---
  $('dto-save').addEventListener('click', saveDescuento);
  $('dto-cancel').addEventListener('click', () => { limpiarFormDescuento(); renderDescuentos(); });
  $('dto-list').addEventListener('click', e => {
    const ed = e.target.closest('[data-dto-editar]');
    if(ed) return editarDescuento(parseInt(ed.getAttribute('data-dto-editar'), 10));
    const b = e.target.closest('[data-dto-borrar]'); if(!b) return;
    if(!confirm('¿Borrar este descuento?')) return;
    borrarDescuento(parseInt(b.getAttribute('data-dto-borrar'), 10));
  });

  // --- consumo en híbrido ---
  $('btn-measure-fuel').addEventListener('click', () => {
    $('fuel-err').classList.remove('show'); renderFuel(); openOverlay('fuel-overlay', true);
  });
  $('fuel-close').addEventListener('click', () => openOverlay('fuel-overlay', false));
  $('fuel-save').addEventListener('click', saveFuel);
  $('fuel-unidad').addEventListener('click', cambiarUnidadGasolina);
  $('fuel-list').addEventListener('click', e => {
    const b = e.target.closest('[data-fid]'); if(!b) return;
    if(!confirm('¿Borrar esta medida?')) return;
    borrarConsumo(b.getAttribute('data-fid'));
  });

  // tocar fuera de una ficha la cierra (salvo la del vehículo: la primera vez es obligatoria)
  ['meas-overlay', 'fuel-overlay', 'ch-overlay', 'chs-overlay'].forEach(id => {
    $(id).addEventListener('click', e => { if(e.target === $(id)) openOverlay(id, false); });
  });
}

// ======================= ARRANQUE =======================

/** Arranca la app. `version` (la VERSION de app.js) se enseña al final de Ayuda. */
export function iniciar(version){
  D.migrate();
  $('app-version').textContent = version
    ? 'Versión ' + version + '. Si nos cuentas un fallo, dinos esta versión.'
    : '';

  SESSION_KEYS.forEach(k => { els[k] = $('inp-' + k); });

  mode = D.getMode();
  parkUnit = D.getParkUnit();
  clima = D.getClima();
  selectedChargerId = D.getSelectedChargerId();

  bindEvents();
  irA('tab-calcular');
  $('lugar-q').value = D.getLugar();
  syncParkUnitUI();
  D.loadSessionInto(els, SESSION_KEYS);
  setMode(mode);

  // el veredicto se compacta al bajar; con margen entre umbrales para que no parpadee
  if(window.addEventListener){
    window.addEventListener('scroll', () => {
      const y = window.scrollY || 0, v = $('verdict');
      if(y > 140) v.classList.add('compact'); else if(y < 60) v.classList.remove('compact');
    }, { passive: true });
  }

  if(!D.loadProfiles().list.length) openVehicle(null);
  else refreshAll();
}

// para las pruebas
export const _test = {
  render, renderMeas, saveMeas, saveCharger, openCharger, els,
  renderCargadoresResultados, seleccionarOcmResultado, buscarCargadoresCercanos,
  buscarPorLugar, usarLugar, elegirClima, clasificarMedida, irA, usarCargador, cambiarListaOcm,
  saveFuel, borrarConsumo, saveDescuento, editarDescuento, borrarDescuento,
  saveCasa, borrarCasa, elegirVsCasa
};
