# Carga vs Gasolina

Decide si compensa enchufar un híbrido enchufable en un punto público
o si sale más barato tirar de gasolina (o esperar a cargar en casa).
Vale para cualquier enchufable: lo que depende del modelo se pregunta o se
mide, nunca se supone.

## Estructura

```
index.html        estructura de la página (cuatro pestañas: Calcular, Mi coche,
                  Ajustes y Ayuda)
estilos.css       tema claro y oscuro
version.json      versión desplegada (dispara la autoactualización)
sw.js             modo sin conexión (red primero, copia guardada si falla)
manifest.webmanifest, icono-*.png   para instalarla como app
js/
  app.js          punto de entrada
  interfaz.js     une el DOM con el resto
  calculo.js      lógica de negocio (funciones puras, sin DOM)
  datos.js        almacenamiento local y migraciones de esquema
  gasolineras.js  API del Ministerio
  cargadores.js   puntos de carga públicos (Open Charge Map)
  util.js         formato, almacenamiento seguro, ayudas de DOM
```

No hay proceso de compilación: son módulos nativos del navegador.
Se despliega subiendo los archivos tal cual a GitHub Pages.

## Al hacer un cambio

1. Editar el módulo que toque.
2. `node pruebas.mjs` — 228 comprobaciones del cálculo, las mediciones
   (eléctricas y del consumo en híbrido), la climatización, la carga en
   casa, los descuentos, los cargadores públicos y las gasolineras.
3. `node humo.mjs` — arranca la app entera contra un DOM simulado
   (183 comprobaciones en 18 escenarios).
4. Subir **también** `version.json` con un valor nuevo, y el mismo valor
   en la constante `VERSION` de `js/app.js`. Sin eso, los móviles que
   ya tienen la app instalada seguirán viendo la versión antigua.
5. Si añades un fichero que haga falta para arrancar (un módulo nuevo en
   `js/`, por ejemplo), ponlo en `ARCHIVOS` de `sw.js`: si no, sin
   cobertura la app no abre. `pruebas.mjs` lo comprueba.
6. Si el cambio se ve en la app, añade su entrada en `CAMBIOS.md` y
   actualiza `plan-de-pruebas.md`. Si llama a un servicio externo nuevo o
   envía algo distinto, actualiza `PRIVACIDAD.md`.

## Documentos

| Documento | Para quién | Qué es |
|---|---|---|
| `README.md` | quien llega al repositorio | Qué es la app, dónde abrirla y enlaces |
| `plan-de-pruebas.md` | testers | Manual para probar la app con tu coche, sea cual sea |
| `CAMBIOS.md` | testers y usuarios | Qué cambia en cada versión y dónde se prueba |
| `PRIVACIDAD.md` | testers y usuarios | Qué se guarda en el móvil y qué sale de él |
| `hoja-de-ruta.md` | quien decide | Prioridades, fases y lo descartado, con el porqué |
| `fase-0-plan.md` | el autor | Su plan de mediciones (Atto 2) y de testers |
| `CLAUDE.md` | quien programa (y Claude Code) | Comandos, reglas del cálculo y de la arquitectura |
| `LEEME.md` | quien programa | Este resumen |

## Si cambia la forma de los datos guardados

Subir `SCHEMA` en `datos.js` y añadir la migración correspondiente en
`MIGRATIONS`. Se ejecuta sola al arrancar. Saltarse esto ya rompió una
vez los cargadores guardados: quedaron sin identificador y dejaron de
poder seleccionarse, sin ningún síntoma visible.

## Dónde está cada cosa

- **El cálculo entero** está en `simulate()` (`calculo.js`). Es la única
  fuente de verdad: la usan el veredicto y el cálculo de la hora límite.
  La alternativa es la gasolina o, si el usuario carga en casa y va a llegar
  antes de gastar la batería, meter esa misma energía en casa (`costeEnCasa()`).
- **R** (km eléctricos por kWh facturado) sustituye a las estimaciones
  de eficiencia y consumo cuando hay mediciones reales. R se calcula como
  km eléctricos totales ÷ kWh totales de las medidas, así que una recarga
  grande pesa más que una pequeña (más ruidosa). Si alguna medida no tiene
  km y kWh guardados, se usa la media simple de los R.
- **R va por climatización.** Cada medida guarda la climatización que se
  usó (calefacción, aire o nada) y si hizo frío. Al calcular, `rParaClima()`
  usa solo las medidas con la climatización elegida: las 8 últimas de los 12
  últimos meses (`MEAS_MAX`, `MEAS_MESES`). El desgaste mueve R un 0,5% al
  año, así que una medida con calefacción del invierno pasado sigue valiendo.
  Sin medidas de esa climatización se usan las antiguas sin clasificar (solo
  las de los 6 últimos meses), y si tampoco hay, el consumo declarado con su
  margen del 30%. Nunca se mezclan medidas de climatizaciones distintas.
  El frío se guarda pero todavía no separa grupos: hace falta ver con datos
  si cambia R cuando no se pone la calefacción.
- **El consumo en híbrido también se mide** (`buildFuelMeasurement()`,
  `consumoParaClima()`): con la batería en su nivel mínimo al empezar y al
  terminar, con el contador de a bordo o de depósito a depósito, y por
  climatización, igual que R. Por debajo de 3 L/100 km se rechaza: es un
  promedio con km eléctricos.
- **R depende del consumo en híbrido**, porque los litros de cada medida se
  descuentan con él. Por eso R se recalcula con el consumo de ahora
  (`medidasConConsumo()`); en `interfaz.js` todo lo que usa R pasa por
  `medidasR()`, nunca por `D.loadMeas()` directamente.
- **Descuentos en la gasolina** (`precioConDescuento()`): el mejor de la marca
  de la gasolinera tocada, nunca la suma. La media de la zona y el precio
  escrito a mano van sin descuento.
- **No hay factores estimados** de ciudad, carretera ni frío: se quitaron
  porque no tenían fuente y se aplicaban encima de R medido, contando dos
  veces lo que la medida ya incluía.
- **El margen de error de R** (`measStats()`) usa el valor crítico de la
  t de Student (tabla `T90` en `calculo.js`), no el de la normal: con
  pocas medidas la desviación estimada es muy poco fiable. Con dos medidas
  el margen sale unas cuatro veces mayor que con la normal. Con exactamente
  dos medidas el margen tiene un suelo del 15 % (`BAND_UNA_MEDIDA`, el de una
  sola medida): si dos medidas coinciden casi exactamente, la t de Student
  daría ~0 % por pura casualidad. Desde la tercera medida no hay suelo.
- **El frenado al final de la carga** (`taper()` en `calculo.js`) depende
  de la química y de la tasa C (potencia ÷ batería). A tasas bajas, como
  la carga en AC de un enchufable, apenas se nota; está contrastado con
  una única recarga real (82% → 100%, Atto 2 DM-i).
- **Nada de lógica de negocio en `interfaz.js`**: si hay que calcular
  algo nuevo, va en `calculo.js` y se prueba en `pruebas.mjs`.
- **`plan-de-pruebas.md`** es el manual para quien prueba la app con su
  propio coche. Si cambia algo que ve el usuario, o un resultado que ese
  manual da por esperado, se actualiza en el mismo cambio.
