# Carga vs Gasolina

**¿Compensa enchufar el híbrido aquí, o sale más barato tirar de gasolina?**

App web para conductores de híbridos enchufables (PHEV). Estando delante de un punto
de carga, le dices el precio, la potencia y cuánta batería te queda, y te responde si
compensa cargar y cuánto ahorras o pierdes. Si cargas en casa, compara también con
esperar a llegar.

**Abrir la app:** <https://3kmedialab.github.io/carga-gasolina/>

En el móvil, ábrela y añádela a la pantalla de inicio (en iPhone, desde Safari). Funciona
sin cobertura una vez abierta con conexión.

**Cómo se usa:** el [manual de usuario](MANUAL.md), paso a paso. Dentro de la app, la
pestaña Ayuda empieza con una guía rápida.

## Qué hace

- **Veredicto al momento**: compensa cargar o mejor repostar, con el ahorro en euros,
  tanto si ibas a aparcar igualmente como si paras a propósito (con el desvío).
- **Recargos por tiempo y tarifas por minuto**: te dice a qué hora desconectar antes de
  que el recargo se coma el ahorro.
- **Precios oficiales de las gasolineras** cercanas (solo España), por ubicación,
  código postal o municipio, con tus descuentos (c€/L o %, por marca).
- **Cargadores públicos cercanos** (Open Charge Map) y cargadores guardados.
- **Mide tu coche de verdad**: el consumo eléctrico y el de gasolina en híbrido, por
  climatización, con su margen de error. Las cifras que publican los fabricantes no
  sirven para esta cuenta.
- **Consejo de carga según la química** de tu batería (LFP o NMC).
- **Historial** de lo que has ahorrado.

Vale para cualquier híbrido enchufable: lo que depende del modelo se te pregunta o se
mide, nunca se supone.

## Tus datos

Todo lo que guardas se queda en tu móvil: no hay cuentas, ni servidor propio, ni
analítica. Las búsquedas por ubicación sí envían tu posición a los servicios de mapas
y de cargadores. El detalle, en [PRIVACIDAD.md](PRIVACIDAD.md).

## Documentos

| Documento | Para qué |
|---|---|
| [MANUAL.md](MANUAL.md) | Cómo se usa, paso a paso |
| [plan-de-pruebas.md](plan-de-pruebas.md) | Probar la app con tu coche y contarnos qué falla |
| [CAMBIOS.md](CAMBIOS.md) | Qué ha cambiado en cada versión |
| [PRIVACIDAD.md](PRIVACIDAD.md) | Qué se guarda y qué sale del móvil |
| [hoja-de-ruta.md](hoja-de-ruta.md) | Qué viene, en qué orden y qué se ha descartado |
| [LEEME.md](LEEME.md) | Para desarrollar: estructura, flujo y dónde está cada cosa |
| [CLAUDE.md](CLAUDE.md) | Reglas del cálculo y de la arquitectura, con más detalle |

La versión que tienes instalada aparece al final de la pestaña **Ayuda**.

## Desarrollo, en corto

HTML, CSS y módulos JavaScript nativos del navegador: sin dependencias ni paso de
compilación. Se publica subiendo los ficheros a GitHub Pages.

```sh
node pruebas.mjs && node humo.mjs        # pruebas (Node, sin instalar nada)
python -m http.server 8000               # verla en http://localhost:8000
```

Antes de publicar, cambia la versión en `version.json` y en `js/app.js`. Todo lo demás
está en [LEEME.md](LEEME.md).
