// gasolineras.js — consulta a la API oficial del Ministerio (solo España).
// Aislado de la interfaz: devuelve datos o lanza un error con un código.

import { norm, haversine, position } from './util.js';

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

// Nominatim da la provincia como código ISO 3166-2 (más fiable que el nombre,
// que a veces no viene). Tabla ISO -> código de provincia del Ministerio (INE).
const ISO_PROVINCIA = {
  'ES-VI':'01','ES-AB':'02','ES-A':'03','ES-AL':'04','ES-AV':'05','ES-BA':'06','ES-PM':'07',
  'ES-B':'08','ES-BU':'09','ES-CC':'10','ES-CA':'11','ES-CS':'12','ES-CR':'13','ES-CO':'14',
  'ES-C':'15','ES-CU':'16','ES-GI':'17','ES-GR':'18','ES-GU':'19','ES-SS':'20','ES-H':'21',
  'ES-HU':'22','ES-J':'23','ES-LE':'24','ES-L':'25','ES-LO':'26','ES-LU':'27','ES-M':'28',
  'ES-MA':'29','ES-MU':'30','ES-NA':'31','ES-OR':'32','ES-O':'33','ES-P':'34','ES-GC':'35',
  'ES-PO':'36','ES-SA':'37','ES-TF':'38','ES-S':'39','ES-SG':'40','ES-SE':'41','ES-SO':'42',
  'ES-T':'43','ES-TE':'44','ES-TO':'45','ES-V':'46','ES-VA':'47','ES-BI':'48','ES-ZA':'49',
  'ES-Z':'50','ES-CE':'51','ES-ML':'52'
};
// En las comunidades de una sola provincia Nominatim a veces solo trae el nivel de comunidad.
const ISO_COMUNIDAD_UNIPROVINCIAL = {
  'ES-MD':'28','ES-AS':'33','ES-CB':'39','ES-RI':'26','ES-NC':'31','ES-MC':'30','ES-IB':'07',
  'ES-CE':'51','ES-ML':'52'
};

// Nombre de cada provincia, para distinguir municipios homónimos.
const NOMBRE_PROVINCIA = {
  '01':'Álava','02':'Albacete','03':'Alicante','04':'Almería','05':'Ávila','06':'Badajoz',
  '07':'Baleares','08':'Barcelona','09':'Burgos','10':'Cáceres','11':'Cádiz','12':'Castellón',
  '13':'Ciudad Real','14':'Córdoba','15':'A Coruña','16':'Cuenca','17':'Girona','18':'Granada',
  '19':'Guadalajara','20':'Gipuzkoa','21':'Huelva','22':'Huesca','23':'Jaén','24':'León',
  '25':'Lleida','26':'La Rioja','27':'Lugo','28':'Madrid','29':'Málaga','30':'Murcia',
  '31':'Navarra','32':'Ourense','33':'Asturias','34':'Palencia','35':'Las Palmas',
  '36':'Pontevedra','37':'Salamanca','38':'Santa Cruz de Tenerife','39':'Cantabria',
  '40':'Segovia','41':'Sevilla','42':'Soria','43':'Tarragona','44':'Teruel','45':'Toledo',
  '46':'Valencia','47':'Valladolid','48':'Bizkaia','49':'Zamora','50':'Zaragoza',
  '51':'Ceuta','52':'Melilla'
};

const NOMINATIM ='https://nominatim.openstreetmap.org/';
const MINISTERIO = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/' +
  'PreciosCarburantes/EstacionesTerrestres/FiltroProvincia/';

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

/** Provincia de una dirección de Nominatim: primero por código ISO, si no por nombre. */
export function provinciaDeAddress(address){
  const a = address || {};
  return ISO_PROVINCIA[a['ISO3166-2-lvl6']] ||
         ISO_COMUNIDAD_UNIPROVINCIAL[a['ISO3166-2-lvl4']] ||
         provinceCode(a);
}

/**
 * Interpreta lo que escribe el usuario: código postal (5 cifras, provincia 01-52)
 * o nombre de municipio. Lanza 'lugar-vacio' o 'cp-invalido'.
 */
export function parseConsulta(texto){
  const t = String(texto || '').trim().replace(/\s+/g, ' ');
  if(!t) throw new Error('lugar-vacio');
  if(/^\d+$/.test(t)){
    const prov = parseInt(t.slice(0, 2), 10);
    if(t.length !== 5 || prov < 1 || prov > 52) throw new Error('cp-invalido');
    return { tipo: 'cp', cp: t, provincia: t.slice(0, 2) };
  }
  if(t.length < 2) throw new Error('lugar-vacio');
  return { tipo: 'nombre', nombre: t };
}

// "La Zarza" y "Zarza (La)" se comparan igual
const sinArticulo = s => norm(s).replace(/\(.*?\)/g, '').replace(/^((el|la|los|las|a|o|os|as) |l')/, '').trim();

/**
 * Convierte resultados de Nominatim en lugares {nombre, zona, provincia, lat, lon}.
 * Descarta los que no se pueden situar en una provincia y quita duplicados
 * (Nominatim devuelve a veces el mismo municipio como ciudad y como término).
 * Si solo uno coincide exactamente con lo buscado, devuelve solo ese.
 */
export function lugaresDeNominatim(lista, buscado){
  const vistos = new Set(), out = [];
  for(const r of lista || []){
    const provincia = provinciaDeAddress(r.address);
    const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
    if(!provincia || !isFinite(lat) || !isFinite(lon)) continue;
    const nombre = r.name || String(r.display_name || '').split(',')[0];
    const clave = norm(nombre) + '|' + provincia;
    if(vistos.has(clave)) continue;
    vistos.add(clave);
    out.push({ nombre, zona: NOMBRE_PROVINCIA[provincia] || '', provincia, lat, lon });
  }
  if(buscado){
    const exactos = out.filter(l => sinArticulo(l.nombre) === sinArticulo(buscado));
    if(exactos.length) return exactos;
  }
  return out;
}

/** Centro aproximado de un código postal: media de sus gasolineras. null si no tiene. */
export function centroDeCP(all, cp){
  const en = all.filter(s => s.cp === cp);
  if(!en.length) return null;
  return {
    lat: en.reduce((t, s) => t + s.lat, 0) / en.length,
    lon: en.reduce((t, s) => t + s.lon, 0) / en.length
  };
}

/** Lista del Ministerio -> [{price, lat, lon, name, addr, cp, localidad}] (solo con precio y coordenadas). */
export function parseEstaciones(data){
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
      addr: s['Dirección'] || s['Direccion'] || '',
      cp: s['C.P.'] || '',
      localidad: s['Municipio'] || s['Localidad'] || ''
    });
  }
  return all;
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

async function estacionesDeProvincia(code){
  const data = await fetch(MINISTERIO + code).then(r => r.json());
  const all = parseEstaciones(data);
  if(!all.length) throw new Error('sin-gasolineras');
  return { all, fecha: (data && data.Fecha) || '' };
}

// Si falla, lanza 'sin-mapa' para no culpar al Ministerio de un fallo de Nominatim.
function nominatim(ruta, params){
  const q = new URLSearchParams({ format: 'jsonv2', 'accept-language': 'es', ...params });
  return fetch(NOMINATIM + ruta + '?' + q)
    .then(r => { if(r.ok === false) throw new Error(); return r.json(); })
    .catch(() => { throw new Error('sin-mapa'); });
}

/** Devuelve {top, cheapest, avg, count, fecha} o lanza Error con code en .message */
export async function buscarCercanas(){
  const pos = await position();
  const { latitude: lat, longitude: lon } = pos.coords;

  const geo = await nominatim('reverse', { lat, lon, zoom: 8 });
  const code = provinciaDeAddress(geo && geo.address);
  if(!code) throw new Error('sin-provincia');

  const { all, fecha } = await estacionesDeProvincia(code);
  const res = pickNearby(all, lat, lon);
  if(!res) throw new Error('sin-gasolineras');
  return { ...res, fecha };
}

/**
 * Resuelve un código postal o un nombre de municipio a una lista de lugares
 * {nombre, zona, provincia, lat, lon, cp?}. Si hay más de uno, la interfaz
 * pide elegir. Para un CP siempre hay uno; lat/lon pueden venir null si
 * Nominatim no lo conoce (entonces se sitúa con sus gasolineras).
 * Solo se llama al pulsar Buscar: la política de Nominatim no permite autocompletar.
 */
export async function resolverLugar(texto){
  const q = parseConsulta(texto);
  if(q.tipo === 'cp'){
    const r = await nominatim('search', { postalcode: q.cp, countrycodes: 'es', limit: 1 })
      .catch(() => []);
    const p = (r || []).find(x => x.name === q.cp || (x.address && x.address.postcode === q.cp));
    return [{ nombre: q.cp, zona: NOMBRE_PROVINCIA[q.provincia] || '', provincia: q.provincia, cp: q.cp,
      lat: p ? parseFloat(p.lat) : null, lon: p ? parseFloat(p.lon) : null }];
  }
  const r = await nominatim('search', { city: q.nombre, countrycodes: 'es', addressdetails: 1,
    featureType: 'settlement', limit: 5 });
  const lugares = lugaresDeNominatim(r, q.nombre);
  if(!lugares.length) throw new Error('lugar-no-encontrado');
  return lugares;
}

/** Gasolineras más cercanas a un lugar de resolverLugar(). Mismo formato que buscarCercanas(), más .lugar */
export async function buscarEnLugar(lugar){
  const { all, fecha } = await estacionesDeProvincia(lugar.provincia);
  let { lat, lon } = lugar;
  if(!Number.isFinite(lat) || !Number.isFinite(lon)){
    const c = lugar.cp ? centroDeCP(all, lugar.cp) : null;
    if(!c) throw new Error('cp-sin-situar');
    ({ lat, lon } = c);
  }
  const res = pickNearby(all, lat, lon);
  if(!res) throw new Error('sin-gasolineras');
  return { ...res, fecha, lugar };
}

export const MENSAJES = {
  'sin-geo':             'Tu navegador no permite geolocalización.',
  'sin-permiso':         'No has dado permiso de ubicación.',
  'sin-provincia':       'No he identificado tu provincia.',
  'sin-gasolineras':     'No he encontrado gasolineras con precio.',
  'lugar-vacio':         'Escribe un código postal o el nombre de un municipio.',
  'cp-invalido':         'Ese código postal no existe: son 5 cifras y empieza por 01 a 52.',
  'cp-sin-situar':       'No he podido situar ese código postal en el mapa.',
  'lugar-no-encontrado': 'No encuentro ese municipio en España. Prueba con su nombre oficial o su código postal.',
  'sin-mapa':            'El servicio de mapas no ha respondido. Prueba con el código postal.',
  'default':             'El servicio del Ministerio no ha respondido.'
};
