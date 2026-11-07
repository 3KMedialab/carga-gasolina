// datos.js — todo el acceso a almacenamiento local, en un solo sitio.
// Incluye el versionado del esquema: cuando cambia la forma de los datos
// guardados, la migración va aquí y se ejecuta una vez al arrancar.

import { ls, lsSet, lsDel, lsJSON, lsPut, byId } from './util.js';
import { CLIMAS } from './calculo.js';   // solo la constante: calculo.js es puro

const K = {
  schema:   'cvg_schema',
  profiles: 'cvg_profiles_v1',
  session:  'cvg_session_v1',
  chargers: 'cvg_chargers_v1',
  mode:     'cvg_mode_v1',
  clima:    'cvg_clima_v1',
  cold:     'cvg_cold_v1',     // obsoleta desde el esquema 3: solo la lee la migración
  preset:   'cvg_preset_v1',   // obsoleta desde el esquema 3: solo la borra la migración
  parkUnit: 'cvg_parkunit_v1',
  selCh:    'cvg_selch_v1',
  ocmRef:   'cvg_ocmref_v1',
  lugar:    'cvg_lugar_v1',
  descuentos: 'cvg_descuentos_v1', // descuentos en la gasolina: del usuario, no del vehículo
  estacion:   'cvg_estacion_v1',   // gasolinera elegida {name, price}, para saber su marca
  hist:     id => 'cvg_hist_'  + id,
  calib:    id => 'cvg_calib_' + id,
  meas:     id => 'cvg_meas_'  + id,
  fuel:     id => 'cvg_fuel_'  + id   // medidas del consumo en híbrido (desde 2026-11-07)
};

// ---------- ESQUEMA ----------
const SCHEMA = 3;

const MIGRATIONS = {
  // v1 -> v2: los cargadores guardados antes de la ficha no tenían id,
  // y sin id no se pueden seleccionar ni editar.
  2(){
    const l = lsJSON(K.chargers, []);
    let changed = false;
    l.forEach((c, i) => { if(!c.id){ c.id = 'c' + Date.now() + i; changed = true; } });
    if(changed) lsPut(K.chargers, l);
  },
  // v2 -> v3: desaparecen los factores estimados de ciudad/carretera/frío.
  // Cada medida pasa a llevar la climatización y si hizo frío; las antiguas
  // no lo sabemos, así que quedan sin clasificar (null), nunca adivinadas.
  // `cond` (el modo de conducción que estaba marcado al medir) ya no se usa.
  // Quien tenía el frío activado lo tenía por la calefacción: se conserva así.
  3(){
    loadProfiles().list.forEach(p => {
      const l = lsJSON(K.meas(p.id), null);
      if(!Array.isArray(l)) return;
      l.forEach(m => {
        if(!('clima' in m)) m.clima = null;
        if(!('frio' in m)) m.frio = null;
        delete m.cond;
      });
      lsPut(K.meas(p.id), l);
    });
    if(ls(K.cold) === '1' && !ls(K.clima)) lsSet(K.clima, 'calefaccion');
    lsDel(K.cold);
    lsDel(K.preset);
  }
};

export function migrate(){
  let from = parseInt(ls(K.schema) || '1', 10);
  if(!isFinite(from) || from < 1) from = 1;
  for(let v = from + 1; v <= SCHEMA; v++){
    if(MIGRATIONS[v]) MIGRATIONS[v]();
  }
  lsSet(K.schema, String(SCHEMA));
}

// ---------- VEHÍCULOS ----------
export function loadProfiles(){
  const d = lsJSON(K.profiles, null);
  return (d && d.list && d.list.length) ? d : { list: [], activeId: null };
}
export function saveProfiles(d){ lsPut(K.profiles, d); }
export function activeProfile(){
  const d = loadProfiles();
  return d.list.length ? (byId(d.list, d.activeId) || d.list[0]) : null;
}
export function setActiveProfile(id){
  const d = loadProfiles();
  d.activeId = id;
  saveProfiles(d);
}
export function deleteProfile(id){
  const d = loadProfiles();
  if(d.list.length <= 1) return false;
  d.list = d.list.filter(x => x.id !== id);
  if(d.activeId === id) d.activeId = d.list[0].id;
  saveProfiles(d);
  lsDel(K.hist(id)); lsDel(K.calib(id)); lsDel(K.meas(id)); lsDel(K.fuel(id));
  return true;
}

// ---------- SESIÓN ----------
export function loadSessionInto(els, keys){
  const s = lsJSON(K.session, null);
  if(s) keys.forEach(k => { if(s[k] !== undefined) els[k].value = s[k]; });
}
export function saveSessionFrom(els, keys, num){
  const o = {};
  keys.forEach(k => { o[k] = num(els[k]); });
  lsPut(K.session, o);
}

// ---------- MODO Y CLIMATIZACIÓN ----------
export const getMode    = () => ls(K.mode) || 'parked';
export const setMode    = m => lsSet(K.mode, m);
export const getClima   = () => { const c = ls(K.clima); return CLIMAS.indexOf(c) === -1 ? 'nada' : c; };
export const setClima   = c => lsSet(K.clima, CLIMAS.indexOf(c) === -1 ? 'nada' : c);
export const getParkUnit = () => ls(K.parkUnit) || 'h';
export const setParkUnit = u => lsSet(K.parkUnit, u === 'min' ? 'min' : 'h');

// ---------- ÚLTIMO LUGAR BUSCADO (gasolineras por CP o municipio) ----------
// Se guarda el texto tal cual lo escribió el usuario, no el resultado.
export const getLugar = () => ls(K.lugar) || '';
export const setLugar = t => lsSet(K.lugar, String(t || '').trim());

// ---------- DESCUENTOS EN LA GASOLINA ----------
// Claves nuevas (desde 2026-11-07-7), sin cambiar nada de lo guardado: no hay migración.
export function loadDescuentos(){ return lsJSON(K.descuentos, []); }
export function saveDescuentos(l){ lsPut(K.descuentos, l); }
// La gasolinera tocada en la lista: su rótulo dice qué descuento le toca. Se
// guarda para que siga valiendo al volver a abrir la app; null al usar la media.
export const getEstacion = () => lsJSON(K.estacion, null);
export function setEstacion(st){
  if(st) lsPut(K.estacion, { name: st.name, price: st.price }); else lsDel(K.estacion);
}

// ---------- CARGADORES ----------
export function loadChargers(){ return lsJSON(K.chargers, []); }
export function saveChargers(l){ lsPut(K.chargers, l); }
export const getSelectedChargerId = () => ls(K.selCh) || null;
export function setSelectedChargerId(id){
  if(id) lsSet(K.selCh, id); else lsDel(K.selCh);
}
export function selectedCharger(){
  const id = getSelectedChargerId();
  return id ? byId(loadChargers(), id) : null;
}

// ---------- REFERENCIA DE OPEN CHARGE MAP (conectores, usos, estados, operadores) ----------
// Cambia muy poco de un mes a otro; se cachea entera (ver OCM_REF_DIAS en cargadores.js).
export function loadOcmRef(){ return lsJSON(K.ocmRef, null); }
export function storeOcmRef(ref){ lsPut(K.ocmRef, ref); }

// ---------- HISTORIAL, CALIBRACIÓN Y MEDICIONES (por vehículo) ----------
function withProfile(fn, fallback){
  const p = activeProfile();
  return p ? fn(p) : fallback;
}
export const loadHistory  = ()  => withProfile(p => lsJSON(K.hist(p.id), []), []);
export const storeHistory = l   => withProfile(p => lsPut(K.hist(p.id), l));
export const loadCalib    = ()  => withProfile(p => ls(K.calib(p.id)), null);
export const storeCalib   = iso => withProfile(p => lsSet(K.calib(p.id), iso));
export const loadMeas     = ()  => withProfile(p => lsJSON(K.meas(p.id), []), []);
export const storeMeas    = l   => withProfile(p => lsPut(K.meas(p.id), l));
// Clave nueva, sin cambiar la forma de nada de lo ya guardado: no necesita
// migración (empieza vacía). Las medidas de R siguen guardando su R original;
// el que se usa se recalcula con el consumo de ahora (medidasConConsumo).
export const loadFuel     = ()  => withProfile(p => lsJSON(K.fuel(p.id), []), []);
export const storeFuel    = l   => withProfile(p => lsPut(K.fuel(p.id), l));

// ---------- COPIA DE SEGURIDAD ----------
// Todo lo que guarda la app vive bajo claves 'cvg_', así que un volcado
// por prefijo lo captura entero sin tener que enumerar cada clave a mano
// (incluidas las de historial/calibración/medidas, que son por vehículo).
export function exportAll(){
  const out = {};
  for(let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i);
    if(k && k.indexOf('cvg_') === 0) out[k] = localStorage.getItem(k);
  }
  return out;
}
/** Restaura un volcado de exportAll(). Sustituye lo que hubiera en esas claves. */
export function importAll(obj){
  if(!obj || typeof obj !== 'object') return false;
  const claves = Object.keys(obj).filter(k => k.indexOf('cvg_') === 0);
  if(!claves.length) return false;
  claves.forEach(k => lsSet(k, obj[k]));
  return true;
}
