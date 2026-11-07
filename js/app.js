// app.js — punto de entrada. Comprueba si hay versión nueva y arranca la interfaz.

import { iniciar } from './interfaz.js';

const VERSION = '2026-11-07-6';

(function comprobarActualizacion(){
  try{
    if(sessionStorage.getItem('cvg_update_check') === VERSION) return;
    fetch('./version.json?_=' + Date.now(), { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        sessionStorage.setItem('cvg_update_check', VERSION);
        if(d && d.v && d.v !== VERSION){
          location.replace(location.pathname + '?v=' + encodeURIComponent(d.v));
        }
      })
      .catch(() => {});
  }catch(e){}
})();

iniciar();

// Para abrir la app sin cobertura (ver sw.js). Si el navegador no lo admite
// o falla, la app funciona igual que antes, solo que necesita red para abrir.
try{
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}catch(e){}
