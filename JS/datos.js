// datos.js — todo el acceso a almacenamiento local, en un solo sitio.
// Incluye el versionado del esquema: cuando cambia la forma de los datos
// guardados, la migración va aquí y se ejecuta una vez al arrancar.

import { ls, lsSet, lsDel, lsJSON, lsPut, byId } from './util.js';

const K = {
  schema:   'cvg_schema',
  profiles: 'cvg_profiles_v1',
  session:  'cvg_session_v1',
  chargers: 'cvg_chargers_v1',
  mode:     'cvg_mode_v1',
  cold:     'cvg_cold_v1',
  preset:   'cvg_preset_v1',
  selCh:    'cvg_selch_v1',
  hist:     id => 'cvg_hist_'  + id,
  calib:    id => 'cvg_calib_' + id,
  meas:     id => 'cvg_meas_'  + id
};

// ---------- ESQUEMA ----------
const SCHEMA = 2;

const MIGRATIONS = {
  // v1 -> v2: los cargadores guardados antes de la ficha no tenían id,
  // y sin id no se pueden seleccionar ni editar.
  2(){
    const l = lsJSON(K.chargers, []);
    let changed = false;
    l.forEach((c, i) => { if(!c.id){ c.id = 'c' + Date.now() + i; changed = true; } });
    if(changed) lsPut(K.chargers, l);
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
  lsDel(K.hist(id)); lsDel(K.calib(id)); lsDel(K.meas(id));
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

// ---------- MODO Y CONDICIONES ----------
export const getMode    = () => ls(K.mode) || 'parked';
export const setMode    = m => lsSet(K.mode, m);
export const getCold    = () => ls(K.cold) === '1';
export const setCold    = on => lsSet(K.cold, on ? '1' : '0');
export const getPreset  = () => ls(K.preset) || 'mixto';
export const setPreset  = p => lsSet(K.preset, p || '');

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
