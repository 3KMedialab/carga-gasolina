// humo.mjs — arranca la app completa contra un DOM simulado.
// Comprueba lo que ninguna prueba de sintaxis detecta: que la app realmente funciona.
// Ejecutar con:  node humo.mjs

import { JSDOMLite, montar } from './dom-falso.mjs';
// el mismo módulo que usa interfaz.js: su caché en memoria pasa de un escenario a otro
import { vaciarCache as vaciarCacheGasolineras } from './js/gasolineras.js';

let pasa = 0, falla = 0;
const fallos = [];
const ok = (n, c, d = '') => c ? pasa++ : (falla++, fallos.push(n + (d ? '  ->  ' + d : '')));

// ---------- 1. app vacía ----------
{
  const dom = montar({});
  const { iniciar } = await import('./js/interfaz.js?1');
  iniciar();
  ok('sin vehículos abre la configuración inicial',
     dom.get('overlay').classList.contains('open'));
  ok('el esquema queda marcado', dom.store['cvg_schema'] === '3');
  dom.desmontar();
}

// ---------- 2. app con datos ----------
{
  const dom = montar({
    'cvg_schema': '2',
    'cvg_profiles_v1': JSON.stringify({ list:[{ id:'v1', name:'Atto 2', battery:18, maxPower:6.6,
      elecCons:22, fuelCons:5.0, chargeEff:86, chem:'lfp' }], activeId:'v1' }),
    'cvg_session_v1': JSON.stringify({ chargerPrice:0.25, fuelPrice:1.744, chargerPower:7.4,
      currentSoc:30, parkHours:2, sessionKwh:12, detourKm:0, elecConsumption:22,
      fuelConsumption:5.0, sessionFee:0, pricingMode:0, pricePerMin:0 }),
    'cvg_chargers_v1': JSON.stringify([{ id:'c1', name:'Mercadona', power:7.4, mode:0, price:0.25,
      perMin:0, freeHours:1.5, overMin:0.07, note:'Pago con app', updated:'2026-08-01T10:00:00Z' }]),
    'cvg_selch_v1':'c1', 'cvg_mode_v1':'parked', 'cvg_cold_v1':'0', 'cvg_preset_v1':'mixto',
    'cvg_calib_v1': new Date(Date.now() - 3*86400000).toISOString(),
    'cvg_hist_v1': JSON.stringify([{ date:'x', chargerPrice:0.25, savings:0.9, km:39, free:false }])
  });
  const { iniciar } = await import('./js/interfaz.js?2');
  iniciar();

  const txt = id => dom.get(id).textContent;
  const html = id => dom.get(id).innerHTML.replace(/<[^>]+>/g, '');

  ok('el veredicto se calcula', txt('badge').length > 0, txt('badge'));
  ok('con recargo, avisa del límite', html('pk-note').includes('Desconecta') || html('pk-note').includes('demasiado'),
     html('pk-note'));
  ok('la fila de recargo aparece', dom.get('pk-row-over').style.display === '');
  ok('la nota del cargador se muestra', txt('charger-note') === 'Pago con app');
  ok('la calibración LFP funciona', txt('calib-main').includes('Calibrada'), txt('calib-main'));
  ok('el historial suma', txt('hist-count') === '1');
  ok('el reloj aparece en el chip con recargo',
     dom.get('saved-chargers').innerHTML.includes('chip-clock'));
  ok('el aviso de recargo sale en la secci\u00f3n del cargador, con la hora l\u00edmite',
     !dom.get('charger-recargo').classList.contains('hidden') &&
     dom.get('charger-recargo').textContent.includes('más de 1 h 30 min'), dom.get('charger-recargo').textContent);
  ok('el cargador elegido se puede editar con un bot\u00f3n visible',
     dom.get('saved-chargers').innerHTML.includes('data-editar="c1"'));

  // guardar una recarga
  dom.click('btn-save-parked');
  ok('guardar recarga aumenta el historial', txt('hist-count') === '2');

  // carga gratuita
  dom.get('inp-chargerPrice').value = '0';
  dom.fire('inp-chargerPrice', 'input');
  ok('precio 0 con recargo NO se considera gratis', txt('badge') !== 'Gratis', txt('badge'));

  dom.desmontar();
}

// ---------- 3. carga gratuita sin ataduras ----------
{
  const dom = montar({
    'cvg_schema': '2',
    'cvg_profiles_v1': JSON.stringify({ list:[{ id:'v1', name:'Atto 2', battery:18, maxPower:6.6,
      elecCons:22, fuelCons:5.0, chargeEff:86, chem:'lfp' }], activeId:'v1' }),
    'cvg_session_v1': JSON.stringify({ chargerPrice:0, fuelPrice:1.744, chargerPower:7.4,
      currentSoc:30, parkHours:2, sessionKwh:12, detourKm:0, elecConsumption:22,
      fuelConsumption:5.0, sessionFee:0, pricingMode:0, pricePerMin:0 }),
    'cvg_mode_v1':'parked'
  });
  const { iniciar } = await import('./js/interfaz.js?3');
  iniciar();

  ok('gratis sin ataduras: veredicto "Gratis"', dom.get('badge').textContent === 'Gratis',
     dom.get('badge').textContent);
  ok('muestra el equivalente en gasolina',
     dom.get('amount-label').textContent.includes('gasolina'));

  dom.click('btn-save-parked');
  const h = JSON.parse(dom.store['cvg_hist_v1']);
  ok('la recarga gratuita se guarda marcada como tal', h[0].free === true);
  ok('y el desglose lo refleja', dom.get('hist-note').textContent.includes('gratis'),
     dom.get('hist-note').textContent);
  dom.desmontar();
}

// ---------- 4. migración de cargadores antiguos ----------
{
  const dom = montar({
    'cvg_profiles_v1': JSON.stringify({ list:[{ id:'v1', name:'A', battery:18, maxPower:6.6,
      elecCons:22, fuelCons:5, chargeEff:86, chem:'lfp' }], activeId:'v1' }),
    'cvg_chargers_v1': JSON.stringify([{ name:'Viejo', price:0.3, power:7.4 }]),
    'cvg_mode_v1':'parked'
  });
  const { iniciar } = await import('./js/interfaz.js?4');
  iniciar();
  const c = JSON.parse(dom.store['cvg_chargers_v1'])[0];
  ok('el cargador antiguo recibe id', !!c.id, JSON.stringify(c));
  ok('y se puede pintar sin errores', dom.get('saved-chargers').innerHTML.includes('Viejo'));
  dom.desmontar();
}

// ---------- 5. mediciones ----------
{
  const dom = montar({
    'cvg_schema':'2',
    'cvg_profiles_v1': JSON.stringify({ list:[{ id:'v1', name:'A', battery:18, maxPower:6.6,
      elecCons:22, fuelCons:5, chargeEff:86, chem:'lfp' }], activeId:'v1' }),
    'cvg_mode_v1':'parked'
  });
  const { iniciar } = await import('./js/interfaz.js?5');
  iniciar();

  dom.click('btn-measure');
  ok('el nivel de referencia se adapta a LFP',
     dom.get('meas-level').innerHTML.includes('100%'));

  // sin climatización indicada, la medida no se guarda
  dom.get('meas-km1').value = '0'; dom.get('meas-km2').value = '250';
  dom.get('meas-kwh').value = '74'; dom.get('meas-lit').value = '0';
  dom.click('meas-save');
  ok('sin climatización no se guarda la medida', dom.store['cvg_meas_v1'] === undefined);
  ok('...y lo explica', dom.get('meas-err').classList.contains('show') &&
     dom.get('meas-err').textContent.includes('calefacción'), dom.get('meas-err').textContent);

  const antes = dom.get('pk-km').textContent;
  // tres medidas sin climatización que reflejan un consumo peor del declarado
  [[250,74],[210,63],[300,88]].forEach(([km,kwh]) => {
    dom.get('meas-km1').value = '0';
    dom.get('meas-km2').value = String(km);
    dom.get('meas-kwh').value = String(kwh);
    dom.get('meas-lit').value = '0';
    dom.get('meas-clima').value = 'nada';
    dom.get('meas-frio').value = 'no';
    dom.click('meas-save');
  });
  const m = JSON.parse(dom.store['cvg_meas_v1']);
  ok('se guardan las tres medidas', m.length === 3, String(m.length));
  ok('cada una con su climatización y su frío', m.every(x => x.clima === 'nada' && x.frio === false));
  ok('sin ids repetidos', new Set(m.map(x => x.id)).size === 3);
  ok('el formulario queda limpio para la siguiente', dom.get('meas-clima').value === '');
  ok('las medidas cambian el resultado', dom.get('pk-km').textContent !== antes,
     antes + ' -> ' + dom.get('pk-km').textContent);
  ok('el consumo pasa a ser el medido',
     Math.abs(parseFloat(dom.get('inp-elecConsumption').value) - 22) > 1,
     dom.get('inp-elecConsumption').value);
  ok('el margen de error baja', dom.get('meas-summary').innerHTML.includes('margen de error'));
  ok('el resumen separa por climatización',
     dom.get('meas-summary').innerHTML.includes('<div class="k">Con calefacción</div><div class="d">Se usa el consumo declarado'),
     dom.get('meas-summary').innerHTML);
  dom.desmontar();
}

// ---------- 6. buscar cargadores públicos, sin geolocalización disponible ----------
// El simulador deja navigator.geolocation en null (como un navegador que no
// lo soporta) y fetch siempre falla: el único camino que se puede ejercitar
// aquí sin red real es el de error, pero es justo el que garantiza que la
// app no se queda "colgada" (botón deshabilitado) si el usuario no da permiso.
{
  const dom = montar({
    'cvg_schema': '2',
    'cvg_profiles_v1': JSON.stringify({ list:[{ id:'v1', name:'Atto 2', battery:18, maxPower:6.6,
      elecCons:22, fuelCons:5.0, chargeEff:86, chem:'lfp' }], activeId:'v1' }),
    'cvg_mode_v1':'parked'
  });
  const { iniciar, _test } = await import('./js/interfaz.js?6');
  iniciar();

  await _test.buscarCargadoresCercanos();

  ok('sin geolocalización, avisa con el mensaje correcto',
     dom.get('cargadores-note').textContent.includes('geolocalizaci\u00f3n'),
     dom.get('cargadores-note').textContent);
  ok('...y no deja ningún resultado a medias',
     dom.get('cargadores-resultados').innerHTML === '');
  ok('...y el botón vuelve a estar disponible para reintentar',
     dom.get('btn-buscar-cargadores').disabled === false);
  ok('...con la etiqueta original, no "Buscando..." colgado',
     dom.get('buscar-cargadores-label').textContent === 'Buscar cerca',
     dom.get('buscar-cargadores-label').textContent);

  dom.desmontar();
}

// ---------- 7. unidad del tiempo de aparcado (min <-> horas) ----------
{
  const dom = montar({
    'cvg_schema': '2',
    'cvg_profiles_v1': JSON.stringify({ list:[{ id:'v1', name:'Atto 2', battery:18, maxPower:6.6,
      elecCons:22, fuelCons:5.0, chargeEff:86, chem:'lfp' }], activeId:'v1' }),
    'cvg_session_v1': JSON.stringify({ chargerPrice:0.45, fuelPrice:1.744, chargerPower:45,
      currentSoc:82, parkHours:0.65, sessionKwh:0, detourKm:0, elecConsumption:22,
      fuelConsumption:5.0, sessionFee:0, pricingMode:0, pricePerMin:0 }),
    'cvg_mode_v1':'parked'
  });
  const { iniciar } = await import('./js/interfaz.js?7');
  iniciar();

  ok('por defecto la unidad es horas', dom.get('btn-parkUnit').textContent === 'horas');
  const kwhEnHoras = dom.get('pk-kwh').textContent;

  dom.click('btn-parkUnit');
  ok('al tocar, cambia a minutos', dom.get('btn-parkUnit').textContent === 'min');
  ok('0,65h se muestran como 39 min', String(dom.get('inp-parkHours').value) === '39',
     String(dom.get('inp-parkHours').value));
  ok('el resultado no cambia al cambiar solo la unidad',
     dom.get('pk-kwh').textContent === kwhEnHoras);

  dom.get('inp-parkHours').value = '39';
  dom.fire('inp-parkHours', 'input');
  ok('escribir 39 en minutos da el mismo resultado que 0,65 horas',
     dom.get('pk-kwh').textContent === kwhEnHoras, dom.get('pk-kwh').textContent);

  dom.click('btn-parkUnit');
  ok('al volver a horas, 39 min se muestran como 0,65', String(dom.get('inp-parkHours').value) === '0.65',
     String(dom.get('inp-parkHours').value));
  ok('la unidad elegida se guarda', dom.store['cvg_parkunit_v1'] === 'h');

  dom.desmontar();
}

// ---------- 8. copia de seguridad: exportar/importar ----------
{
  const dom = montar({
    'cvg_schema': '2',
    'cvg_profiles_v1': JSON.stringify({ list:[{ id:'v1', name:'Atto 2', battery:18, maxPower:6.6,
      elecCons:22, fuelCons:5.0, chargeEff:86, chem:'lfp' }], activeId:'v1' }),
    'cvg_hist_v1': JSON.stringify([{ date:'x', chargerPrice:0.25, savings:0.9, km:39, free:false }]),
    'cvg_mode_v1':'parked'
  });
  const D = await import('./js/datos.js?8');

  const copia = D.exportAll();
  ok('la copia incluye los perfiles', copia['cvg_profiles_v1'] !== undefined);
  ok('la copia incluye el historial', copia['cvg_hist_v1'] !== undefined);
  ok('la copia no incluye claves ajenas a cvg_', Object.keys(copia).every(k => k.indexOf('cvg_') === 0));

  // se simula perder los datos (borrar el icono) y restaurarlos desde la copia
  Object.keys(dom.store).forEach(k => delete dom.store[k]);
  ok('borrado: ya no hay perfiles', dom.store['cvg_profiles_v1'] === undefined);

  ok('importAll devuelve true con una copia válida', D.importAll(copia) === true);
  ok('el historial se restaura', dom.store['cvg_hist_v1'] === copia['cvg_hist_v1']);
  ok('rechaza una copia vacía o inválida', D.importAll({}) === false && D.importAll(null) === false);

  dom.desmontar();
}

// ---------- 9. gasolineras por código postal o municipio ----------
// fetch simulado según la URL: Nominatim para situar el lugar y el Ministerio
// para la provincia. Se guardan las URLs para comprobar qué provincia se pidió.
{
  const dom = montar({
    'cvg_schema': '2',
    'cvg_profiles_v1': JSON.stringify({ list:[{ id:'v1', name:'Atto 2', battery:18, maxPower:6.6,
      elecCons:22, fuelCons:5.0, chargeEff:86, chem:'lfp' }], activeId:'v1' }),
    'cvg_mode_v1':'parked'
  });
  const pedidas = [];
  const resp = d => Promise.resolve({ json: () => Promise.resolve(d) });
  const ministerio = { Fecha: '18/10/2026 20:00', ListaEESSPrecio: [
    { 'C.P.':'28012', 'Latitud':'40,410', 'Longitud (WGS84)':'-3,700', 'Precio Gasolina 95 E5':'1,800',
      'Rótulo':'CEPSA', 'Dirección':'C/ Uno', 'Municipio':'Madrid' },
    { 'C.P.':'28014', 'Latitud':'40,420', 'Longitud (WGS84)':'-3,690', 'Precio Gasolina 95 E5':'1,700',
      'Rótulo':'BP', 'Dirección':'C/ Dos', 'Municipio':'Madrid' }
  ]};
  const nomArroyo = [
    { name:'Arroyomolinos', lat:'39.18', lon:'-6.16', address:{ 'ISO3166-2-lvl6':'ES-CC', province:'Cáceres' } },
    { name:'Arroyomolinos', lat:'40.41', lon:'-3.70', address:{ 'ISO3166-2-lvl4':'ES-MD', state:'Comunidad de Madrid' } }
  ];
  globalThis.fetch = url => {
    url = String(url); pedidas.push(url);
    if(url.includes('postalcode=28013')) return resp([{ name:'28013', lat:'40.418', lon:'-3.707' }]);
    if(url.includes('nominatim') && url.includes('Arroyomolinos')) return resp(nomArroyo);
    if(url.includes('FiltroProvincia/')) return resp(ministerio);
    return Promise.reject(new Error('sin-red'));
  };
  const espera = () => new Promise(r => setTimeout(r, 20));
  vaciarCacheGasolineras();

  const { iniciar, _test } = await import('./js/interfaz.js?9');
  iniciar();
  ok('sin lugar guardado, el campo arranca vacío', dom.get('lugar-q').value === '');

  // a) código postal sin gasolineras propias: se sitúa por Nominatim y salen las cercanas
  dom.get('lugar-q').value = '28013';
  await _test.buscarPorLugar();
  ok('CP: se pide la provincia de sus 2 primeras cifras',
     pedidas.some(u => u.endsWith('FiltroProvincia/28')), pedidas.join(' | '));
  ok('CP: salen las gasolineras', dom.get('station-list').innerHTML.includes('CEPSA') &&
     dom.get('station-list').style.display === 'block');
  ok('CP: el precio pasa a ser la media', dom.get('inp-fuelPrice').value === '1.750',
     dom.get('inp-fuelPrice').value);
  ok('CP: la pista dice dónde', dom.get('fuel-hint').textContent.includes('cerca de 28013'),
     dom.get('fuel-hint').textContent);
  ok('CP: la nota aclara desde dónde se mide', dom.get('refresh-note').textContent.includes('centro de 28013'),
     dom.get('refresh-note').textContent);
  ok('CP: se recuerda lo buscado', dom.store['cvg_lugar_v1'] === '28013');
  ok('CP: los botones vuelven a estar disponibles',
     !dom.get('btn-lugar').disabled && !dom.get('btn-refresh').disabled &&
     dom.get('btn-lugar').textContent === 'Buscar');

  // b) nombre ambiguo: pide elegir y, al elegir, busca en esa provincia
  pedidas.length = 0;
  dom.get('lugar-q').value = 'Arroyomolinos';
  await _test.buscarPorLugar();
  const opc = dom.get('lugar-opciones');
  ok('ambiguo: se ofrecen los dos', opc.style.display === 'block' &&
     opc.innerHTML.includes('Cáceres') && opc.innerHTML.includes('Madrid'), opc.innerHTML);
  ok('ambiguo: aún no se ha pedido ninguna provincia', !pedidas.some(u => u.includes('FiltroProvincia')));
  opc.fire('click', { target: { closest: () => ({ getAttribute: () => '1' }) } });
  await espera();
  // Madrid (28) ya se bajó en a): sale de la caché en memoria, sin otra descarga
  ok('al elegir, su provincia (Madrid, 28) sale de la caché, sin volver a pedirla',
     !pedidas.some(u => u.includes('FiltroProvincia')), pedidas.join(' | '));
  ok('...las opciones desaparecen', opc.style.display === 'none' && opc.innerHTML === '');
  ok('...y la pista nombra el municipio', dom.get('fuel-hint').textContent.includes('Arroyomolinos'));
  ok('...con el municipio de cada gasolinera en la lista', dom.get('station-list').innerHTML.includes('Madrid'));

  // c) entrada inválida: mensaje claro y nada colgado
  dom.get('lugar-q').value = '2801';
  await _test.buscarPorLugar();
  ok('CP mal escrito: lo explica', dom.get('refresh-note').textContent.includes('5 cifras'),
     dom.get('refresh-note').textContent);
  ok('...y el botón queda listo para reintentar',
     !dom.get('btn-lugar').disabled && dom.get('btn-lugar').textContent === 'Buscar');
  ok('...sin guardar lo que no vale', dom.store['cvg_lugar_v1'] === 'Arroyomolinos');

  // d) sin red: el mensaje del Ministerio, sin colgarse
  globalThis.fetch = () => Promise.reject(new Error('sin-red'));
  vaciarCacheGasolineras();
  dom.get('lugar-q').value = '28013';
  await _test.buscarPorLugar();
  ok('sin red: avisa de que el servicio no responde',
     dom.get('refresh-note').textContent.includes('no ha respondido'), dom.get('refresh-note').textContent);
  ok('...y no se queda en "Buscando..."', dom.get('btn-lugar').textContent === 'Buscar');

  // d2) el Ministerio responde con error HTTP: mismo aviso, sin intentar leer la respuesta
  let leida = false;
  globalThis.fetch = () => Promise.resolve({ ok: false, json: () => { leida = true; return Promise.resolve({}); } });
  await _test.buscarPorLugar();
  ok('error HTTP del Ministerio: avisa de que no responde',
     dom.get('refresh-note').textContent.includes('no ha respondido'), dom.get('refresh-note').textContent);
  ok('...sin leer el cuerpo de la respuesta de error', !leida);
  globalThis.fetch = () => Promise.reject(new Error('sin-red'));

  // e) sin red buscando un nombre: culpa al servicio de mapas, no al Ministerio
  dom.get('lugar-q').value = 'Valdemorillo';
  await _test.buscarPorLugar();
  ok('sin red con un nombre: avisa del servicio de mapas',
     dom.get('refresh-note').textContent.includes('mapas'), dom.get('refresh-note').textContent);
  dom.desmontar();
}

// ---------- 10. el último lugar buscado se recuerda al volver ----------
{
  const dom = montar({
    'cvg_schema': '2',
    'cvg_profiles_v1': JSON.stringify({ list:[{ id:'v1', name:'Atto 2', battery:18, maxPower:6.6,
      elecCons:22, fuelCons:5.0, chargeEff:86, chem:'lfp' }], activeId:'v1' }),
    'cvg_mode_v1':'parked', 'cvg_lugar_v1':'Valdemorillo'
  });
  const { iniciar } = await import('./js/interfaz.js?10');
  iniciar();
  ok('al arrancar, el campo trae el último lugar', dom.get('lugar-q').value === 'Valdemorillo');
  dom.desmontar();
}

// ---------- 11. climatización: cada una con sus propias medidas ----------
{
  const hoy = new Date().toISOString();
  const dom = montar({
    'cvg_schema':'3',
    'cvg_profiles_v1': JSON.stringify({ list:[{ id:'v1', name:'A', battery:18, maxPower:6.6,
      elecCons:22, fuelCons:5, chargeEff:86, chem:'lfp' }], activeId:'v1' }),
    'cvg_mode_v1':'parked',
    // sin climatización rinde 4,3 km/kWh -> 86 / 4,3 = 20 kWh/100km
    'cvg_meas_v1': JSON.stringify([
      { id:'a', date:hoy, km:215, kmElec:215, kwh:50, litres:0, R:4.3, clima:'nada', frio:false },
      { id:'b', date:hoy, km:200, kmElec:200, kwh:60, litres:0, R:200/60, clima:null, frio:null }
    ])
  });
  const { iniciar, _test } = await import('./js/interfaz.js?11');
  iniciar();
  const cons = () => parseFloat(dom.get('inp-elecConsumption').value);

  ok('arranca sin climatización y usa su medida', cons() === 20, String(cons()));
  ok('la pista dice de dónde sale', dom.get('clima-hint').textContent.includes('Con tu medida sin climatización'),
     dom.get('clima-hint').textContent);

  _test.elegirClima('calefaccion');
  ok('con calefacción y sin medidas suyas, usa la sin clasificar (86 / 3,33 = 25,8)', cons() === 25.8, String(cons()));
  ok('...y avisa de que no tiene medidas con calefacción',
     dom.get('clima-hint').textContent.includes('No tienes medidas con calefacción') &&
     dom.get('clima-hint').classList.contains('warn'), dom.get('clima-hint').textContent);
  ok('la etiqueta del veredicto lo dice', dom.get('amount-label').textContent.includes('con calefacción'),
     dom.get('amount-label').textContent);
  ok('la elección se guarda', dom.store['cvg_clima_v1'] === 'calefaccion');

  _test.elegirClima('aire');
  _test.clasificarMedida('b', 'nada');
  ok('al clasificar la última sin clasificar, con aire ya no hay datos: consumo declarado', cons() === 22, String(cons()));
  ok('...y lo dice, con el margen del 30%', dom.get('clima-hint').textContent.includes('30%'),
     dom.get('clima-hint').textContent);
  ok('la medida queda clasificada, sin inventar el frío',
     JSON.parse(dom.store['cvg_meas_v1']).find(x => x.id === 'b').clima === 'nada' &&
     JSON.parse(dom.store['cvg_meas_v1']).find(x => x.id === 'b').frio === null);

  _test.elegirClima('nada');
  ok('sin climatización usa ahora las dos medidas', dom.get('clima-hint').textContent.includes('2 medidas'),
     dom.get('clima-hint').textContent);
  _test.elegirClima('inventada');
  ok('una climatización desconocida se ignora', dom.store['cvg_clima_v1'] === 'nada');
  dom.desmontar();
}

// ---------- 12. migración al esquema 3 (adiós a ciudad/carretera/frío) ----------
{
  const dom = montar({
    'cvg_schema':'2',
    'cvg_profiles_v1': JSON.stringify({ list:[{ id:'v1', name:'A', battery:18, maxPower:6.6,
      elecCons:22, fuelCons:5, chargeEff:86, chem:'lfp' }], activeId:'v1' }),
    'cvg_meas_v1': JSON.stringify([{ id:'m1', date:new Date().toISOString(), km:250, kmElec:250,
      kwh:64, litres:0, cond:'ciudad', R:250/64 }]),
    'cvg_cold_v1':'1', 'cvg_preset_v1':'carretera', 'cvg_mode_v1':'parked'
  });
  const { iniciar } = await import('./js/interfaz.js?12');
  iniciar();
  const m = JSON.parse(dom.store['cvg_meas_v1'])[0];
  ok('la medida antigua queda sin clasificar, nunca adivinada', m.clima === null && m.frio === null, JSON.stringify(m));
  ok('...y pierde el modo de conducción, que ya no se usa', !('cond' in m));
  ok('quien tenía el frío activado pasa a calefacción', dom.store['cvg_clima_v1'] === 'calefaccion');
  ok('las claves de frío y modo de conducción desaparecen',
     dom.store['cvg_cold_v1'] === undefined && dom.store['cvg_preset_v1'] === undefined);
  ok('el esquema sube a 3', dom.store['cvg_schema'] === '3');
  ok('la medida antigua sigue contando mientras no haya otra mejor',
     dom.get('clima-hint').textContent.includes('no tienen climatización'), dom.get('clima-hint').textContent);
  dom.desmontar();
}

// ---------- 13. interfaz: pestañas, cargadores, gasolineras plegadas, tarifa ----------
{
  const chs = Array.from({ length: 5 }, (_, i) => ({ id:'c' + i, name:'Punto ' + i, power:7.4, mode:0,
    price:0.2 + i / 100, perMin:0, freeHours:0, overMin:0, note:'' }));
  const dom = montar({
    'cvg_schema':'3',
    'cvg_profiles_v1': JSON.stringify({ list:[
      { id:'v1', name:'Atto 2', battery:18, maxPower:6.6, elecCons:22, fuelCons:5, chargeEff:86, chem:'lfp' },
      { id:'v2', name:'Kuga', battery:14, maxPower:3.7, elecCons:20, fuelCons:6, chargeEff:85, chem:'nmc' }
    ], activeId:'v1' }),
    'cvg_chargers_v1': JSON.stringify(chs), 'cvg_mode_v1':'parked',
    'cvg_hist_v1': JSON.stringify([{ date:new Date().toISOString(), chargerPrice:0.25, savings:0.9, km:39, free:false }])
  });
  const { iniciar, _test } = await import('./js/interfaz.js?13');
  iniciar();

  // pestañas
  ok('arranca en Calcular', !dom.get('tab-calcular').hidden && dom.get('tab-coche').hidden && dom.get('tab-ajustes').hidden);
  _test.irA('tab-coche');
  ok('Mi coche se muestra y Calcular se oculta', !dom.get('tab-coche').hidden && dom.get('tab-calcular').hidden);
  ok('la pestaña activa se marca', dom.get('tabbtn-coche').classList.contains('active') &&
     !dom.get('tabbtn-calcular').classList.contains('active'));
  _test.irA('inventada');
  ok('una pestaña desconocida no cambia nada', !dom.get('tab-coche').hidden);
  _test.irA('tab-calcular');

  // vehículos y Mi coche
  ok('el botón de arriba lleva el nombre del vehículo', dom.get('veh-pill-nombre').textContent === 'Atto 2');
  ok('con dos vehículos aparece la lista para cambiar', !dom.get('veh-row').classList.contains('hidden') &&
     dom.get('veh-row').innerHTML.includes('Kuga'));
  ok('la ficha del vehículo muestra sus datos', dom.get('veh-summary').innerHTML.includes('Batería LFP'));
  ok('el resumen de medidas también sale en Mi coche', dom.get('r-resumen').innerHTML.includes('Todavía no has medido'));
  ok('el historial lista las recargas', dom.get('hist-list').innerHTML.includes('39 km'));

  // cargadores: «Ver los N» y la lista completa
  ok('con 5 cargadores aparece «Ver los 5»', dom.get('saved-chargers').innerHTML.includes('Ver los 5'));
  ok('«+ Guardar» va antes que los cargadores',
     dom.get('saved-chargers').innerHTML.indexOf('chip-add') < dom.get('saved-chargers').innerHTML.indexOf('data-id="c0"'));
  _test.usarCargador('c3');
  ok('usar un cargador pone su precio', dom.get('inp-chargerPrice').value === 0.23, String(dom.get('inp-chargerPrice').value));
  ok('...y lo marca', dom.get('saved-chargers').innerHTML.includes('class="chip active" data-id="c3"'));
  ok('...y ofrece editarlo', dom.get('saved-chargers').innerHTML.includes('Editar Punto 3'));
  ok('sin recargo no hay aviso', dom.get('charger-recargo').classList.contains('hidden'));

  // tarifa por energía o por tiempo
  ok('por defecto cobra por energía', dom.get('pricing-energia').classList.contains('active') &&
     dom.get('field-price-min').classList.contains('hidden'));
  dom.click('pricing-tiempo');
  ok('al elegir tiempo, aparece el precio por minuto', !dom.get('field-price-min').classList.contains('hidden') &&
     dom.get('pricing-tiempo').classList.contains('active'));
  ok('...y deja de usar el cargador guardado', !dom.get('saved-chargers').innerHTML.includes('chip active'));
  dom.click('pricing-tiempo');
  ok('volver a tocar la opción elegida no la cambia', dom.get('pricing-tiempo').classList.contains('active'));
  dom.click('pricing-energia');

  // batería, climatización y modo
  dom.get('inp-currentSoc').value = '47';
  dom.fire('inp-currentSoc', 'input');
  ok('el porcentaje de batería se ve junto a la barra', dom.get('soc-valor').textContent === '47 %',
     dom.get('soc-valor').textContent);
  ok('sin medidas, los botones de climatización lo dicen', dom.get('km-calefaccion').textContent === 'sin medidas');
  dom.click('mode-trip');
  ok('el modo explica qué cuenta', dom.get('mode-help').textContent.includes('desvío'));
  dom.click('mode-parked');

  // veredicto: el color sale de una clase, no de estilos sueltos
  ok('el veredicto lleva una sola clase de estado',
     ['v-good', 'v-bad', 'v-warn'].filter(c => dom.get('verdict').classList.contains(c)).length === 1);
  dom.desmontar();
}

// ---------- 14. gasolineras: lista plegada ----------
{
  const dom = montar({
    'cvg_schema':'3',
    'cvg_profiles_v1': JSON.stringify({ list:[{ id:'v1', name:'A', battery:18, maxPower:6.6,
      elecCons:22, fuelCons:5, chargeEff:86, chem:'lfp' }], activeId:'v1' }),
    'cvg_mode_v1':'parked'
  });
  const resp = d => Promise.resolve({ json: () => Promise.resolve(d) });
  globalThis.fetch = url => {
    url = String(url);
    if(url.includes('postalcode=28013')) return resp([{ name:'28013', lat:'40.418', lon:'-3.707' }]);
    if(url.includes('FiltroProvincia/')) return resp({ Fecha:'02/11/2026', ListaEESSPrecio: [
      { 'C.P.':'28012', 'Latitud':'40,410', 'Longitud (WGS84)':'-3,700', 'Precio Gasolina 95 E5':'1,800', 'Rótulo':'CEPSA', 'Dirección':'C/ Uno', 'Municipio':'Madrid' },
      { 'C.P.':'28014', 'Latitud':'40,420', 'Longitud (WGS84)':'-3,690', 'Precio Gasolina 95 E5':'1,700', 'Rótulo':'BP', 'Dirección':'C/ Dos', 'Municipio':'Madrid' }
    ]});
    return Promise.reject(new Error('sin-red'));
  };
  vaciarCacheGasolineras();
  const { iniciar, _test } = await import('./js/interfaz.js?14');
  iniciar();
  dom.get('lugar-q').value = '28013';
  await _test.buscarPorLugar();
  const html = dom.get('station-list').innerHTML;
  ok('plegada: la más barata (BP) se ve y la otra queda oculta',
     /class="item station" data-idx="\d"><div><div class="n">BP/.test(html) &&
     /class="item station extra" data-idx="\d"><div><div class="n">CEPSA/.test(html), html);
  ok('ofrece ver todas', html.includes('Ver las 2 gasolineras'));
  ok('arranca plegada', !dom.get('station-list').classList.contains('open'));
  dom.desmontar();
}

// ---------- 15. cargadores públicos: plegar y desplegar los resultados ----------
// Ubicación y Open Charge Map simulados: la referencia ya está guardada y
// vigente, así que solo se pide /poi/.
{
  const dom = montar({
    'cvg_schema':'3',
    'cvg_profiles_v1': JSON.stringify({ list:[{ id:'v1', name:'A', battery:18, maxPower:6.6,
      elecCons:22, fuelCons:5, chargeEff:86, chem:'lfp' }], activeId:'v1' }),
    'cvg_mode_v1':'parked',
    'cvg_ocmref_v1': JSON.stringify({ fecha: new Date().toISOString(), connectorIds:[25], usageIds:[1],
      operationalIds:[50], operators:{} })
  });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true,
    value: { geolocation: { getCurrentPosition: ok => ok({ coords: { latitude: 40.4, longitude: -3.7 } }) } } });
  const pois = Array.from({ length: 7 }, (_, i) => ({
    ID: 100 + i, UsageTypeID: 1, StatusTypeID: 50,
    AddressInfo: { Title: 'Punto ' + i, Distance: 0.5 + i * 0.3 },
    Connections: [{ ConnectionTypeID: 25, StatusTypeID: 50, PowerKW: 11, Quantity: 1 }]
  }));
  globalThis.fetch = url => String(url).includes('/poi/')
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(pois) })
    : Promise.reject(new Error('sin-red'));

  const { iniciar, _test } = await import('./js/interfaz.js?15');
  iniciar();
  await _test.buscarCargadoresCercanos();
  const lista = () => dom.get('cargadores-resultados').innerHTML;
  const tarjetas = () => (lista().match(/data-ocm-id=/g) || []).length;

  ok('salen 5 tarjetas y la cabecera con el total', tarjetas() === 5 && lista().includes('7 cargadores cercanos'),
     String(tarjetas()));
  ok('con un botón para ocultarlas', lista().includes('data-ocm-toggle="ocultar"'));

  _test.cambiarListaOcm('ocultar');
  ok('plegada: ninguna tarjeta, solo la cabecera', tarjetas() === 0 && lista().includes('7 cargadores cercanos'));
  ok('...con el botón para mostrarlas', lista().includes('data-ocm-toggle="mostrar"'));
  ok('...y sin la nota de distancias', dom.get('cargadores-note').classList.contains('hidden'));

  _test.cambiarListaOcm('mostrar');
  ok('al mostrar vuelven las 5', tarjetas() === 5 && !dom.get('cargadores-note').classList.contains('hidden'));

  _test.seleccionarOcmResultado(102);
  _test.cambiarListaOcm('ocultar');
  ok('plegada con una abierta: se queda solo esa', tarjetas() === 1 && lista().includes('data-ocm-id="102"'));
  ok('...y su potencia sigue en uso', String(dom.get('inp-chargerPower').value) === '11');

  _test.cambiarListaOcm('mostrar');
  _test.cambiarListaOcm('mas');
  ok('«Ver más» sigue funcionando: las 7', tarjetas() === 7);

  await _test.buscarCargadoresCercanos();
  ok('una búsqueda nueva sale desplegada', tarjetas() === 5);
  Object.defineProperty(globalThis, 'navigator', { value: { geolocation: null }, configurable: true, writable: true });
  dom.desmontar();
}

// ---------- resumen ----------
console.log('='.repeat(50));
if(falla){
  console.log(`FALLAN ${falla} de ${pasa+falla} comprobaciones:\n`);
  fallos.forEach(f => console.log('  x ' + f));
  process.exit(1);
} else {
  console.log(`${pasa} comprobaciones de humo correctas.`);
}
