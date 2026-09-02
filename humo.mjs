// humo.mjs — arranca la app completa contra un DOM simulado.
// Comprueba lo que ninguna prueba de sintaxis detecta: que la app realmente funciona.
// Ejecutar con:  node humo.mjs

import { JSDOMLite, montar } from './dom-falso.mjs';

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
  ok('el esquema queda marcado', dom.store['cvg_schema'] === '2');
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
     dom.get('saved-chargers').innerHTML.includes('\u23f1\ufe0f'));

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

  const antes = dom.get('pk-km').textContent;
  // tres medidas que reflejan un consumo peor del declarado
  [[250,74],[210,63],[300,88]].forEach(([km,kwh]) => {
    dom.get('meas-km1').value = '0';
    dom.get('meas-km2').value = String(km);
    dom.get('meas-kwh').value = String(kwh);
    dom.get('meas-lit').value = '0';
    dom.click('meas-save');
  });
  const m = JSON.parse(dom.store['cvg_meas_v1']);
  ok('se guardan las tres medidas', m.length === 3, String(m.length));
  ok('las medidas cambian el resultado', dom.get('pk-km').textContent !== antes,
     antes + ' -> ' + dom.get('pk-km').textContent);
  ok('el consumo pasa a ser el medido',
     Math.abs(parseFloat(dom.get('inp-elecConsumption').value) - 22) > 1,
     dom.get('inp-elecConsumption').value);
  ok('el margen de error baja', dom.get('meas-summary').innerHTML.includes('Margen'));
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
