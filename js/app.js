// app.js — punto de entrada. Comprueba si hay versión nueva y arranca la interfaz.

import { iniciar } from './interfaz.js';

const VERSION = '2026-08-29-39';

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
