# Privacidad — Carga vs Gasolina

Qué guarda la app, dónde, y qué sale de tu móvil. Sin letra pequeña.

## Lo que se queda en tu móvil

Todo lo que escribes o guardas vive **solo en el almacenamiento del navegador de tu
móvil**:

- tus vehículos y sus datos
- los cargadores guardados
- tus medidas (eléctricas y del consumo en híbrido)
- el historial de recargas y la calibración de la batería
- la carga en casa y tus descuentos en la gasolina
- el último lugar que buscaste y la gasolinera que tocaste

Nada de eso se envía a ningún servidor. No hay cuentas, ni registro, ni cookies, ni
analítica, ni publicidad. Las fuentes de letra son las de tu móvil, así que tampoco se
pide nada a servicios de fuentes.

**La copia de seguridad** es un archivo que se descarga a tu móvil. Va solo a donde tú
lo guardes (Archivos, la nube…).

**Si borras la app** o los datos del navegador, se borra todo. Por eso conviene
descargar la copia de vez en cuando.

## Lo que sale de tu móvil, y solo cuando pulsas un botón

La app no tiene servidor propio, pero algunas funciones piden datos a servicios
públicos. Solo ocurre al pulsar el botón correspondiente:

| Cuando pulsas | A quién se pide | Qué se envía |
|---|---|---|
| **Gasolina → Cerca de mí** | Nominatim (OpenStreetMap), para saber en qué provincia estás | **Tu posición** (latitud y longitud). Si no te has movido más de 2 km desde la última vez, no se repite |
| | El servicio oficial de precios de carburantes del Gobierno (`sedeaplicaciones.minetur.gob.es`) | Solo el código de tu provincia. **Nunca tu posición**: las distancias se calculan en tu móvil |
| **Gasolina → Buscar** (CP o municipio) | Nominatim | **El texto que escribes** (un código postal o el nombre de un municipio) |
| | Ministerio | Solo el código de la provincia |
| **Dónde cargas → Buscar cerca** | Open Charge Map | **Tu posición** y el radio de búsqueda |

Además:

- **La ubicación** solo se pide al pulsar "Cerca de mí" o "Buscar cerca", y antes tu
  navegador te pide permiso. Si dices que no, la app sigue funcionando: puedes buscar
  por código postal o escribir los precios a mano.
- **Una vez al mes**, al buscar cargadores, se descarga de Open Charge Map su tabla de
  tipos de conector y operadores. No lleva ningún dato tuyo.
- **Al abrir la app** se comprueba si hay una versión nueva (`version.json`), en el
  mismo sitio donde está publicada (GitHub Pages).
- Como cualquier página web, GitHub Pages y los servicios de arriba reciben la
  dirección IP desde la que se conecta tu móvil. La app no les manda nada más que lo
  de la tabla.

La clave de Open Charge Map que va dentro de la app es la de la propia app, no una
tuya. No identifica a quien la usa.

## Si algo de esto cambia

Si una versión nueva añade un servicio externo o envía algo distinto, se actualiza
este documento en el mismo cambio, y se cuenta en `CAMBIOS.md`.
