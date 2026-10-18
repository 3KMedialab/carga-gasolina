# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

"Carga vs Gasolina": PWA estática (en español) que decide si compensa enchufar un híbrido enchufable en un punto público o tirar de gasolina. Sin backend, sin proceso de compilación, sin `package.json`: módulos ES nativos del navegador, desplegados tal cual en GitHub Pages. Todo el texto de UI, comentarios y docs está en español; mantenlo así.

## Comandos

Requisito: Node con soporte de módulos ES (`.mjs`, `node:fs`). No hay `package.json`, ni dependencias, ni `npm install`, ni linter, ni paso de compilación. Ejecutar siempre desde la raíz del repo (`dom-falso.mjs` localiza `index.html` por ruta relativa al propio fichero, pero conviene no depender de ello).

```sh
node pruebas.mjs   # lógica pura: calculo.js y cargadores.js, sin DOM
node humo.mjs      # arranca interfaz.js entera contra un DOM simulado (dom-falso.mjs)
```

### Qué cubre cada uno

- `pruebas.mjs` está dividido en secciones con `seccion('...')`: invariantes del cálculo, límites físicos, química/curva de carga, recarga real de referencia (Atto 2 DM-i), modos de conducción y frío, recargo por tiempo, tarifa por minuto, mediciones reales y cargadores públicos (OCM). No toca la red ni el DOM.
- `humo.mjs` son 8 escenarios numerados (app vacía, app con datos, carga gratuita, migración de cargadores antiguos, mediciones, búsqueda de cargadores sin geolocalización, unidad del tiempo de aparcado, exportar/importar copia). Comprueba que la app arranca y reacciona, no los números del cálculo.

### Salida y código de retorno

Ambos imprimen las secciones y un resumen final; si hay fallos listan cada uno como `x nombre -> detalle` y terminan con `process.exit(1)`; si todo pasa, terminan con código 0 y `N comprobaciones correctas.` / `N comprobaciones de humo correctas.`. Sirve para encadenarlos: `node pruebas.mjs && node humo.mjs`.

### Ejecutar un solo caso

No hay filtro por línea de comandos ni runner (no se lee `process.argv`). Para aislar uno, comenta temporalmente el resto de bloques/secciones en el propio fichero, o copia el bloque a un script temporal que importe los mismos módulos; no dejes los bloques comentados al terminar. Al añadir una comprobación nueva usa `ok(nombre, condición, detalle)` o `casi(nombre, a, b, tol)` (comparación numérica con tolerancia, por defecto 1e-9) dentro de la sección que corresponda.

### Ver la app en el navegador

Los módulos ES no cargan desde `file://`; sirve la carpeta con cualquier servidor estático, por ejemplo `python -m http.server 8000` y abre `http://localhost:8000`. Las llamadas a la API del Ministerio y a Open Charge Map van directas desde el navegador, así que necesitan red. Tras cambiar `VERSION`, `app.js` hace una recarga con `?v=...`: es normal.

### Antes de dar un cambio por terminado

Tener `pruebas.mjs` y `humo.mjs` en verde, y el paso de versión descrito abajo si el cambio se va a desplegar. No hay despliegue por comando: se suben los ficheros a GitHub Pages (git push).

## Flujo obligatorio al cambiar código

1. Editar el módulo que toque, y correr `pruebas.mjs` y `humo.mjs`.
2. Cada despliegue necesita una versión nueva: cambiar `version.json` **y** la constante `VERSION` de `js/app.js` al mismo valor (formato `AAAA-MM-DD-N`). `app.js` compara su `VERSION` con `version.json` y recarga con `?v=` si difieren; sin esto los móviles con la app instalada siguen en la versión vieja.
3. Si cambia la forma de lo guardado en localStorage: subir `SCHEMA` en `js/datos.js` y añadir su función en `MIGRATIONS` (se ejecuta sola en el arranque). Saltárselo ya dejó cargadores sin `id` y sin poder seleccionarse, sin síntoma visible.
4. Si cambia algo visible para el usuario o un resultado que `plan-de-pruebas.md` da por esperado, actualizar ese manual en el mismo cambio.

## Arquitectura

Capas de `js/` (dependencias hacia abajo):

- `app.js` — punto de entrada: autoactualización + `iniciar()`.
- `interfaz.js` (~1000 líneas) — une DOM y módulos. **Nada de lógica de negocio aquí**: lo nuevo que haya que calcular va en `calculo.js` y se prueba en `pruebas.mjs`. Exporta `_test` para las pruebas.
- `calculo.js` — funciones puras, sin DOM ni almacenamiento.
- `datos.js` — único punto de acceso a localStorage (claves `cvg_*`, algunas por vehículo: `cvg_hist_<id>`, `cvg_calib_<id>`, `cvg_meas_<id>`), migraciones y copia de seguridad (`exportAll`/`importAll` vuelcan por prefijo `cvg_`, así que claves nuevas quedan cubiertas solas si usan ese prefijo).
- `gasolineras.js` (API del Ministerio, solo España) y `cargadores.js` (Open Charge Map) — aislados de la UI: devuelven datos o lanzan error con código.
- `util.js` — formato, acceso seguro a localStorage (`ls*`), caché de `$()` para el DOM (`resetDom()` la limpia).

### Reglas del cálculo (`calculo.js`)

- `simulate()` es la **única fuente de verdad** de una sesión de carga; el veredicto y `findLimitHours()` (hora límite antes de que el recargo se coma el ahorro) la reutilizan. Modos: `parked` (aparcado, tiempo fijo) y `trip` (parada dedicada, con desvío).
- **R** = km eléctricos por kWh facturado, obtenido de mediciones reales (`buildMeasurement`, `measStats`); sustituye a las estimaciones de eficiencia y consumo. Solo cuentan las 8 últimas medidas de los últimos 6 meses (`MEAS_MAX`, `MEAS_MESES`), porque R varía ±30% por estación y solo ~0,5%/año por desgaste.
- El margen de error de R usa la t de Student al 90% (`T90`), no la normal; con exactamente 2 medidas tiene suelo del 15% (`BAND_UNA_MEDIDA`) para que dos medidas casualmente iguales no den ~0%.
- `taper()` (frenado al final de la carga) depende de la química de batería y de la tasa C; en AC lento apenas se nota. Es un punto de partida contrastado con una sola recarga real, no una curva medida.
- Los factores de ciudad/carretera/frío (`PRESET_FACTORS`) son estimaciones, no datos medidos.

### Decisiones de diseño a respetar

- **Si para construir algo hay que inventarse un dato, no se construye** (regla de `hoja-de-ruta.md`). Por eso `cargadores.js` nunca calcula precio ni recargo a partir del texto libre de OCM; solo resalta texto (`pareceRecargoPorTiempo`). Tampoco se hardcodean IDs de OCM: se resuelven contra `/referencedata`.
- La app debe admitir incertidumbre en vez de aparentar precisión (ver Fase 1 de la hoja de ruta).
- Descartado explícitamente: framework/compilación (rompería el despliegue desde el móvil), notificaciones, meteorología automática, base de datos de vehículos.

## Pruebas

- `pruebas.mjs` importa módulos de `js/` directamente y usa un coche de referencia (`ATTO`, BYD Atto 2 DM-i).
- `humo.mjs` usa `dom-falso.mjs`, que **lee los `id=` reales de `index.html`**: si se borra o renombra un elemento del HTML, el humo falla. Importa `interfaz.js` con un query distinto por escenario (`?1`, `?2`…) para obtener módulos nuevos; sigue ese patrón al añadir escenarios.
- Estos scripts no se despliegan.

## Documentos del proyecto

`hoja-de-ruta.md` (prioridades y fases; orden: números erróneos > reducir incertidumbre > dinero real > peticiones concretas), `fase-0-plan.md` (recogida de datos con testers), `plan-de-pruebas.md` (manual para quien prueba con su coche), `LEEME.md` (resumen de flujo).
