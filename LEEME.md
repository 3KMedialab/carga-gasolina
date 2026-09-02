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
  util.js         formato, almacenamiento seguro, ayudas de DOM
```

No hay proceso de compilación: son módulos nativos del navegador.
Se despliega subiendo los archivos tal cual a GitHub Pages.

## Al hacer un cambio

1. Editar el módulo que toque.
2. `node pruebas.mjs` — 44 comprobaciones del cálculo.
3. `node humo.mjs` — arranca la app entera contra un DOM simulado.
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
  de eficiencia y consumo cuando hay mediciones reales.
- **Nada de lógica de negocio en `interfaz.js`**: si hay que calcular
  algo nuevo, va en `calculo.js` y se prueba en `pruebas.mjs`.
