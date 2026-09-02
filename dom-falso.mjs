// dom-falso.mjs — DOM mínimo para poder ejecutar la app en Node.
// Lee los identificadores reales de index.html, así que si se borra un elemento
// del HTML las pruebas lo detectan en vez de inventárselo.

import { readFileSync } from 'node:fs';
import { resetDom } from './js/util.js';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const IDS = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));

// Valores por defecto que trae el HTML, para que el simulador arranque igual que el navegador
const VALORES = {};
for(const m of html.matchAll(/<(?:input|select)[^>]*>/g)){
  const id = (m[0].match(/id="([^"]+)"/) || [])[1];
  const v  = (m[0].match(/value="([^"]*)"/) || [])[1];
  if(id && v !== undefined) VALORES[id] = v;
}

class El {
  constructor(id){
    this.id = id;
    this.value = '';
    this._text = '';
    this._html = '';
    this.style = {};
    this.disabled = false;
    this._fns = {};
    this.classList = {
      _s: new Set(),
      add:    c => this.classList._s.add(c),
      remove: c => this.classList._s.delete(c),
      contains: c => this.classList._s.has(c),
      toggle: (c, f) => {
        const on = f === undefined ? !this.classList._s.has(c) : !!f;
        on ? this.classList._s.add(c) : this.classList._s.delete(c);
      }
    };
  }
  get textContent(){ return this._text; }
  set textContent(v){ this._text = String(v); this._html = String(v); }
  get innerHTML(){ return this._html; }
  set innerHTML(v){ this._html = String(v); this._text = String(v).replace(/<[^>]+>/g, ''); }
  addEventListener(tipo, fn){ (this._fns[tipo] ||= []).push(fn); }
  fire(tipo, ev = {}){ (this._fns[tipo] || []).forEach(f => f.call(this, ev)); }
  closest(){ return null; }
}

export function montar(store){
  const nodos = new Map();
  const noEncontrados = new Set();

  const get = id => {
    if(!nodos.has(id)){
      if(!IDS.has(id)) noEncontrados.add(id);   // el HTML no tiene ese elemento
      const el = new El(id);
      if(VALORES[id] !== undefined) el.value = VALORES[id];
      nodos.set(id, el);
    }
    return nodos.get(id);
  };

  const almacen = { ...store };

  globalThis.document = {
    getElementById: get,
    querySelectorAll: () => [],
    documentElement: { style: { setProperty(){} } }
  };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#0E7C5A' });
  globalThis.localStorage = {
    getItem: k => (k in almacen ? almacen[k] : null),
    setItem: (k, v) => { almacen[k] = String(v); },
    removeItem: k => { delete almacen[k]; }
  };
  globalThis.sessionStorage = globalThis.localStorage;
  globalThis.window = {
    matchMedia: () => ({ addEventListener(){}, addListener(){} }),
    open(){}, location: { pathname: '/', replace(){} }
  };
  globalThis.location = globalThis.window.location;
  Object.defineProperty(globalThis, 'navigator', {
    value: { geolocation: null }, configurable: true, writable: true
  });
  globalThis.fetch = () => Promise.reject(new Error('sin-red'));
  globalThis.alert = () => {};
  globalThis.confirm = () => true;

  resetDom();

  return {
    get, store: almacen,
    click: id => get(id).fire('click', { target: { closest: () => null } }),
    fire: (id, tipo) => get(id).fire(tipo, { target: { closest: () => null } }),
    desmontar(){
      if(noEncontrados.size){
        console.log('  AVISO: el JS busca elementos que no existen en index.html:',
          [...noEncontrados].join(', '));
      }
    }
  };
}

export const JSDOMLite = El;
