# Manual de usuario — Carga vs Gasolina

Esta app responde a una pregunta: **estando delante de un punto de carga, ¿compensa
enchufar el híbrido o sale más barato tirar de gasolina?** Si cargas en casa, también
te dice si te conviene más esperar a llegar.

Sirve para cualquier híbrido enchufable. Lo que cambia de un coche a otro (batería,
consumos, tipo de batería) te lo pregunta o lo mide contigo; nunca lo supone.

**Índice**

1. [Instalar la app](#1-instalar-la-app)
2. [Configurar tu coche](#2-configurar-tu-coche)
3. [Delante de un cargador](#3-delante-de-un-cargador)
4. [Cómo leer el resultado](#4-cómo-leer-el-resultado)
5. [Guardar tus cargadores](#5-guardar-tus-cargadores)
6. [Medir tu coche](#6-medir-tu-coche)
7. [Si cargas en casa](#7-si-cargas-en-casa)
8. [Tus descuentos en la gasolina](#8-tus-descuentos-en-la-gasolina)
9. [Cuidado de la batería](#9-cuidado-de-la-batería)
10. [Historial](#10-historial)
11. [Varios vehículos](#11-varios-vehículos)
12. [Copia de seguridad y cambio de móvil](#12-copia-de-seguridad-y-cambio-de-móvil)
13. [Sin cobertura, actualizaciones y versión](#13-sin-cobertura-actualizaciones-y-versión)
14. [Si algo no va como esperas](#14-si-algo-no-va-como-esperas)

---

## 1. Instalar la app

1. Abre <https://3kmedialab.github.io/carga-gasolina/> en el navegador del móvil
   (**en iPhone, con Safari**).
2. Toca el botón de compartir y elige **"Añadir a pantalla de inicio"**. En Android,
   Chrome puede ofrecerte directamente **"Instalar aplicación"**.
3. Ábrela desde el icono del rayo.

No hace falta cuenta ni registro. Todo lo que guardes se queda en tu móvil (ver
[PRIVACIDAD.md](PRIVACIDAD.md)).

**La app tiene cuatro pestañas**, abajo:

| Pestaña | Para qué |
|---|---|
| **Calcular** | Lo que usas delante de un cargador: arriba el resultado, debajo los datos |
| **Mi coche** | Los datos de tu vehículo, tus medidas, el cuidado de la batería, el historial y la copia de seguridad |
| **Ajustes** | Lo que no depende del coche: si cargas en casa y tus descuentos en la gasolina |
| **Ayuda** | Una guía rápida, las explicaciones de cada cosa y la versión de la app |

---

## 2. Configurar tu coche

La primera vez que abres la app te pide los datos de tu vehículo. Puedes cambiarlos
cuando quieras en **Mi coche → Editar datos**.

| Dato | Qué poner |
|---|---|
| **Nombre** | Como quieras llamarlo dentro de la app |
| **Batería útil (kWh)** | La de la ficha técnica. Si ves dos cifras (bruta y útil o neta), la **útil** |
| **Potencia máx. en AC (kW)** | Lo más rápido que carga tu coche en corriente alterna: suele ser 3,3 / 3,7 / 6,6 / 7,4 u 11 kW. **No es la potencia del motor** |
| **Consumo eléctrico (kWh/100 km)** | Si no lo publican: batería ÷ autonomía eléctrica real × 100. Ejemplo: 14 kWh y 60 km reales → 23 |
| **Consumo en híbrido (L/100 km)** | Lo que gasta **con la batería en su nivel mínimo**, cuando toda la energía sale del depósito. Mira el apartado de abajo |
| **Tipo de batería** | LFP o NMC/NCA. Búscalo como "química de la batería" de tu modelo. BYD y algunos MG usan LFP; la mayoría del resto, NMC. Si no lo sabes, "No lo sé" |
| **Eficiencia de carga (%)** | Cuánta energía de la que pagas llega a la batería. Casi nadie lo publica: deja el 85% si no sabes el tuyo |

**El consumo en híbrido, con cuidado.** Es el dato que más se suele poner mal:

- **No vale la cifra combinada que se anuncia** (1–2 L/100 km). Mezcla kilómetros
  hechos con electricidad de la red.
- **Tampoco el promedio acumulado del ordenador de a bordo**, por la misma razón.
- Si no lo sabes, busca en la ficha de homologación el consumo "en modo de
  mantenimiento de carga". Mejor aún: **mídelo** (apartado 6.2).

**No te preocupes si no son exactos.** Los dos consumos son el punto de partida. Cuando
midas tu coche (apartado 6), la app usa lo medido en su lugar. En **Mi coche →
Consumos que usa el cálculo** ves en todo momento qué números está usando y de dónde
salen: "medido" o "declarado".

---

## 3. Delante de un cargador

Todo se hace en **Calcular**, de arriba abajo. El resultado se actualiza solo con cada
cambio.

**1. Dónde cargas**
- Si ya lo tienes guardado, **tócalo** en la fila de cargadores y se rellenan sus datos.
- Si no, pulsa **Buscar cerca** para ver los cargadores públicos cercanos (de Open
  Charge Map, solo en España) con conector de carga en alterna. Toca uno para ver sus conectores, su precio orientativo y sus notas, y
  **+ Guardar** para guardarlo.
- O escribe a mano:
  - **Cobra por**: *Energía* (€/kWh) o *Tiempo* (€/min).
  - **Precio**.
  - **Potencia**: la del punto donde estás. Si es más de lo que admite tu coche, la
    app usa el límite de tu coche y te lo dice.
  - **Tarifa fija**: si cobra algo solo por conectar.

**2. Gasolina**
- **Cerca de mí** pone la media de las gasolineras cercanas, con precios oficiales
  (solo España).
- Si no quieres dar tu ubicación, escribe un **código postal o un municipio** y pulsa
  **Buscar**.
- **Toca una gasolinera** de la lista para usar su precio exacto. Si tienes un
  descuento en esa marca, se aplica (apartado 8).
- También puedes escribir el precio a mano.

**3. ¿Vas a cargar en casa antes de gastar esta batería?**
Solo aparece si has configurado la carga en casa (apartado 7). Responde **Sí** si vas
a llegar a casa y cargar allí antes de gastar lo que metas aquí, y **No** si vas de
viaje o estás cargando en casa ahora mismo.

**4. Tu coche ahora**
Mueve la barra hasta el **% de batería** que marca tu coche.

**5. ¿Vas a usar la climatización?**
Elige **Calefacción**, **Nada** o **Aire**: lo que vayas a usar en el trayecto. Cambia
cuántos kilómetros te da la energía, si has medido tu coche con esa climatización.

**6. La recarga**
- **Ya iba a aparcar**: ibas a estar aquí de todas formas, así que el tiempo no cuesta
  nada. Pon el **Tiempo aparcado**; toca la unidad para cambiar entre horas y minutos.
- **Paro a propósito**: paras solo para cargar. Pon cuántos kWh **quieres cargar** y el
  **desvío** (solo ida), que se descuenta del ahorro.

---

## 4. Cómo leer el resultado

Arriba, fijo mientras bajas, está el veredicto:

| Lo que dice | Qué significa |
|---|---|
| **Compensa cargar** | Te sale más barato que la gasolina. El número es lo que ahorras |
| **Mejor repostar** | Te sale más caro que la gasolina. El número es lo que perderías |
| **Casi igual** | La diferencia es de menos de 10 céntimos: da igual |
| **Compensa cargar aquí** | Frente a tu carga en casa, aquí te sale más barato |
| **Mejor esperar a casa** | Te saldría más barato cargar esa energía en casa |
| **Gratis** | No pagas nada: no hay nada que decidir. Te dice cuánto te ahorras |
| **Batería llena** | No cabe más energía. Si el punto cobra por conectar, te avisa de que pagarías sin cargar |

Debajo del veredicto, una línea explica la cuenta. Por ejemplo, cuánto más barato te
salen esos kilómetros que en gasolina, o cuánto te costaría la misma energía en casa.

En **La recarga** tienes el detalle:
- **Cargarás**: los kWh y el tiempo.
- **Km eléctricos que ganas**.
- **Te cuesta**: lo que pagas aquí.
- **En gasolina habrían sido** (o **En casa te habría costado**): lo que pagarías en la
  otra opción.
- La barra muestra la batería al llegar y al irte.

**Los avisos que importan:**
- **"Desconecta antes de…"**: el punto cobra un recargo si ocupas la plaza demasiado
  tiempo. A partir de esa hora, el recargo se come el ahorro.
- **"La batería se llena en…"**: te vas a ir más tarde de lo que tarda en llenarse; el
  tiempo de más no suma.
- **"Pagando por minuto, te salen X €/kWh"**: el precio real por kWh de un punto que
  cobra por tiempo. Suele ser muy alto.

**Ahorros pequeños, a menudo de menos de 1 €, son lo normal.** Un enchufable tiene poca
batería; la ventaja está en repetirlo muchas veces.

**Guardar esta recarga** la apunta en el historial (apartado 10).

---

## 5. Guardar tus cargadores

Guarda los puntos donde cargas a menudo para no reescribir sus datos.

- **+ Guardar**, al principio de la fila de cargadores, abre la ficha: **nombre**,
  **potencia del punto**, si **cobra por** energía o por tiempo, el **precio** y unas
  **notas**.
- **Recargo por exceso de tiempo**: si el punto cobra por ocupar la plaza a partir de
  cierto tiempo (muchos supermercados lo hacen), pon **a partir de** cuánto tiempo y
  cuánto **cobra** por minuto. El cargador lleva un reloj en la fila, y la app te dice
  a qué hora desconectar.
- Para **cambiarlo o borrarlo**, usa **Editar** debajo de la fila, o toca otra vez el
  que ya está elegido. Con muchos cargadores, **Ver los N** abre la lista completa.
- Los cargadores son comunes a todos tus vehículos: un punto de carga es un sitio.

Si guardas un cargador desde **Buscar cerca**, el nombre y la potencia vienen
rellenos. El precio y el recargo los escribes tú: el texto de Open Charge Map es
orientativo y puede estar desactualizado.

---

## 6. Medir tu coche

**Es lo que hace fiables los números.** Sin medidas, la app usa los consumos
declarados, que pueden fallar un 30% o más. Midiendo unas cuantas veces, el margen de
error baja mucho, y la app te dice cuánto.

Hay dos medidas, y las dos van **por climatización**: una medida con calefacción solo
cuenta para calcular con calefacción. Nunca se mezclan.

### 6.1 Lo que rinde de verdad (consumo eléctrico)

En **Mi coche → Añadir o ver medidas**.

1. **Carga hasta tu nivel de referencia** y úsalo siempre igual. Con batería LFP, el
   100%. Con NMC, tu límite habitual (suele ser el 80%).
2. **Anota el cuentakilómetros** al desenchufar.
3. **Conduce con normalidad**, sin hacer nada especial.
4. **Vuelve a cargar hasta el mismo nivel**, mejor antes de que se agote la batería.
   Anota los kilómetros y los kWh de esa recarga.
5. **Indica la climatización** que usaste casi todo el tiempo y si hizo frío.

Introduce los km del principio y del final, los kWh, la gasolina gastada (0 si el
motor no arrancó), la climatización y si hizo frío.

- Cuenta **todos** los kWh que entraron en ese periodo: públicos, del trabajo y de
  casa. Si cargaste en algún sitio donde no puedas leer los kWh, esa medida no vale.
- Haz **ventanas cortas**: un solo ciclo de carga, de al menos 30 km.
- La app calcula cuántos km haces por kWh que pagas, descontando los que hizo el motor
  de gasolina.

### 6.2 Lo que gasta en híbrido (consumo de gasolina)

En **Mi coche → Medir el consumo en híbrido**. Es la otra mitad de la comparación: si
este consumo está mal, la gasolina parece más barata o más cara de lo que es.

1. **Empieza con la batería en su nivel más bajo**, en el modo que mantiene la carga
   (híbrido, HEV…). En muchos coches es el 0% del indicador. Si tu coche deja elegir el
   nivel que mantiene (en los BYD DM-i, por ejemplo, el "SOC objetivo"), ponlo en el
   mínimo. No uses ningún modo que cargue la batería con el motor.
2. **Anota el cuentakilómetros y el nivel de batería.** Pon a cero el contador de
   consumo del coche o, si vas a medir de depósito a depósito, llena el depósito.
3. **Conduce al menos 150 km sin enchufar el coche** ni una vez, con la misma
   climatización.
4. **Termina con la batería en el mismo nivel que al empezar.** Anota los km y el
   consumo del contador, o llena el depósito y anota los litros.

- **De depósito a depósito** es lo más fiable y sirve en cualquier coche: los
  ordenadores de a bordo suelen marcar algo menos de lo real.
- Evita tener el coche **parado y encendido** mucho rato: algunos arrancan el motor
  para cargar la batería sin moverse, y esa gasolina no suma kilómetros.
- La app **rechaza menos de 3 L/100 km**: eso es un promedio con kilómetros
  eléctricos, no lo que gasta en híbrido.
- Al guardarla, **tus medidas eléctricas se recalculan solas**, porque los litros de
  cada una se descuentan con este consumo.

### 6.3 El margen de error

Tras cada medida verás el **margen de error** de cada climatización:

- Con **1 medida**, ±15%.
- Con **2**, suele salir más ancho, y nunca baja del ±15%: dos medidas casualmente
  iguales no demuestran nada.
- Desde la **tercera** baja deprisa. Con 4 o 5 medidas parecidas entre sí, ronda el
  ±5%.
- Solo cuentan las 8 últimas de los últimos 12 meses de cada climatización. Las demás
  se ven atenuadas en la lista.

---

## 7. Si cargas en casa

Si cargas en casa, un cargador público no te ahorra gasolina: te ahorra la carga de
esa noche. La app lo tiene en cuenta si se lo dices.

1. En **Ajustes → Cargar en casa**, pon **lo que pagas por kWh en casa** (con tarifa
   por horas, el de las horas en que cargas, normalmente el valle) y la **potencia**
   de tu enchufe (2,3 kW) o de tu wallbox. Pulsa **Guardar**.
2. En **Calcular** aparece la pregunta **"¿Vas a cargar en casa antes de gastar esta
   batería?"**:
   - **Sí, comparar con casa**: compara con lo que te costaría meter la misma energía
     en casa. Con un enchufe normal se pierde más energía que con una wallbox, y la
     app lo cuenta.
   - **No, con gasolina**: vas de viaje, no vas a llegar a casa antes de gastar la
     batería, o estás cargando en casa ahora mismo.

La respuesta se recuerda. Para dejar de usarlo, **Ajustes → No cargo en casa**.

Frente a casa, el precio de la gasolina no influye. El desvío de **Paro a propósito**
se sigue contando en gasolina, porque son kilómetros de más.

**Lo que todavía no hace:** si vas a llegar a casa pero el trayecto gasta más batería
de la que tienes, una parte de la carga ahorra gasolina y otra ahorra casa. La app no
lo reparte: elige la respuesta que más se parezca a tu caso.

---

## 8. Tus descuentos en la gasolina

Si pagas menos que el precio del surtidor (una app de fidelización, una tarjeta que
devuelve un porcentaje…), apúntalo en **Ajustes → Descuentos en la gasolina**:

- **Cuánto**: un número.
- **En**: céntimos por litro o % del precio.
- **En qué marcas**: como salen en la lista de gasolineras. Varias, separadas por comas
  (por ejemplo, `SHELL, GALP`).

Ejemplos: "5 c€/L en REPSOL", "3 % en SHELL, GALP".

**Cómo se aplica:**
- En la lista de gasolineras, las de esas marcas muestran **lo que pagas tú**, con el
  precio del surtidor tachado debajo. **"MÁS BARATA"** se decide con lo que pagas tú.
- Al **tocar** una de esas gasolineras, debajo del precio aparece **"Pagas…"**: es el
  precio que usa el cálculo.
- **La media de la zona y el precio escrito a mano van sin descuento.**
- Si dos descuentos valen en la misma gasolinera, se usa **el mejor**, no la suma.
- La app no sabe de topes mensuales ni de promociones que caducan: cuando un descuento
  deje de valer, cámbialo o bórralo.

Con unos pocos céntimos el veredicto apenas cambia; lo que sí cambia a menudo es qué
gasolinera te sale más barata.

---

## 9. Cuidado de la batería

En **Mi coche → Cuidado de la batería**, según el tipo de batería que pusiste:

- **LFP**: conviene llegar al **100% una vez por semana**, para que el coche no pierda
  precisión al medir la carga. Pulsa **Hoy he cargado al 100%** cuando lo hagas; un
  punto de color te dice cuántos días han pasado.
- **NMC/NCA**: lo contrario. **No cargues al 100% por costumbre**: quédate entre el 20%
  y el 80%, y llena solo antes de un viaje largo.
- **No lo sé**: la app te pide que lo indiques, porque los consejos son opuestos.

---

## 10. Historial

Cada vez que pulsas **Guardar esta recarga**, se apunta en **Mi coche → Historial**: la
fecha, los kilómetros, el precio y lo que ahorraste o perdiste.

- Arriba ves cuántas recargas llevas y **cuánto has ahorrado en total**.
- Guarda también las **gratuitas**: suelen ser de donde sale la mayor parte del ahorro
  de tener un enchufable. La nota de abajo separa lo que viene de cargar gratis.
- Las recargas comparadas con casa llevan "· frente a casa", y la nota dice cuántas
  hay: ese ahorro es frente a tu carga en casa, no frente a la gasolina.
- Cada vehículo lleva su propio historial. **Borrar historial** borra solo el del
  vehículo activo.

---

## 11. Varios vehículos

En **Mi coche → Añadir vehículo** puedes tener varios: el tuyo y el de tu pareja, o
uno que te plantees comprar.

- Para **cambiar** de vehículo, tócalo en la lista de Mi coche. El nombre que sale
  arriba a la derecha en Calcular es el del vehículo activo; tocarlo te lleva a Mi
  coche. Tocar en la lista el que ya está marcado abre sus datos para editarlos.
- **Cada vehículo** lleva sus datos, sus medidas, su historial y su calibración.
- **Son comunes** a todos: los cargadores guardados, la carga en casa y los descuentos.
- Para **comparar dos coches**, alterna entre ellos con el mismo cargador y la misma
  gasolina: la diferencia que ves es la real.

---

## 12. Copia de seguridad y cambio de móvil

Todo vive en tu móvil. **Si borras la app** (en iPhone, quitar el icono de la pantalla
de inicio puede bastar) **o los datos del navegador, se pierde todo.**

- **Mi coche → Descargar copia de seguridad** guarda un archivo con todo: vehículos,
  cargadores, medidas, historial, calibración y lo de Ajustes. En el móvil se abre el
  menú de compartir: guárdalo en Archivos o en la nube. Hazlo de vez en cuando.
- **Restaurar copia de seguridad** sustituye lo que haya por lo de la copia, tras
  pedirte confirmación.
- **Para cambiar de móvil**: descarga la copia en el viejo, pásala al nuevo, instala la
  app allí y restáurala.

---

## 13. Sin cobertura, actualizaciones y versión

- **Sin cobertura**: si has abierto la app al menos una vez con conexión, se abre igual
  y calcula igual. Lo que necesita red es buscar gasolineras y cargadores; puedes
  escribir los precios a mano.
- **Actualizaciones**: llegan solas al abrir la app con conexión. A veces la página se
  recarga una vez al abrirla: es la versión nueva llegando.
- **La versión** que tienes aparece al final de la pestaña **Ayuda**. Qué trae cada
  una, en [CAMBIOS.md](CAMBIOS.md).

---

## 14. Si algo no va como esperas

| Lo que pasa | Por qué, y qué hacer |
|---|---|
| "No has dado permiso de ubicación" | El navegador no deja a la app saber dónde estás. Busca por código postal o municipio, o da permiso en los ajustes del navegador |
| No salen gasolineras | Los precios oficiales son solo de España. Escribe el precio a mano |
| Faltan gasolineras cerca del límite de provincia | Solo se busca en una provincia. Es una limitación conocida |
| Una medida dice "no vale con tu consumo en híbrido" | Con el consumo en híbrido de ahora, sus litros explicarían más de la mitad de los km. Revisa el dato de gasolina de esa medida o bórrala |
| Una medida no se guarda | El mensaje rojo dice por qué: faltan datos, el resultado no es creíble o falta la climatización |
| El descuento no se aplica | Solo al tocar una gasolinera de esa marca, y la marca tiene que coincidir con el nombre de la lista |
| Cargar en un punto que cobra por minuto nunca compensa | Es lo normal con un enchufable: carga despacio y pagas por tiempo |
| Los ahorros son muy pequeños | Es lo normal: poca batería. La ventaja está en repetirlo |

**Para contar un fallo o proponer algo**, sigue el formato del
[plan de pruebas](plan-de-pruebas.md#12-cómo-reportar-un-fallo) e incluye la versión
de la app.

**Qué datos salen de tu móvil**: en [PRIVACIDAD.md](PRIVACIDAD.md).
