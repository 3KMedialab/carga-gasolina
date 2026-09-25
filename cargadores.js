// cargadores.js — puntos de carga públicos vía Open Charge Map (OCM).
// Aislado de la interfaz: devuelve datos o lanza un error con un código,
// mismo patrón que gasolineras.js.
//
// Decisiones tomadas (para quien retome esto más adelante):
//  - Sin acuerdos comerciales: OCM es gratis, sin key de pago, sin backend.
//  - Sin filtro `opendata=true`: en fase de test no hace falta legalmente;
//    si algún día se monetiza, es de las primeras cosas a revisar, junto con
//    el resto de la arquitectura (ver hoja-de-ruta.md).
//  - Nada se hardcodea contra un ID de OCM: se resuelve por texto o por el
//    booleano correspondiente contra /referencedata, porque los IDs no son
//    estables entre categorías (ej.: "Type 2" tiene dos IDs, 25 y 1036).
//  - El precio y el recargo por tiempo NUNCA se calculan a partir del texto
//    libre de OCM (UsageCost / GeneralComments): los formatos observados
//    son demasiado variados (gratis+recargo, recargo solo tras terminar de
//    cargar, tarifa por hora, precio distinto en AC/DC...) como para
//    interpretarlos con fiabilidad. Se muestran tal cual, y quien mire la
//    ficha decide. Lo único que SÍ se automatiza es un aviso visual (ver
//    pareceRecargoPorTiempo) que solo resalta texto, nunca calcula un número.

import { position } from './util.js';
import { loadOcmRef, storeOcmRef, loadChargers } from './datos.js';

const OCM_API_KEY = '6e1ea5ca-2066-44ba-baec-dcd927c1607e'; // gratis en openchargemap.org (My Profile > My Apps)
const OCM_BASE = 'https://api.openchargemap.io/v3';

// La tabla de referencia (conectores, usos, estados, operadores) apenas
// cambia: se refresca cada 30 días, no en cada búsqueda.
const OCM_REF_DIAS = 30;

// Radios para el aviso ("hasta X km"), no para repetir peticiones: se pide
// una sola vez con el radio más amplio de la lista, y estos cortes se
// aplican en cliente sobre esos resultados ya descargados — mismo patrón
// que pickNearby() en gasolineras.js. Sin comodín "999999": un cargador
// AC lento a 300 km no sirve de nada (a diferencia de la gasolinera más
// cercana "aunque esté lejos", que sí tiene sentido).
const RADII = [8, 20, 50];
// Si ni siquiera a 50 km hay nada, UNA única llamada más con radio mayor
// antes de rendirnos — nunca más de dos peticiones por búsqueda.
const RADIO_AMPLIADO = 150;
const MAX_RESULTADOS = 50;

// ======================= REFERENCIA (conectores, usos, estados, operadores) =======================

// "Empieza por", no "contiene": así no cuela "CCS (Type 2)" (conector rápido,
// ID 33) al buscar conectores de tipo AC lento.
function esConectorTipo2(c){
  return (c.Title || '').toLowerCase().startsWith('type 2');
}

// Público sin más, o "para clientes/visitantes" (decisión explícita: un
// punto en un supermercado o una gasolinera cuenta aunque OCM lo marque
// como "privado para clientes", porque es exactamente el uso real de un
// PHEV). Deja fuera "Private - Restricted Access" y "Privately Owned -
// Notice Required", que sí son restricción real.
function esUsoValido(u){
  const t = (u.Title || '').toLowerCase();
  return t.startsWith('public') || t.includes('customers');
}

async function fetchReferencia(){
  const url = `${OCM_BASE}/referencedata/?output=json&key=${OCM_API_KEY}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('default');
  const data = await res.json();

  const connectorIds = (data.ConnectionTypes || []).filter(esConectorTipo2).map(c => c.ID);
  const usageIds = (data.UsageTypes || []).filter(esUsoValido).map(u => u.ID);
  // Por el booleano, no por ID: si OCM añade un StatusTypeID nuevo, esto
  // sigue funcionando sin tocar código.
  const operationalIds = (data.StatusTypes || []).filter(s => s.IsOperational === true).map(s => s.ID);
  // Solo id -> nombre, no la tabla de operadores entera (puede tener miles
  // de entradas a nivel mundial): así el caché en localStorage no crece sin control.
  const operators = {};
  (data.Operators || []).forEach(o => { if(o && o.ID != null) operators[o.ID] = o.Title || ''; });

  return { fecha: new Date().toISOString(), connectorIds, usageIds, operationalIds, operators };
}

function refCaducada(ref){
  if(!ref || !ref.fecha) return true;
  const dias = (Date.now() - new Date(ref.fecha).getTime()) / 86400000;
  return !isFinite(dias) || dias > OCM_REF_DIAS;
}

async function referenciaVigente(){
  let ref = loadOcmRef();
  if(refCaducada(ref)){
    ref = await fetchReferencia();
    storeOcmRef(ref);
  }
  return ref;
}

// ======================= FILTRADO DE UN POI =======================

/** Una conexión concreta hereda el estado operativo del POI si no trae el
 *  suyo propio (algunos POI reales tienen, por ejemplo, un conector Tipo 2
 *  operativo y otro rápido todavía "Planned" en el mismo emplazamiento). */
function conexionOperativa(conn, poiOperativo, operationalIds){
  if(conn.StatusTypeID == null) return poiOperativo;
  return operationalIds.includes(conn.StatusTypeID);
}

/** Procesa un POI crudo de OCM contra la referencia ya resuelta.
 *  Devuelve null si no pasa el filtro (privado, no operativo, o sin ningún
 *  conector Tipo 2 operativo tras filtrar), o el resultado normalizado. */
export function procesarPOI(poi, ref){
  const poiOperativo = ref.operationalIds.includes(poi.StatusTypeID);
  if(!poiOperativo) return null;
  if(!ref.usageIds.includes(poi.UsageTypeID)) return null;

  const conexiones = (poi.Connections || [])
    .filter(c => ref.connectorIds.includes(c.ConnectionTypeID))
    .filter(c => conexionOperativa(c, poiOperativo, ref.operationalIds))
    .filter(c => c.PowerKW > 0)
    .map(c => ({ qty: c.Quantity > 0 ? c.Quantity : 1, kw: c.PowerKW }));

  if(!conexiones.length) return null;

  const addr = poi.AddressInfo || {};
  return {
    id: poi.ID,
    name: addr.Title || 'Cargador',
    distanceKm: isFinite(addr.Distance) ? addr.Distance : null,
    conexiones,
    operatorName: ref.operators[poi.OperatorID] || '',
    price: (poi.UsageCost || '').trim() || null,
    note: (poi.GeneralComments || '').trim() || null,
    verified: poi.DateLastVerified || null
  };
}

// ======================= BÚSQUEDA =======================

async function fetchPOIs(lat, lon, distanceKm){
  const params = new URLSearchParams({
    output: 'json', countrycode: 'ES',
    latitude: lat, longitude: lon,
    distance: distanceKm, distanceunit: 'KM',
    maxresults: MAX_RESULTADOS, compact: 'true',
    key: OCM_API_KEY
  });
  const res = await fetch(`${OCM_BASE}/poi/?${params}`);
  if(!res.ok) throw new Error('default');
  return res.json();
}

function estaGuardado(nombre, guardados){
  const n = (nombre || '').trim().toLowerCase();
  return guardados.some(c => (c.name || '').trim().toLowerCase() === n);
}

async function candidatosEnRadio(lat, lon, distanceKm, ref, guardados){
  const pois = await fetchPOIs(lat, lon, distanceKm);
  return pois
    .map(p => procesarPOI(p, ref))
    .filter(Boolean)
    .map(r => ({ ...r, yaGuardado: estaGuardado(r.name, guardados) }))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}

/**
 * Busca cargadores cercanos. Una sola llamada a la API (con el radio más
 * amplio de RADII); si no hay nada, una segunda con RADIO_AMPLIADO. El
 * "radio ampliable" de cara al usuario es, igual que en gasolineras.js,
 * un filtro en cliente sobre esos resultados ya descargados, no una
 * llamada nueva por cada corte.
 * Devuelve { resultados, radioKm } o lanza Error con code en .message.
 * Mismo patrón que buscarCercanas() en gasolineras.js: sin parámetros,
 * pide la posición ella misma.
 */
export async function buscarCercanos(){
  const pos = await position();
  const { latitude: lat, longitude: lon } = pos.coords;

  const ref = await referenciaVigente();
  const guardados = loadChargers();

  let todos = await candidatosEnRadio(lat, lon, RADII[RADII.length - 1], ref, guardados);
  if(!todos.length){
    todos = await candidatosEnRadio(lat, lon, RADIO_AMPLIADO, ref, guardados);
  }
  if(!todos.length) throw new Error('sin-cargadores');

  for(const radioKm of RADII){
    const resultados = todos.filter(r => r.distanceKm != null && r.distanceKm <= radioKm);
    if(resultados.length) return { resultados, radioKm };
  }
  return { resultados: todos, radioKm: RADIO_AMPLIADO };
}

export const MENSAJES = {
  'sin-geo':        'Tu navegador no permite geolocalizaci\u00f3n.',
  'sin-permiso':    'No has dado permiso de ubicaci\u00f3n.',
  'sin-cargadores': 'No hemos encontrado cargadores p\u00fablicos cerca, ni ampliando la b\u00fasqueda.',
  'default':        'Open Charge Map no ha respondido.'
};

// ======================= AVISO DE POSIBLE RECARGO POR TIEMPO =======================
// Solo decide si RESALTAR la nota, nunca extrae ni calcula un valor: meter
// un freeHours/overMin equivocado en el cálculo sería peor que no tenerlo
// (ver la discusión completa en el propio código de interfaz.js, junto a
// donde se usa esta función).
const TIME_FEE_HINTS = ['/min', '/hour', 'parking fee', 'without charging'];
export function pareceRecargoPorTiempo(...textos){
  const t = textos.filter(Boolean).join(' ').toLowerCase();
  return TIME_FEE_HINTS.some(h => t.includes(h));
}

// ======================= FRESCURA DEL DATO DE VERIFICACIÓN =======================
// Un cargador no cambia tan rápido como el nivel de una batería (que se
// recalibra en días): aquí los umbrales son en meses.
export function frescura(verified){
  if(!verified) return { label: 'Sin fecha de verificaci\u00f3n', nivel: 'mal' };
  const meses = (Date.now() - new Date(verified).getTime()) / (30 * 86400000);
  if(!isFinite(meses)) return { label: 'Sin fecha de verificaci\u00f3n', nivel: 'mal' };
  if(meses <= 3)  return { label: 'Verificado hace poco', nivel: 'bien' };
  if(meses <= 12) return { label: 'Verificado hace meses', nivel: 'regular' };
  return { label: 'Verificado hace m\u00e1s de un a\u00f1o', nivel: 'mal' };
}

// para las pruebas
export const _test = { esConectorTipo2, esUsoValido, conexionOperativa, refCaducada };
