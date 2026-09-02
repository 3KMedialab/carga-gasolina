// util.js — utilidades sin lógica de negocio

export const EURO = '\u20AC';

// --- DOM ---
let _el = {};
export function $(id){ return _el[id] || (_el[id] = document.getElementById(id)); }
/** Vacía la caché de elementos. Solo lo necesitan las pruebas. */
export function resetDom(){ _el = {}; }
export function show(el, on){ el.classList.toggle('hidden', !on); }
export function openOverlay(id, on){ $(id).classList.toggle('open', !!on); }
export function num(el){ const v = parseFloat(el.value); return isFinite(v) ? v : 0; }

// --- almacenamiento local (nunca lanza excepción) ---
export function ls(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
export function lsSet(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
export function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){} }
export function lsJSON(k, fallback){
  try{
    const v = JSON.parse(localStorage.getItem(k) || 'null');
    return v === null ? fallback : v;
  }catch(e){ return fallback; }
}
export function lsPut(k, v){ lsSet(k, JSON.stringify(v)); }

// --- colecciones ---
export function byId(list, id){
  for(let i = 0; i < list.length; i++){ if(list[i].id === id) return list[i]; }
  return null;
}

// --- números y texto ---
export function clamp(v, a, b){ return Math.min(b, Math.max(a, v)); }

export function fmt(n, d){
  d = (d === undefined) ? 2 : d;
  if(!isFinite(n)) return '\u2014';
  return n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function esc(s){
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
}

export function norm(s){
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function fmtTime(h){
  if(!isFinite(h) || h <= 0) return '\u2014';
  const m = Math.round(h * 60), hh = Math.floor(m / 60), mm = m % 60;
  if(hh === 0) return mm + ' min';
  if(mm === 0) return hh + ' h';
  return hh + ' h ' + mm + ' min';
}

// distancia entre dos coordenadas, en km
export function haversine(la1, lo1, la2, lo2){
  const R = 6371;
  const dLa = (la2 - la1) * Math.PI / 180;
  const dLo = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dLa/2) * Math.sin(dLa/2) +
            Math.cos(la1 * Math.PI/180) * Math.cos(la2 * Math.PI/180) *
            Math.sin(dLo/2) * Math.sin(dLo/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- colores del tema (se releen al cambiar claro/oscuro) ---
export const color = { good: '#0E7C5A', bad: '#C2410C', warn: '#B45309' };

function cssVar(n){
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
}

export function refreshColors(){
  color.good = cssVar('--good') || color.good;
  color.bad  = cssVar('--bad')  || color.bad;
  color.warn = cssVar('--warn') || color.warn;
}

export function onSchemeChange(fn){
  if(!window.matchMedia) return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => { refreshColors(); fn(); };
  if(mq.addEventListener) mq.addEventListener('change', handler);
  else if(mq.addListener) mq.addListener(handler);
}
