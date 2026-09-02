// gasolineras.js — consulta a la API oficial del Ministerio (solo España).
// Aislado de la interfaz: devuelve datos o lanza un error con un código.

import { norm, haversine } from './util.js';

const PROVINCES = {
  'alava':'01','araba':'01','albacete':'02','alicante':'03','alacant':'03','almeria':'04',
  'avila':'05','badajoz':'06','balears':'07','baleares':'07','barcelona':'08','burgos':'09',
  'caceres':'10','cadiz':'11','castellon':'12','castello':'12','ciudad real':'13','cordoba':'14',
  'coruna':'15','cuenca':'16','girona':'17','gerona':'17','granada':'18','guadalajara':'19',
  'gipuzkoa':'20','guipuzcoa':'20','huelva':'21','huesca':'22','jaen':'23','leon':'24',
  'lleida':'25','lerida':'25','rioja':'26','lugo':'27','madrid':'28','malaga':'29','murcia':'30',
  'navarra':'31','nafarroa':'31','ourense':'32','orense':'32','asturias':'33','palencia':'34',
  'palmas':'35','pontevedra':'36','salamanca':'37','tenerife':'38','cantabria':'39','segovia':'40',
  'sevilla':'41','soria':'42','tarragona':'43','teruel':'44','toledo':'45','valencia':'46',
  'valladolid':'47','bizkaia':'48','vizcaya':'48','zamora':'49','zaragoza':'50','ceuta':'51','melilla':'52'
};

const PRICE_KEYS = [
  'Precio Gasolina 95 E5', 'Precio Gasolina 95 E10', 'Precio Gasolina 95 E5 Premium',
  'Precio Gasolina 98 E5', 'Precio Gasolina 98 E10'
];

const RADII = [8, 20, 50, 999999];

function priceOf(s){
  for(const k of PRICE_KEYS){
    const p = parseFloat(String(s[k] || '').replace(',', '.'));
    if(isFinite(p) && p > 0) return p;
  }
  return null;
}

export function provinceCode(address){
  const cand = [address.province, address.county, address.state, address.region]
    .filter(Boolean).map(norm);
  for(const c of cand){
    for(const key in PROVINCES){ if(c.indexOf(key) !== -1) return PROVINCES[key]; }
  }
  return null;
}

/** Selecciona las más cercanas, ampliando el radio si hace falta. */
export function pickNearby(all, lat, lon){
  const withDist = all.map(s => ({ ...s, dist: haversine(lat, lon, s.lat, s.lon) }));
  let near = [];
  for(const r of RADII){
    near = withDist.filter(x => x.dist <= r);
    if(near.length) break;
  }
  if(!near.length) return null;

  near.sort((a, b) => a.dist - b.dist);
  const cheapest = near.reduce((b, x) => (!b || x.price < b.price) ? x : b, null);
  const top = near.slice(0, 5);
  if(cheapest && top.indexOf(cheapest) === -1) top.push(cheapest);
  top.sort((a, b) => a.dist - b.dist);

  const avg = near.reduce((s, x) => s + x.price, 0) / near.length;
  return { top, cheapest, avg, count: near.length };
}

function position(){
  return new Promise((resolve, reject) => {
    if(!navigator.geolocation) return reject(new Error('sin-geo'));
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error('sin-permiso')),
      { timeout: 8000 });
  });
}

/** Devuelve {top, cheapest, avg, count, fecha} o lanza Error con code en .message */
export async function buscarCercanas(){
  const pos = await position();
  const { latitude: lat, longitude: lon } = pos.coords;

  const geo = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=8`
  ).then(r => r.json());

  const code = provinceCode((geo && geo.address) || {});
  if(!code) throw new Error('sin-provincia');

  const data = await fetch(
    'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/' +
    'EstacionesTerrestres/FiltroProvincia/' + code
  ).then(r => r.json());

  const all = [];
  for(const s of (data && data.ListaEESSPrecio) || []){
    const price = priceOf(s);
    if(!price) continue;
    const slat = parseFloat(String(s['Latitud'] || '').replace(',', '.'));
    const slon = parseFloat(String(s['Longitud (WGS84)'] || '').replace(',', '.'));
    if(!isFinite(slat) || !isFinite(slon)) continue;
    all.push({
      price, lat: slat, lon: slon,
      name: s['Rótulo'] || s['Rotulo'] || 'Gasolinera',
      addr: s['Dirección'] || s['Direccion'] || ''
    });
  }
  if(!all.length) throw new Error('sin-gasolineras');

  const res = pickNearby(all, lat, lon);
  if(!res) throw new Error('sin-gasolineras');
  return { ...res, fecha: data.Fecha || '' };
}

export const MENSAJES = {
  'sin-geo':          'Tu navegador no permite geolocalizaci\u00f3n.',
  'sin-permiso':      'No has dado permiso de ubicaci\u00f3n.',
  'sin-provincia':    'No he identificado tu provincia.',
  'sin-gasolineras':  'No he encontrado gasolineras con precio.',
  'default':          'El servicio del Ministerio no ha respondido.'
};
