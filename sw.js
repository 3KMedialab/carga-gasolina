// sw.js — permite abrir la app sin cobertura (un garaje, un parking subterráneo).
//
// Estrategia: primero la red, la copia guardada solo si la red falla o tarda.
// Así, con conexión, siempre se carga lo último publicado y la
// autoactualización de app.js (version.json + recarga con ?v=) sigue
// funcionando igual que antes; la copia guardada solo se usa sin red.
// Por eso aquí no hay número de versión que mantener: cada respuesta buena
// de la red sustituye a la guardada.
//
// Solo se tocan los ficheros de la propia app (mismo origen). Las llamadas al
// Ministerio, Open Charge Map y Nominatim van directas: sin red fallan y la
// interfaz ya lo explica.

const CACHE = 'cvg-app-v1';   // cambiarlo solo si cambia la estrategia, no en cada versión

// Todo lo que hace falta para arrancar. Si se añade un módulo a js/, va aquí
// (pruebas.mjs lo comprueba).
// La página va como index.html: es la clave con la que se guarda (ver fetch).
const ARCHIVOS = [
  'index.html',
  'estilos.css',
  'manifest.webmanifest',
  'icono-192.png',
  'icono-512.png',
  'js/app.js',
  'js/interfaz.js',
  'js/calculo.js',
  'js/datos.js',
  'js/util.js',
  'js/gasolineras.js',
  'js/cargadores.js'
];

// Con cobertura muy débil la red puede no fallar nunca, solo tardar:
// pasado este tiempo se usa la copia guardada.
const ESPERA_RED_MS = 4000;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ARCHIVOS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function conLimite(promesa, ms){
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('lenta')), ms);
    promesa.then(r => { clearTimeout(t); resolve(r); }, e => { clearTimeout(t); reject(e); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;
  // version.json es justo la pregunta "¿hay algo nuevo en la red?": nunca de la caché
  if(url.pathname.endsWith('/version.json')) return;

  // la página se guarda siempre como index.html, venga con ?v=... o sin nada
  const navegacion = req.mode === 'navigate';
  const clave = navegacion ? new URL('index.html', self.registration.scope).href : req;

  // 'no-cache': pregunta siempre al servidor (un 304 cuesta poco) en vez de
  // fiarse de la caché HTTP del navegador. Una petición de navegación no se
  // puede copiar con opciones nuevas, por eso se pide por su URL.
  const red = fetch(navegacion ? req.url : req, { cache: 'no-cache' }).then(async r => {
    if(r.ok){
      const copia = r.clone();
      const c = await caches.open(CACHE);
      await c.put(clave, copia);
    }
    return r;
  });
  // aunque se sirva la copia por tardar, la respuesta que llegue luego se guarda
  e.waitUntil(red.catch(() => {}));

  e.respondWith((async () => {
    try{
      return await conLimite(red, ESPERA_RED_MS);
    }catch(err){
      const guardada = await caches.match(clave, { ignoreSearch: true });
      if(guardada) return guardada;
      return red;   // nada guardado: que siga esperando a la red (o falle como sin service worker)
    }
  })());
});
