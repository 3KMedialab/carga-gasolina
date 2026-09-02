// interfaz.js — une el DOM con el cálculo y el almacenamiento.
// Exporta iniciar() para que las pruebas puedan importar sin arrancar la app.

import {
  $, show, openOverlay, num, byId, clamp, fmt, esc, fmtTime,
  color, refreshColors, onSchemeChange, EURO
} from './util.js';

import {
  PRESET_FACTORS, simulate, findLimitHours, measStats, buildMeasurement
} from './calculo.js';

import * as D from './datos.js';
import { buscarCercanas, MENSAJES } from './gasolineras.js';

const SESSION_KEYS = [
  'chargerPrice','fuelPrice','chargerPower','currentSoc','parkHours',
  'sessionKwh','detourKm','elecConsumption','fuelConsumption','sessionFee',
  'pricingMode','pricePerMin'
];

// --- estado de la vista ---
const els = {};
let mode = 'parked';
let coldOn = false;
let activePreset = 'mixto';
let selectedChargerId = null;
let editingChargerId = null;
let editingVehicleId = null;
let lastCalc = null;
let lastStations = [];

const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

// ======================= CÁLCULO PRINCIPAL =======================

/** Consumo eléctrico base: el medido si hay datos reales, el declarado si no. */
function baseElecCons(prof){
  const s = measStats(D.loadMeas());
  return s.R > 0 ? prof.chargeEff / s.R : prof.elecCons;
}

function render(){
  const prof = D.activeProfile();
  if(!prof) return;

  const ch = selectedCharger();
  const cfg = {
    mode,
    chargerPower: num(els.chargerPower), maxPower: prof.maxPower,
    chargeEff: prof.chargeEff, chem: prof.chem || 'unknown',
    battery: prof.battery, currentSoc: num(els.currentSoc),
    parkHours: num(els.parkHours), sessionKwh: num(els.sessionKwh),
    detourKm: num(els.detourKm),
    chargerPrice: num(els.chargerPrice), byMinute: num(els.pricingMode) === 1,
    pricePerMin: num(els.pricePerMin), sessionFee: num(els.sessionFee),
    fuelPrice: num(els.fuelPrice), fuelCons: num(els.fuelConsumption),
    elecCons: num(els.elecConsumption),
    freeHours: ch && ch.overMin > 0 ? ch.freeHours : 0,
    overMin:   ch && ch.overMin > 0 ? ch.overMin   : 0
  };
  const r = simulate(cfg);

  // gratis y sin ataduras: no hay nada que decidir
  const precio = cfg.byMinute ? cfg.pricePerMin : cfg.chargerPrice;
  const isFree = precio <= 0 && cfg.sessionFee <= 0 && cfg.overMin <= 0 && cfg.detourKm <= 0;

  const worth = !r.nothingToCharge && r.net > 0;
  const tight = !r.nothingToCharge && !isFree && r.net >= 0 && Math.abs(r.net) < 0.10;
  const accent = (r.nothingToCharge || tight) ? color.warn : (worth ? color.good : color.bad);

  const badge = $('badge');
  badge.textContent = r.nothingToCharge ? 'Batería llena'
    : isFree ? 'Gratis'
    : tight ? 'Casi igual'
    : worth ? 'Compensa cargar' : 'Mejor repostar';
  badge.style.color = accent;

  const amountEl = $('amount');
  amountEl.innerHTML = (r.net >= 0 ? '+' : '\u2212') + fmt(Math.abs(r.net)) +
    '<span class="unit"> ' + EURO + '</span>';
  amountEl.style.color = r.nothingToCharge ? color.warn : (r.net >= 0 ? color.good : color.bad);

  $('amount-label').textContent = (r.nothingToCharge
    ? 'no cabe energía en la batería'
    : isFree ? 'que te habrías gastado en gasolina'
    : r.net >= 0 ? 'de ahorro en esta recarga' : 'de sobrecoste en esta recarga')
    + (coldOn ? ' \u00b7 calculado con frío' : '');

  $('verdict').style.borderLeftColor = accent;

  const detail = $('detail');
  if(r.nothingToCharge){
    detail.innerHTML = 'Tu batería ya está al ' + fmt(cfg.currentSoc, 0) + '%.' +
      (cfg.sessionFee > 0
        ? ' Enchufar aquí solo te costaría la tarifa fija de ' + fmt(cfg.sessionFee) + ' ' + EURO + '.'
        : '');
  } else if(isFree){
    detail.innerHTML = '<strong class="num">' + fmt(r.km, 0) + ' km</strong> sin coste.';
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
    '% \u2192 <strong style="color:' + color.good + '">' + fmt(r.finalSoc, 0) + '%</strong>';
  $(pre + '-kwh').textContent = fmt(r.sessionKwh, 1) + ' kWh en ' + fmtTime(r.chargeHours);
  $(pre + '-km').textContent = '\u2248 ' + fmt(r.km, 0) + ' km';
  $(pre + '-cost').textContent = fmt(r.sessionCost) + ' ' + EURO;
  $(pre + '-equiv').textContent = fmt(r.equivFuel) + ' ' + EURO;

  const overRow = $(pre + '-row-over');
  if(r.overCost > 0){
    overRow.style.display = '';
    const oe = $(pre + '-over');
    oe.textContent = '+' + fmt(r.overCost) + ' ' + EURO + ' (' + fmtTime(r.overHours) + ' de más)';
    oe.style.color = color.bad;
  } else { overRow.style.display = 'none'; }

  if(mode === 'parked'){
    const note = $('pk-note');
    const limit = ch && ch.overMin > 0 ? findLimitHours(cfg) : null;
    if(r.nothingToCharge){
      note.innerHTML = `<span style="color:${color.warn}">No tiene sentido enchufar</span>: tu batería ya está llena.`;
    } else if(isFree){
      note.innerHTML = 'Enchufa el tiempo que quieras: no hay nada que decidir.';
    } else if(limit !== null && cfg.parkHours >= limit){
      note.innerHTML = `<span style="color:${color.bad}">Llevas demasiado tiempo.</span> A partir de ` +
        fmtTime(limit) + ' el recargo se come el ahorro. Desconecta antes.';
    } else if(limit !== null){
      note.innerHTML = `<span style="color:${color.warn}">Desconecta antes de ${fmtTime(limit)}</span>` +
        ' o el recargo empezará a costarte dinero.';
    } else if(r.capped){
      note.innerHTML = 'La batería se llena en ' + fmtTime(r.chargeHours) +
        ', antes de que te vayas. El tiempo de más no suma nada.';
    } else if(worth){
      note.innerHTML = 'Ahorro limpio: no te cuesta ni tiempo ni desvío, porque ibas a estar aquí igualmente.';
    } else {
      note.innerHTML = `<span style="color:${color.bad}">Sale más caro que la gasolina</span>, aunque no te cueste tiempo.`;
    }
  } else {
    const rowD = $('tr-row-detour');
    if(cfg.detourKm > 0){
      rowD.style.display = '';
      const dEl = $('tr-detour');
      dEl.textContent = '\u2212' + fmt(r.detourCost) + ' ' + EURO;
      dEl.style.color = color.bad;
    } else rowD.style.display = 'none';

    const note = $('tr-note');
    const perHour = r.chargeHours > 0 ? r.net / r.chargeHours : 0;
    if(r.nothingToCharge){
      note.innerHTML = `<span style="color:${color.warn}">No tiene sentido desviarte</span>: tu batería ya está llena.`;
    } else if(r.capped){
      note.innerHTML = 'Pediste ' + fmt(cfg.sessionKwh, 0) + ' kWh pero solo caben ' +
        fmt(r.sessionKwh, 1) + ' antes del 100%. El cálculo usa esa cifra.';
    } else if(cfg.detourKm > 0 && r.gross > 0 && r.net < 0){
      note.innerHTML = `<span style="color:${color.bad}">El desvío se come el ahorro.</span> ` +
        'Sin el rodeo habrías ahorrado ' + fmt(r.gross) + ' ' + EURO + '.';
    } else if(worth){
      note.innerHTML = 'Son ' + fmtTime(r.chargeHours) + ' de espera para ahorrar ' + fmt(r.net) +
        ' ' + EURO + ' \u2014 unos ' + fmt(perHour) + ' ' + EURO + ' por hora.';
    } else {
      note.innerHTML = `<span style="color:${color.bad}">No merece la pena esta parada</span> a este precio.`;
    }
  }

  const ph = $('power-hint');
  if(r.powerCapped){
    ph.textContent = prof.name + ' tope a ' + fmt(prof.maxPower, 1) + ' kW: se usa ese límite';
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

  $('cons-hint').textContent = 'Mixto de ' + prof.name + ': ' + fmt(prof.elecCons, 1) +
    ' kWh/100km y ' + fmt(prof.fuelCons, 1) + ' L/100km. Los botones escalan sobre esos valores.';

  const noteEl = $('charger-note');
  noteEl.textContent = ch && ch.note ? ch.note : '';
  show(noteEl, !!(ch && ch.note));

  lastCalc = {
    chargerPrice: cfg.byMinute ? r.effectivePerKwh : cfg.chargerPrice,
    savings: r.net, km: r.km, free: r.sessionCost <= 0
  };
  renderChargers();
  D.saveSessionFrom(els, SESSION_KEYS, num);
}

// ======================= CONDICIONES =======================

function applyConditions(){
  const p = D.activeProfile();
  if(!p) return;
  const f = PRESET_FACTORS[activePreset] || PRESET_FACTORS.mixto;
  let e = baseElecCons(p) * f.elec, g = p.fuelCons * f.fuel;
  if(coldOn){ e *= f.coldElec; g *= f.coldFuel; }
  els.elecConsumption.value = Math.round(e * 10) / 10;
  els.fuelConsumption.value = Math.round(g * 10) / 10;
  D.setCold(coldOn);
  D.setPreset(activePreset);
  syncConditionUI();
}

function syncConditionUI(){
  document.querySelectorAll('#preset-row .preset-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-preset') === activePreset);
  });
  $('btn-cold').classList.toggle('active', coldOn);
  $('cold-mark').innerHTML = coldOn ? '&#9679;' : '&#9675;';
}

// ======================= VEHÍCULOS =======================

function renderVehicles(){
  const d = D.loadProfiles(), act = D.activeProfile();
  let html = d.list.map(p =>
    `<button class="veh${act && p.id === act.id ? ' active' : ''}" data-veh="${p.id}">${esc(p.name)}</button>`
  ).join('');
  if(d.list.length > 1) html += '<button class="veh veh-add" id="veh-add">+ Vehículo</button>';
  $('veh-row').innerHTML = html;
  show($('veh-row'), d.list.length > 1);

  const sum = $('veh-summary');
  if(act){
    const chem = act.chem === 'lfp' ? 'LFP' : act.chem === 'nmc' ? 'NMC' : 'química sin indicar';
    sum.innerHTML = `<p><strong>${esc(act.name)}</strong><br>` +
      `Batería ${fmt(act.battery,1)} kWh (${chem}) \u00b7 carga máx. ${fmt(act.maxPower,1)} kW \u00b7 ` +
      `eficiencia ${fmt(act.chargeEff,0)}%<br>` +
      `Consumo mixto ${fmt(act.elecCons,1)} kWh/100km \u00b7 ${fmt(act.fuelCons,1)} L/100km</p>`;
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
  applyConditions();
  refreshAll();
}

// ======================= CARGADORES =======================

const selectedCharger = () => selectedChargerId ? byId(D.loadChargers(), selectedChargerId) : null;

function setSelectedCharger(id){
  selectedChargerId = id;
  D.setSelectedChargerId(id);
}

function renderChargers(){
  const list = D.loadChargers();
  let html = '<div class="saved-row">' + list.map(c => {
    const on = c.id === selectedChargerId;
    const shown = c.mode === 1 ? fmt(c.perMin || 0, 2) + '/min' : fmt(c.price, 2);
    const warn = c.overMin > 0
      ? '<span class="chip-clock" title="Tiene recargo por tiempo">\u23f1\ufe0f</span> ' : '';
    return `<span class="chip${on ? ' active' : ''}" data-id="${c.id}">${warn}${esc(c.name)}` +
      ` <span class="price">${shown}</span></span>`;
  }).join('') + '<button class="chip chip-add" id="chip-add">+ Guardar este</button></div>';
  if(!list.length) html += '<div class="saved-hint">Guarda aquí los puntos donde cargas.</div>';
  $('saved-chargers').innerHTML = html;
}

function openCharger(id){
  editingChargerId = id || null;
  const c = id ? byId(D.loadChargers(), id) : null;
  $('ch-title').textContent = c ? 'Editar cargador' : 'Guardar cargador';
  $('ch-name').value      = c ? c.name : '';
  $('ch-power').value     = c ? c.power : num(els.chargerPower);
  $('ch-mode').value      = c ? (c.mode || 0) : num(els.pricingMode);
  $('ch-price').value     = c ? c.price : num(els.chargerPrice);
  $('ch-permin').value    = c ? (c.perMin || '') : num(els.pricePerMin);
  $('ch-freehours').value = c && c.overMin > 0 ? c.freeHours : '';
  $('ch-overmin').value   = c && c.overMin > 0 ? c.overMin : '';
  $('ch-note').value      = c ? (c.note || '') : '';
  $('ch-err').classList.remove('show');
  $('ch-delete').style.display = c ? '' : 'none';
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
  render();
}

function applyCharger(c){
  els.chargerPower.value = c.power;
  els.pricingMode.value = c.mode || 0;
  if(c.mode === 1) els.pricePerMin.value = c.perMin;
  else els.chargerPrice.value = c.price;
}

// ======================= HISTORIAL Y CALIBRACIÓN =======================

function renderHistory(){
  const p = D.activeProfile(), list = D.loadHistory();
  $('hist-count').textContent = list.length;

  let total = 0, gratis = 0, pagado = 0;
  list.forEach(e => { total += e.savings; if(e.free) gratis += e.savings; else pagado += e.savings; });

  const t = $('hist-total');
  t.textContent = (total >= 0 ? '+' : '\u2212') + fmt(Math.abs(total)) + ' ' + EURO;
  t.style.color = total >= 0 ? color.good : color.bad;

  let nota = '';
  if(list.length && gratis > 0 && pagado !== 0){
    nota = fmt(gratis / total * 100, 0) + '% viene de cargar gratis (' + fmt(gratis) + ' ' + EURO +
           ') y el resto de decisiones de pago (' + fmt(pagado) + ' ' + EURO + ').';
  } else if(list.length && gratis > 0){
    nota = 'Todo el ahorro viene de cargar gratis.';
  } else if(p){ nota = 'Historial de ' + p.name + '.'; }
  $('hist-note').textContent = nota;
}

function renderCalibration(){
  const p = D.activeProfile();
  const dot = $('calib-dot'), main = $('calib-main'), sub = $('calib-sub'), btn = $('btn-mark-full');
  const chem = p ? (p.chem || 'unknown') : 'unknown';
  const muted = cssVar('--muted') || '#5A676D';

  $('calib-card').classList.remove('hidden');

  if(chem === 'nmc'){
    btn.classList.add('hidden');
    dot.style.background = muted; main.style.color = '';
    main.textContent = 'No cargues al 100% por costumbre';
    sub.textContent = 'Tu batería es NMC: mantenerla cerca del 100% acelera su desgaste. ' +
      'Para el día a día basta con quedarte entre el 20% y el 80%, y llegar al 100% solo antes de un viaje largo.';
    return;
  }
  if(chem === 'unknown'){
    btn.classList.add('hidden');
    dot.style.background = muted; main.style.color = '';
    main.textContent = 'Indica el tipo de batería';
    sub.textContent = 'El consejo de carga cambia según sea LFP o NMC. Ponlo en los datos de tu vehículo ' +
      'y aquí verás el que te corresponde.';
    return;
  }

  btn.classList.remove('hidden');
  const raw = D.loadCalib();
  if(!raw){
    dot.style.background = color.warn; main.style.color = color.warn;
    main.textContent = 'Sin registro todavía';
    sub.textContent = 'Tu batería es LFP: conviene llegar al 100% una vez por semana para que el coche ' +
      'no pierda precisión al medir la carga.';
    return;
  }
  const last = new Date(raw), days = Math.floor((Date.now() - last) / 86400000);
  const ds = last.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  if(days <= 7){
    dot.style.background = color.good; main.style.color = color.good;
    main.textContent = days === 0 ? 'Calibrada hoy' : 'Calibrada hace ' + days + (days === 1 ? ' día' : ' días');
    sub.textContent = 'Última carga completa: ' + ds + '. Todo en orden.';
  } else if(days <= 14){
    dot.style.background = color.warn; main.style.color = color.warn;
    main.textContent = 'Toca cargar al 100%';
    sub.textContent = 'Han pasado ' + days + ' días desde la última (' + ds + ').';
  } else {
    dot.style.background = color.bad; main.style.color = color.bad;
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
           savings: lastCalc.savings, km: lastCalc.km, free: !!lastCalc.free });
  D.storeHistory(l);
  renderHistory();
  flash(btn, '\u2713 Guardada');
}

// ======================= MEDICIONES =======================

function renderMeas(){
  const list = D.loadMeas(), s = measStats(list), prof = D.activeProfile();
  const chem = prof ? (prof.chem || 'unknown') : 'unknown';

  $('meas-level').innerHTML = chem === 'lfp'
    ? 'Con tu batería LFP, el <strong>100%</strong>: el coche se para solo ahí y además le conviene.'
    : chem === 'nmc'
      ? 'Con tu batería NMC no conviene llegar al 100%. Usa tu límite habitual, normalmente el <strong>80%</strong>, y repite siempre el mismo.'
      : 'Usa siempre el mismo nivel. Si tu batería es LFP, el 100%; si es NMC, tu límite habitual (suele ser el 80%).';

  const sum = $('meas-summary');
  if(!s.n){
    sum.innerHTML = '<p>Todavía no has medido nada. Mientras tanto la app usa estimaciones, ' +
      'con un margen de error de alrededor del 30%.</p>';
  } else {
    const base = prof ? prof.chargeEff / s.R : 0;
    sum.innerHTML = `<p><strong>${s.n}${s.n === 1 ? ' medida' : ' medidas'}</strong><br>` +
      `Rindes <strong>${fmt(s.R, 2)} km por cada kWh</strong> que te facturan.<br>` +
      `Equivale a un consumo de ${fmt(base, 1)} kWh/100km.<br>` +
      `Margen de error actual: \u00b1${fmt(s.band * 100, 0)}%` +
      (s.n < 3 ? ' \u2014 con 2 o 3 medidas más bajará bastante.' : '') + '</p>';
  }

  $('meas-list').innerHTML = list.slice().reverse().map(m => {
    const d = new Date(m.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    return `<div class="meas-item"><span>${d} \u00b7 ${fmt(m.km, 0)} km / ${fmt(m.kwh, 1)} kWh</span>` +
      `<span><strong>${fmt(m.R, 2)}</strong> km/kWh` +
      `<button class="meas-del" data-mid="${m.id}" aria-label="Borrar">&times;</button></span></div>`;
  }).join('');
}

function saveMeas(){
  const err = $('meas-err');
  const prof = D.activeProfile();
  if(!prof) return;

  const res = buildMeasurement({
    km1: parseFloat($('meas-km1').value),
    km2: parseFloat($('meas-km2').value),
    kwh: parseFloat($('meas-kwh').value),
    litres: parseFloat($('meas-lit').value),
    fuelCons: prof.fuelCons
  });

  if(!res.ok){ err.textContent = res.error; err.classList.add('show'); return; }

  const l = D.loadMeas();
  l.push({ id: 'm' + Date.now(), date: new Date().toISOString(),
           km: res.km, kmElec: res.kmElec, kwh: res.kwh, litres: res.litres,
           cond: activePreset || 'mixto', R: res.R });
  D.storeMeas(l);

  ['meas-km1', 'meas-km2', 'meas-kwh'].forEach(id => { $(id).value = ''; });
  $('meas-lit').value = '0';
  err.classList.remove('show');
  renderMeas();
  applyConditions();
  render();
}

// ======================= GASOLINERAS =======================

async function fetchRealPrices(){
  const btn = $('btn-refresh'), label = $('refresh-btn-label');
  const hint = $('fuel-hint'), note = $('refresh-note'), listEl = $('station-list');

  const reset = () => { btn.disabled = false; label.textContent = 'Buscar gasolineras cercanas'; };
  const fail = msg => {
    reset();
    note.innerHTML = `<span style="color:${color.warn}">${msg}</span> Puedes escribir el precio a mano, o ` +
      `<a href="https://geoportalgasolineras.es/geoportal-instalaciones/Inicio" target="_blank" ` +
      `rel="noopener" style="color:${color.good}">verlo en el Geoportal</a>.`;
  };

  btn.disabled = true;
  label.textContent = 'Buscando...';

  try{
    const { top, cheapest, avg, count, fecha } = await buscarCercanas();
    els.fuelPrice.value = avg.toFixed(3);
    hint.textContent = 'Media de ' + count + ' gasolineras cercanas';
    hint.classList.add('live');
    note.textContent = 'Datos oficiales del Ministerio' + (fecha ? ' \u2014 ' + fecha : '') + '.';

    lastStations = top;
    listEl.style.display = 'block';
    listEl.innerHTML = top.map((s, idx) => {
      const tag = s === cheapest ? '<span class="tag">MÁS BARATA</span>' : '';
      return `<div class="station" data-idx="${idx}"><div><div class="n">${esc(s.name)}${tag}</div>` +
        `<div class="d">${esc(s.addr)} \u00b7 ${fmt(s.dist, 1)} km</div></div>` +
        `<div class="p num">${fmt(s.price, 3)}</div></div>`;
    }).join('') + '<div class="field-hint" style="margin-top:4px;">Toca una para usar su precio.</div>';

    render();
    reset();
  }catch(e){
    fail(MENSAJES[e && e.message] || MENSAJES.default);
  }
}

// ======================= MODO =======================

function setMode(m){
  mode = m;
  D.setMode(m);
  $('mode-parked').classList.toggle('active', m === 'parked');
  $('mode-trip').classList.toggle('active', m === 'trip');
  $('block-parked').classList.toggle('hidden', m !== 'parked');
  $('block-trip').classList.toggle('hidden', m !== 'trip');
  render();
}

function refreshAll(){
  renderVehicles();
  applyConditions();
  renderCalibration();
  renderHistory();
  render();
}

// ======================= EVENTOS =======================

function bindEvents(){
  SESSION_KEYS.forEach(k => els[k].addEventListener('input', render));

  $('veh-row').addEventListener('click', e => {
    if(e.target.closest('#veh-add')) return openVehicle(null);
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

  $('mode-parked').addEventListener('click', () => setMode('parked'));
  $('mode-trip').addEventListener('click', () => setMode('trip'));
  $('btn-save-parked').addEventListener('click', function(){ saveRecharge(this); });
  $('btn-save-trip').addEventListener('click', function(){ saveRecharge(this); });

  $('btn-mark-full').addEventListener('click', function(){
    if(!D.activeProfile()) return;
    D.storeCalib(new Date().toISOString());
    renderCalibration();
    flash(this, '\u2713 Registrado');
  });
  $('btn-clear-history').addEventListener('click', () => {
    const p = D.activeProfile(); if(!p) return;
    if(!confirm('¿Borrar el historial de ' + p.name + '?')) return;
    D.storeHistory([]); renderHistory();
  });

  $('preset-row').addEventListener('click', e => {
    const b = e.target.closest('.preset-btn'); if(!b) return;
    activePreset = b.getAttribute('data-preset');
    applyConditions(); render();
  });
  $('btn-cold').addEventListener('click', () => {
    coldOn = !coldOn; applyConditions(); render();
  });
  ['elecConsumption', 'fuelConsumption'].forEach(k => {
    els[k].addEventListener('input', () => {
      activePreset = null; coldOn = false;
      D.setCold(false); syncConditionUI();
    });
  });

  const tg = $('settings-toggle'), pn = $('settings-panel');
  tg.addEventListener('click', () => { pn.classList.toggle('open'); tg.classList.toggle('open'); });

  $('btn-refresh').addEventListener('click', fetchRealPrices);

  $('saved-chargers').addEventListener('click', e => {
    if(e.target.closest('#chip-add')) return openCharger(null);
    const chip = e.target.closest('.chip');
    if(!chip || !chip.hasAttribute('data-id')) return;
    const id = chip.getAttribute('data-id');
    if(id === selectedChargerId) return openCharger(id);
    const c = byId(D.loadChargers(), id);
    if(c){ setSelectedCharger(id); applyCharger(c); }
    renderChargers(); render();
  });
  $('ch-save').addEventListener('click', saveCharger);
  $('ch-cancel').addEventListener('click', () => openOverlay('ch-overlay', false));
  $('ch-delete').addEventListener('click', deleteCharger);
  $('ch-mode').addEventListener('change', syncChargerMode);

  $('btn-help').addEventListener('click', () => openOverlay('help-overlay', true));
  $('help-close').addEventListener('click', () => openOverlay('help-overlay', false));

  $('btn-measure').addEventListener('click', () => {
    $('meas-err').classList.remove('show'); renderMeas(); openOverlay('meas-overlay', true);
  });
  $('meas-close').addEventListener('click', () => openOverlay('meas-overlay', false));
  $('meas-save').addEventListener('click', saveMeas);
  $('meas-list').addEventListener('click', e => {
    const b = e.target.closest('[data-mid]'); if(!b) return;
    if(!confirm('¿Borrar esta medida?')) return;
    const id = b.getAttribute('data-mid');
    D.storeMeas(D.loadMeas().filter(m => m.id !== id));
    renderMeas(); applyConditions(); render();
  });

  const switchPricing = () => {
    els.pricingMode.value = num(els.pricingMode) === 1 ? 0 : 1;
    if(selectedChargerId){ setSelectedCharger(null); renderChargers(); }
    render();
  };
  $('btn-switch-pricing').addEventListener('click', switchPricing);
  $('btn-switch-pricing2').addEventListener('click', switchPricing);

  // tocar los datos del punto a mano deselecciona el cargador guardado
  ['chargerPrice', 'chargerPower', 'pricePerMin', 'pricingMode'].forEach(k => {
    els[k].addEventListener('input', () => {
      if(selectedChargerId){ setSelectedCharger(null); renderChargers(); }
    });
  });

  $('station-list').addEventListener('click', e => {
    const row = e.target.closest('.station'); if(!row) return;
    const st = lastStations[parseInt(row.getAttribute('data-idx'), 10)];
    if(!st) return;
    els.fuelPrice.value = st.price.toFixed(3);
    const hint = $('fuel-hint');
    hint.textContent = st.name + ' \u00b7 ' + fmt(st.dist, 1) + ' km';
    hint.classList.add('live');
    document.querySelectorAll('.station').forEach(el => { el.style.borderColor = ''; });
    row.style.borderColor = color.good;
    render();
  });
}

// ======================= ARRANQUE =======================

export function iniciar(){
  D.migrate();

  SESSION_KEYS.forEach(k => { els[k] = $('inp-' + k); });

  mode = D.getMode();
  coldOn = D.getCold();
  activePreset = D.getPreset();
  selectedChargerId = D.getSelectedChargerId();

  refreshColors();
  onSchemeChange(() => { if(D.activeProfile()) render(); });

  bindEvents();
  D.loadSessionInto(els, SESSION_KEYS);
  setMode(mode);

  if(!D.loadProfiles().list.length) openVehicle(null);
  else refreshAll();
}

// para las pruebas
export const _test = { render, renderMeas, saveMeas, saveCharger, openCharger, els };
