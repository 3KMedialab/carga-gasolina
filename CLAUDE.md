# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

"Carga vs Gasolina": PWA estática (en español) que decide si compensa enchufar un híbrido enchufable en un punto público o tirar de gasolina (o, si el usuario carga en casa, esperar a llegar). Sin backend, sin proceso de compilación, sin `package.json`: módulos ES nativos del navegador, desplegados tal cual en GitHub Pages. Todo el texto de UI, comentarios y docs está en español; mantenlo así.

## Vale para cualquier híbrido enchufable (crítico)

La app se desarrolla con un BYD Atto 2 DM-i, pero tiene que servir para **cualquier PHEV**. Antes de añadir o cambiar algo, comprueba que no da por supuesto el comportamiento de un modelo concreto.

- **Lo que cambia según el coche es un dato del perfil o una medida, nunca una constante.** Ejemplo: la química de batería (`chem`) se pregunta y el código la usa sin saber qué modelo es. Si un comportamiento depende del modelo y no se puede preguntar ni medir, no se construye (es inventar un dato). El Atto 2 (`ATTO` en `pruebas.mjs`) es solo el coche de referencia de las pruebas.
- **Conceptos válidos para todos:** el modo que gasta batería (la energía sale de la red) y el modo que mantiene la carga (con la batería en el nivel que el coche conserva sin enchufe, toda la energía sale del combustible). Existen en todos los PHEV y la homologación WLTP los define así. «Consumo en híbrido» (`fuelCons`) es **el consumo en el modo que mantiene la carga**. No vale la cifra combinada ponderada que se anuncia (~1–2 L/100 km), ni el promedio acumulado del ordenador de a bordo: los dos mezclan km hechos con electricidad de la red. `fuelCons` entra en el veredicto y además en el cálculo de R (`buildMeasurement`), así que un error ahí falsea las dos cosas.
- **Lo que varía entre modelos y no se puede dar por supuesto:**
  - Arquitectura: serie (BYD DM-i: el motor sobre todo genera electricidad y a velocidad media o alta puede mover las ruedas directamente), paralelo (VW eHybrid, Hyundai/Kia, Mercedes, BMW) o reparto de potencia (Toyota, Ford).
  - Nivel mínimo que muestra la batería: 0% en muchos coches, el «SOC objetivo» que elige el conductor en el DM-i (del 25% al 70%).
  - Modos para mantener la carga o para que el motor cargue la batería, y si el coche genera electricidad estando parado.
  - Si el motor arranca aunque haya batería (frío, calefacción, velocidad alta, aceleración fuerte).
  - Si el contador de consumo se puede poner a cero.
  - Gasolina o diésel.
- **Procedimientos y textos genéricos.** Los textos de la interfaz, `plan-de-pruebas.md` y las mediciones describen pasos que funcionan en cualquier coche. Por ejemplo, «el mismo nivel de batería al empezar y al terminar, el más bajo que el coche mantiene» en vez de «25%», y «de depósito a depósito» como método fiable para todos. Un detalle de un modelo solo puede ir como ejemplo («en BYD DM-i, …»), nunca como regla.

## Comandos

Requisito: Node con soporte de módulos ES (`.mjs`, `node:fs`). No hay `package.json`, ni dependencias, ni `npm install`, ni linter, ni paso de compilación. Ejecutar siempre desde la raíz del repo (`dom-falso.mjs` localiza `index.html` por ruta relativa al propio fichero, pero conviene no depender de ello).

```sh
node pruebas.mjs   # lógica pura (calculo.js, cargadores.js, gasolineras.js) y sw.js/version, sin DOM ni red
node humo.mjs      # arranca interfaz.js entera contra un DOM simulado (dom-falso.mjs)
```

### Qué cubre cada uno

- `pruebas.mjs` está dividido en secciones con `seccion('...')`: invariantes del cálculo, límites físicos, química/curva de carga, recarga real de referencia (Atto 2 DM-i), climatización (R medido por grupo), recargo por tiempo, tarifa por minuto, mediciones reales, consumo en híbrido medido, carga en casa, descuentos en la gasolina, cargadores públicos (OCM), gasolineras por código postal o municipio (`gasolineras.js`) y modo sin conexión (lista de `sw.js`, manifest, versión y enlace al manual). No toca la red ni el DOM.
- `humo.mjs` son 18 escenarios numerados (app vacía, app con datos, carga gratuita, migración de cargadores antiguos, mediciones, búsqueda de cargadores sin geolocalización, unidad del tiempo de aparcado, exportar/importar copia, gasolineras por CP/municipio con `fetch` simulado, último lugar recordado, climatización con sus propias medidas, migración al esquema 3, interfaz —pestañas, cargadores, tarifa, vehículos—, lista de gasolineras plegada, resultados de cargadores públicos plegables, consumo en híbrido medido, descuentos en la gasolina y carga en casa). Comprueba que la app arranca y reacciona, no los números del cálculo. El DOM simulado no lee atributos (`hidden`, `aria-*`) ni hace `querySelectorAll`: para probar un botón dentro de una lista, exporta la acción en `_test` (como `irA`, `elegirClima`, `usarCargador`).

### Salida y código de retorno

Ambos imprimen las secciones y un resumen final; si hay fallos listan cada uno como `x nombre -> detalle` y terminan con `process.exit(1)`; si todo pasa, terminan con código 0 y `N comprobaciones correctas.` / `N comprobaciones de humo correctas.`. Sirve para encadenarlos: `node pruebas.mjs && node humo.mjs`.

### Ejecutar un solo caso

No hay filtro por línea de comandos ni runner (no se lee `process.argv`). Para aislar uno, comenta temporalmente el resto de bloques/secciones en el propio fichero, o copia el bloque a un script temporal que importe los mismos módulos; no dejes los bloques comentados al terminar. Al añadir una comprobación nueva usa `ok(nombre, condición, detalle)` o `casi(nombre, a, b, tol)` (comparación numérica con tolerancia, por defecto 1e-9) dentro de la sección que corresponda.

### Ver la app en el navegador

Los módulos ES no cargan desde `file://`; sirve la carpeta con cualquier servidor estático, por ejemplo `python -m http.server 8000` y abre `http://localhost:8000`. Las llamadas a la API del Ministerio, a Nominatim y a Open Charge Map van directas desde el navegador, así que necesitan red. Tras cambiar `VERSION`, `app.js` hace una recarga con `?v=...`: es normal.

### Antes de dar un cambio por terminado

Tener `pruebas.mjs` y `humo.mjs` en verde, y el paso de versión descrito abajo si el cambio se va a desplegar. No hay despliegue por comando: se suben los ficheros a GitHub Pages (git push).

## Flujo obligatorio al cambiar código

1. Editar el módulo que toque, y correr `pruebas.mjs` y `humo.mjs`.
2. Cada despliegue necesita una versión nueva: cambiar `version.json` **y** la constante `VERSION` de `js/app.js` al mismo valor (formato `AAAA-MM-DD-N`). `app.js` compara su `VERSION` con `version.json` y recarga con `?v=` si difieren; sin esto los móviles con la app instalada siguen en la versión vieja.
3. Si cambia la forma de lo guardado en localStorage: subir `SCHEMA` en `js/datos.js` y añadir su función en `MIGRATIONS` (se ejecuta sola en el arranque). Saltárselo ya dejó cargadores sin `id` y sin poder seleccionarse, sin síntoma visible.
4. Si cambia algo visible para el usuario o un resultado que `plan-de-pruebas.md` da por esperado, actualizar ese manual en el mismo cambio. Lo mismo con `MANUAL.md` (cómo se usa) y, si cambia uno de sus pasos, la guía rápida de Ayuda (`#t-guia` en `index.html`). Los textos de los manuales usan las mismas etiquetas que la pantalla.
5. Cada versión con algo visible para el usuario lleva su entrada en `CAMBIOS.md` (arriba del todo, en lenguaje de usuario, con el apartado del plan de pruebas que la cubre). Si añade una llamada externa o envía un dato nuevo, también `PRIVACIDAD.md`.

## Arquitectura

Capas de `js/` (dependencias hacia abajo):

- `app.js` — punto de entrada: autoactualización + `iniciar(VERSION)` + registro de `sw.js`. La versión se pasa como argumento (no se importa `app.js` desde `interfaz.js`, que sería circular) y se enseña al final de Ayuda (`#app-version`); `humo.mjs` lo comprueba en el escenario 1.
- `interfaz.js` (~1700 líneas) — une DOM y módulos. **Nada de lógica de negocio aquí**: lo nuevo que haya que calcular va en `calculo.js` y se prueba en `pruebas.mjs`. Exporta `_test` para las pruebas.
- `calculo.js` — funciones puras, sin DOM ni almacenamiento.
- `datos.js` — único punto de acceso a localStorage (claves `cvg_*`, algunas por vehículo: `cvg_hist_<id>`, `cvg_calib_<id>`, `cvg_meas_<id>`, `cvg_fuel_<id>`; la climatización elegida en `cvg_clima_v1`; los descuentos en `cvg_descuentos_v1` y la gasolinera tocada en `cvg_estacion_v1`, la carga en casa en `cvg_casa_v1` y `cvg_vscasa_v1`, comunes a todos los vehículos), migraciones (esquema actual: 3) y copia de seguridad (`exportAll`/`importAll` vuelcan por prefijo `cvg_`, así que claves nuevas quedan cubiertas solas si usan ese prefijo). Una clave nueva que empieza vacía no necesita migración; cambiar la forma de una que ya existe, sí.
- `gasolineras.js` (API del Ministerio, solo España) y `cargadores.js` (Open Charge Map) — aislados de la UI: devuelven datos o lanzan error con código. La búsqueda por CP o municipio sitúa el lugar con Nominatim (provincia por código ISO 3166-2; la de un CP, por sus 2 primeras cifras) y reutiliza `pickNearby()` desde ese punto; un CP sin gasolineras propias no es error. Nominatim solo se llama al pulsar Buscar: su política prohíbe autocompletar. `gasolineras.js` guarda en memoria cada provincia descargada 30 min y la provincia de la última posición GPS (si no te mueves más de 2 km); `humo.mjs` llama a `vaciarCache()` en los escenarios con `fetch` simulado, porque el módulo se comparte entre escenarios.
- `util.js` — formato, acceso seguro a localStorage (`ls*`), caché de `$()` para el DOM (`resetDom()` la limpia).

**Servicios externos y privacidad.** Solo se llama a Nominatim, al Ministerio y a Open Charge Map, y solo al pulsar un botón; al Ministerio nunca se le envía la posición (solo el código de provincia). `PRIVACIDAD.md` lo cuenta al usuario tabla en mano: cualquier llamada externa nueva, o un dato nuevo enviado, se añade ahí en el mismo cambio.

### Modo sin conexión (`sw.js`, `manifest.webmanifest`, `icono-*.png`)

- `sw.js` sirve primero la red y la copia guardada solo si la red falla o tarda más de 4 s (`ESPERA_RED_MS`). Por eso no lleva número de versión ni interfiere con la autoactualización: con red siempre llega lo último. `CACHE` solo se cambia si cambia la estrategia.
- Solo intercepta el mismo origen; nunca `version.json` ni las APIs (Ministerio, OCM, Nominatim). La página se guarda como `index.html`, venga con `?v=` o sin él.
- **Un módulo nuevo en `js/` (o cualquier fichero que haga falta para arrancar) va en `ARCHIVOS` de `sw.js`**; si no, sin red la app no arranca. `pruebas.mjs` lo comprueba, igual que que coincidan `VERSION` y `version.json`.
- Los iconos del manifest son el mismo rayo que el `apple-touch-icon` en línea de `index.html`.
- `humo.mjs` no ejecuta `sw.js` (no hay service worker en Node). Para probarlo de verdad: servidor local, Chrome, abrir una vez, apagar el servidor y recargar.

### Interfaz (`index.html`, `estilos.css`)

- Cuatro pestañas (`tab-calcular`, `tab-coche`, `tab-ajustes`, `tab-ayuda`; `irA()` cambia entre ellas). La barra de pestañas va fija abajo. Ajustes es la configuración de la app que no depende del vehículo (carga en casa y descuentos en la gasolina). Calcular lleva el veredicto fijo arriba (`#verdict`, se compacta al bajar) y las secciones en el orden de la decisión: dónde cargas, gasolina, ¿cargarás en casa antes? (`#sec-casa`, solo con la casa configurada), batería, climatización, la recarga.
- Las fichas (`overlay`, `meas-overlay`, `fuel-overlay`, `ch-overlay`, `chs-overlay`) suben desde abajo; `openOverlay(id, on)` pone o quita `.open`. La del vehículo no se cierra tocando fuera: la primera vez es obligatoria.
- El color del veredicto sale de una clase (`v-good`, `v-bad`, `v-warn`), no de estilos en línea. El resto de colores de estado, igual: `tono(el, 'good'|'bad'|'warn'|'muted'|null)` de `util.js` pone `.c-*`, y en HTML generado se escribe `class="c-warn"`. Nunca `style="color:..."`: el cambio claro/oscuro lo resuelve solo el CSS. Botones de grupo (segmentados, chips): `pulsado(el, on)` pone `.active` y `aria-pressed`.
- Colores solo desde las variables de `:root` (tema claro y oscuro con `prefers-color-scheme`). Fuente del sistema a propósito: la app funciona sin red.
- Muchos `id` los leen `interfaz.js` y `humo.mjs`: si renombras uno, cambia los tres sitios. Si el JS busca un `id` que no está en `index.html`, el humo **no falla**: imprime «AVISO: el JS busca elementos que no existen en index.html». Míralo en la salida.

### Reglas del cálculo (`calculo.js`)

- `simulate()` es la **única fuente de verdad** de una sesión de carga; el veredicto y `findLimitHours()` (hora límite antes de que el recargo se coma el ahorro) la reutilizan. Modos: `parked` (aparcado, tiempo fijo) y `trip` (parada dedicada, con desvío).
- **La alternativa puede ser la gasolina o cargar en casa.** Con `cfg.casa` ({precio, potencia}, de `cvg_casa_v1`, y solo si el usuario responde que va a cargar en casa antes de gastar la batería: `cvg_vscasa_v1`), `simulate()` compara con lo que costaría meter **la misma energía** en casa (`costeEnCasa`: con la eficiencia a la potencia de casa, limitada por la del coche). Devuelve `vs`, `homeCost` y `altCost`; usa siempre `altCost`, no `equivFuel`, para la alternativa. El desvío se sigue valorando en gasolina. El historial guarda `vs` en cada recarga. No se reparte el caso mixto (llegar a casa gastando más batería de la que hay): necesitaría el nivel mínimo real de la batería, que no está en el perfil.
- **R** = km eléctricos por kWh facturado, obtenido de mediciones reales (`buildMeasurement`, `measStats`); sustituye a las estimaciones de eficiencia y consumo.
- **R va por climatización** (`CLIMAS`: `calefaccion`, `aire`, `nada`). Cada medida guarda `clima` y `frio`; `rParaClima()` usa solo las medidas con la climatización elegida (las 8 últimas de los 12 últimos meses: `MEAS_MAX`, `MEAS_MESES`). Si no hay ninguna, usa las sin clasificar (anteriores al esquema 3, ventana de 6 meses: `MEAS_MESES_SIN_CLASIFICAR`); si tampoco, el consumo declarado con banda del 30%. **Nunca se toman prestadas medidas de otra climatización.** `frio` se guarda pero aún no separa grupos: solo se dividirá si los datos muestran que el frío sin calefacción cambia R de forma apreciable.
- **El consumo en híbrido también se mide** (`buildFuelMeasurement`, `consumoParaClima`, clave `cvg_fuel_<id>`), con las mismas reglas que R: por climatización, sin préstamos entre grupos, misma ventana y misma banda (`estadistica()` es común a los dos). Dos métodos: contador de a bordo puesto a cero o de depósito a depósito. Por debajo de `CONSUMO_MIN` (3 L/100 km) se rechaza: es un promedio con km eléctricos. Pide el % de batería al empezar y al terminar (`socIni`, `socFin`) y rechaza si difieren más de `SOC_TOLERANCIA` (1 punto, la resolución del indicador): mientras el motor funciona la batería oscila alrededor de su nivel (en un DM-i, del 25 al ~35%), y esa energía guardada falsearía el consumo. **No se corrige la diferencia con una fórmula**: haría falta suponer cuánta gasolina cuesta cada kWh que el motor mete en la batería, que depende de cada coche. Las medidas anteriores a la 2026-11-08-3 no tienen esos dos campos y siguen valiendo. Sin medidas de esa climatización, se usa el declarado del perfil.
- **Descuentos en la gasolina** (`buildDescuento`, `precioConDescuento`): los escribe el usuario (cantidad en c€/L o %, y marcas, que casan con el rótulo del Ministerio por palabras enteras). Se aplica el mejor de la marca, nunca la suma. Solo al precio de la gasolinera tocada en la lista (`precioGasolina()` en `interfaz.js` lo comprueba comparando el campo con `cvg_estacion_v1`); la media de la zona y el precio escrito a mano van tal cual. La «más barata» se calcula con lo que paga el usuario. Sin topes ni promociones: no hay forma de saberlos sin inventar.
- **R depende del consumo en híbrido**: cada medida de R descuenta sus litros con ese consumo. Por eso el R guardado no se usa tal cual: `medidasConConsumo()` lo rehace con el consumo de ahora (el de la climatización de cada medida), y en `interfaz.js` todo lo que usa R pasa por `medidasR()`, nunca por `D.loadMeas()` directamente. Una medida que con el consumo nuevo deja de ser válida queda con `R = null` e `invalida: true`, y no cuenta.
- El margen de error de R usa la t de Student al 90% (`T90`), no la normal; con exactamente 2 medidas tiene suelo del 15% (`BAND_UNA_MEDIDA`) para que dos medidas casualmente iguales no den ~0%.
- `taper()` (frenado al final de la carga) depende de la química de batería y de la tasa C; en AC lento apenas se nota. Es un punto de partida contrastado con una sola recarga real, no una curva medida.
- No hay factores de ciudad/carretera/frío: se eliminaron en el esquema 3 porque eran porcentajes estimados sin fuente y además se aplicaban encima de R medido, contando dos veces lo que la medida ya incluía. No los reintroduzcas sin datos.

### Decisiones de diseño a respetar

- **Si para construir algo hay que inventarse un dato, no se construye** (regla de `hoja-de-ruta.md`). Por eso `cargadores.js` nunca calcula precio ni recargo a partir del texto libre de OCM; solo resalta texto (`pareceRecargoPorTiempo`). Tampoco se hardcodean IDs de OCM: se resuelven contra `/referencedata`.
- La app debe admitir incertidumbre en vez de aparentar precisión (ver Fase 1 de la hoja de ruta).
- Descartado explícitamente: framework/compilación (rompería el despliegue desde el móvil), notificaciones, meteorología automática, base de datos de vehículos.

## Pruebas

- `pruebas.mjs` importa módulos de `js/` directamente y usa un coche de referencia (`ATTO`, BYD Atto 2 DM-i).
- `humo.mjs` usa `dom-falso.mjs`, que **lee los `id=` reales de `index.html`** (y los `value=` de inputs; los `select` arrancan con valor vacío, así que el JS toma su primera opción con `|| 'valor'`). Si un `id` del JS no existe en el HTML, lo crea igualmente y avisa con «AVISO» al terminar el escenario: el escenario no falla, así que revisa la salida. Importa `interfaz.js` con un query distinto por escenario (`?1`, `?2`…) para obtener módulos nuevos; sigue ese patrón al añadir escenarios.
- Estos scripts no se despliegan.

## Documentos del proyecto

- `MANUAL.md` — manual de usuario completo, por tareas y con las etiquetas de la pantalla. La guía rápida de Ayuda lo resume y enlaza a él en GitHub (`#btn-manual`, con `target="_blank"`: un enlace al propio dominio se abriría dentro de la app instalada, sin forma de volver). `pruebas.mjs` comprueba que el enlace apunta a un fichero que existe.
- `README.md` — la portada del repositorio en GitHub: qué es la app, dónde abrirla y enlaces al resto. Para quien llega de fuera; sin detalle técnico.
- `hoja-de-ruta.md` — prioridades y fases; orden: números erróneos > reducir incertidumbre > dinero real > peticiones concretas. Lo construido se marca con su fecha dentro de su fase.
- `fase-0-plan.md` — el plan de recogida de datos del autor (sus mediciones con el Atto 2 y los testers). Es el único documento que puede ser específico de un coche.
- `plan-de-pruebas.md` — manual para quien prueba con su coche (cualquier PHEV). Es lo que se envía a los testers.
- `CAMBIOS.md` — qué cambia en cada versión, para el usuario; remite al apartado del plan de pruebas.
- `PRIVACIDAD.md` — qué se guarda y qué sale del móvil, servicio a servicio.
- `LEEME.md` — resumen para desarrollar: estructura, flujo y dónde está cada cosa.
