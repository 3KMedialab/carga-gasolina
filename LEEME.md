# Carga vs Gasolina

Decide si compensa enchufar un híbrido enchufable en un punto público
o si sale más barato tirar de gasolina.

## Estructura

```
index.html        estructura de la página
estilos.css       tema claro y oscuro
version.json      versión desplegada (dispara la autoactualización)
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
2. `node pruebas.mjs` — 190 comprobaciones del cálculo, las mediciones,
   la climatización, los cargadores públicos y las gasolineras.
3. `node humo.mjs` — arranca la app entera contra un DOM simulado
   (145 comprobaciones en 16 escenarios).
4. Subir **también** `version.json` con un valor nuevo, y el mismo valor
   en la constante `VERSION` de `js/app.js`. Sin eso, los móviles que
   ya tienen la app instalada seguirán viendo la versión antigua.

## Si cambia la forma de los datos guardados

Subir `SCHEMA` en `datos.js` y añadir la migración correspondiente en
`MIGRATIONS`. Se ejecuta sola al arrancar. Saltarse esto ya rompió una
vez los cargadores guardados: quedaron sin identificador y dejaron de
poder seleccionarse, sin ningún síntoma visible.

## Dónde está cada cosa

- **El cálculo entero** está en `simulate()` (`calculo.js`). Es la única
  fuente de verdad: la usan el veredicto y el cálculo de la hora límite.
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
