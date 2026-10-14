# Prueba la app — Carga vs Gasolina

Gracias por echar una mano. Esta app sirve para decidir, estando delante de un punto
de carga público, si compensa enchufar el coche o si sale más barato tirar de
gasolina.

**Qué te pedimos:** que la uses con **tu propio coche** durante unos días y nos
cuentes qué falla, qué no se entiende y qué echas de menos.

**No necesitas saber nada técnico.** Solo tu coche, tu móvil y un rato.

**Por qué te necesitamos:** la app se construyó con un único vehículo. Cada híbrido
enchufable tiene batería, química, potencia de carga y consumos distintos, y ahí es
donde van a aparecer los fallos que nadie ha visto todavía.

---

## 1. Instalación

1. Abre la dirección de la app en el navegador **(en iPhone tiene que ser Safari)**.
2. Toca el botón de compartir.
3. Elige **"Añadir a pantalla de inicio"**.
4. Ábrela desde el icono nuevo.

**Antes de borrar nada, descarga la copia de seguridad** (Ajustes y explicaciones →
Copia de seguridad → Descargar copia de seguridad). En iPhone, quitar el icono de la
pantalla de inicio puede borrar todos los datos de la app (vehículos, cargadores,
historial y medidas), y la copia es la única forma de recuperarlos. Conviene
descargarla de vez en cuando, aunque no vayas a borrar nada.

**Si necesitas empezar de cero** (por ejemplo para repetir la configuración inicial):
- **iPhone:** Ajustes → Safari → Avanzado → Datos de sitios web → busca el sitio → Eliminar.
- **Android:** Ajustes de Chrome → Privacidad → Borrar datos de navegación → Datos de sitios.
- O simplemente ábrela en una pestaña privada.

Todo lo que guardes se queda en tu móvil. No se envía a ningún sitio.

---

## 2. Configura tu coche

La primera vez te pedirá seis datos. **De su exactitud depende todo lo demás.**

| Dato | Dónde encontrarlo |
|---|---|
| **Batería útil (kWh)** | Ficha técnica o web del fabricante. Si ves dos cifras (bruta y neta/útil), usa la **útil**. |
| **Potencia máxima en AC (kW)** | Lo más rápido que admite tu coche en corriente alterna. Suele ser 3,3 / 3,7 / 6,6 / 7,4 u 11 kW. **No es la potencia del motor.** |
| **Consumo eléctrico (kWh/100km)** | Si no lo publican: batería ÷ autonomía eléctrica real × 100. Ejemplo: 14 kWh y 60 km reales → **23**. |
| **Consumo en híbrido (L/100km)** | Lo que gasta **con la batería agotada**. El dato de tu ordenador de a bordo en viajes largos, **no** el WLTP homologado. |
| **Tipo de batería** | LFP o NMC/NCA. Búscalo como "química de la batería" de tu modelo. BYD y algunos MG usan LFP; la mayoría del resto, NMC. Si no lo encuentras, deja "No lo sé". |
| **Eficiencia de carga (%)** | Casi nadie lo publica. Deja el 85% salvo que conozcas el tuyo. |

> **Apunta los valores que uses.** Te los pedimos al final, y nos sirven para montar
> una tabla de referencia por modelos.

**Aviso honesto:** el consumo eléctrico y la eficiencia son estimaciones. Si el
consumo que pones está mal, todos los resultados estarán mal en la misma proporción.
Por eso la sección 10 (validación con recarga real) es la más importante del documento,
y por eso existe también la sección 9.8 (medir tu coche con datos reales).

---

## 3. Comprueba las cuentas a mano (una sola vez)

Verifica que las cuentas cuadran **con tu coche**. Coge calculadora, ponte en modo
**Aparcado**, y **empieza con la batería por debajo del 70%** — así evitas el tramo
final de carga, que tiene su propia lógica y lo comprobaremos aparte en la sección 6.

**Paso 1 — ¿A qué potencia carga de verdad?**
```
La menor entre: potencia del cargador  y  potencia máxima de tu coche
```

**Paso 2 — ¿Qué eficiencia se aplica?**
La app la ajusta a la baja si cargas despacio, porque las pérdidas fijas pesan más:

| Potencia real | Eficiencia aplicada |
|---|---|
| 6 kW o más | la tuya, sin cambios |
| entre 4 y 6 kW | la tuya × 0,98 |
| entre 2,5 y 4 kW | la tuya × 0,93 |
| menos de 2,5 kW | la tuya × 0,82 |

Cuando se aplica un ajuste, la app te lo dice bajo el campo de potencia.

**Paso 3 — ¿Cuánto cabe todavía en la batería?**
```
(batería × (100 − % actual) ÷ 100) ÷ (eficiencia del paso 2 ÷ 100)
```

**Paso 4 — ¿Cuántos kWh te van a cobrar?**
```
La menor entre: (horas × potencia del paso 1)  y  el resultado del paso 3
```
→ Compara con **"Cargarás"**.

> El campo "Cuánto tiempo estarás aquí" puede estar en **horas** o en **minutos**
> (la unidad aparece a la derecha del campo y se cambia tocándola). Si lo tienes en
> minutos, divide entre 60 antes de usarlo en este paso. Ojo: 0,5 horas son 30
> minutos, no 50.

**Paso 5 — ¿Cuánta energía entra de verdad en la batería?**
```
kWh del paso 4 × (eficiencia del paso 2 ÷ 100)
```

**Paso 6 — ¿Cuántos km ganas?**
```
energía del paso 5 ÷ consumo eléctrico × 100
```
→ Compara con **"Km eléctricos que ganas"**.

**Paso 7 — ¿Cuánto te cuesta?**
```
kWh del paso 4 × precio del cargador
```
→ Compara con **"Te cuesta"**.

**Paso 8 — ¿Cuánto costaría en gasolina?**
```
km del paso 6 × consumo híbrido ÷ 100 × precio de la gasolina
```
→ Compara con **"En gasolina habrían sido"**.

**Paso 9 — El ahorro**
```
paso 8 − paso 7
```
→ Compara con el número grande de arriba.

Diferencias de ±0,02 € son normales por redondeo. **Diferencias mayores son un fallo.**

---

## 4. Pruebas de coherencia

Estas reglas se cumplen **con cualquier coche**. Si alguna falla, hay un fallo.

**4.1 — El veredicto nunca contradice al número**
Prueba cinco o seis precios de cargador (0,10 / 0,25 / 0,35 / 0,50 / 0,70 €/kWh).
- Con **"Compensa cargar"**, el número grande debe ser **positivo y verde**.
- Con **"Mejor repostar"**, debe ser **negativo y naranja**.
- **Nunca al revés.** Ni una sola vez.

**4.2 — Subir el precio del cargador siempre empeora**
El ahorro debe bajar **siempre**, sin saltos raros, cruzando por "Casi igual".

**4.3 — Subir el precio de la gasolina siempre mejora**

**4.4 — Más tiempo aparcado nunca da menos**
Los kWh deben subir o quedarse igual, **nunca bajar**. A partir de cierto punto dejan
de subir: la batería se ha llenado. Es correcto.

**4.5 — Más batería al empezar significa menos que cargar**
Sube el "% de batería ahora" del 10% al 90%: los kWh deben ir **bajando**.

**4.6 — Los dos modos deben coincidir**
1. Anota los kWh que salen en modo **Aparcado**.
2. Cambia a **Parada dedicada**, pon esos mismos kWh y **0 km de desvío**.
3. Coste, km y ahorro deben ser **prácticamente iguales**.

---

## 5. Los tres modos de conducción

*(Sección nueva: estos botones estaban mal calculados hasta hace poco.)*

Abre **Ajustes y explicaciones**. Verás Ciudad / Mixto / Carretera.

**5.1 — Los botones cambian los dos consumos**
Pulsa cada uno y mira los dos campos de debajo.
- Al pasar a **Ciudad**: el consumo eléctrico **baja** y el de gasolina **sube**.
- Al pasar a **Carretera**: el eléctrico **sube** y el de gasolina **baja**.
- Si solo cambia uno de los dos, es un fallo.

**5.2 — El resultado cambia mucho entre modos**
Con el mismo precio de cargador, anota el ahorro en los tres.
- **Ciudad debe dar bastante más ahorro que Carretera.** No unos céntimos: la
  diferencia debería ser clara.
- *Por qué:* en ciudad tu coche gasta mucha gasolina y poca electricidad; en autopista
  es al revés. Cargar compensa mucho más en ciudad.
- Si los tres dan casi lo mismo, es un fallo.

**5.3 — Editar a mano desactiva el botón**
Cambia un consumo a mano: el botón que estaba marcado debe dejar de estarlo.

**5.4 — El botón de frío**
Con **Mixto** marcado, pulsa **"Frío — el coche ha estado a la intemperie"**.
- Los **dos** consumos deben **subir**: el eléctrico un 30% y el de gasolina un 12%
  (por ejemplo, 22 → 28,6 kWh/100km y 5,0 → 5,6 L/100km).
- El texto bajo el importe grande debe añadir "calculado con frío".
- En Ciudad la subida es mayor (+45% eléctrico) y en Carretera menor (+18%).
- Al pulsarlo otra vez, o al editar un consumo a mano, el modo frío se desactiva.

---

## 6. Química de la batería y final de carga

*(Sección nueva.)*

**6.1 — El consejo de carga depende de la química**
Edita tu vehículo y cambia el tipo de batería. Mira la tarjeta de calibración:

| Tipo | Qué debe aparecer |
|---|---|
| **LFP** | Semáforo de días desde la última carga completa **y** botón "Hoy he cargado al 100%" |
| **NMC / NCA** | "No cargues al 100% por costumbre", recomendando quedarse entre 20% y 80%. **Sin botón.** |
| **No lo sé** | "Indica el tipo de batería". Sin consejo y sin botón. |

- **Si a un NMC le aparece el consejo de cargar al 100% cada semana, es un fallo
  grave**: ese consejo daña ese tipo de batería.

> **Qué es la tasa C.** Es la potencia con la que carga tu coche dividida entre la
> capacidad de su batería (kW ÷ kWh). Un coche de 18 kWh cargando a 6,6 kW va a
> 0,37C; uno de 10 kWh cargando a 7,4 kW, a 0,74C. La app frena al final de la carga
> según esa tasa: **cuanto más baja, menos se nota el frenazo**. Por eso las pruebas
> 6.2 y 6.4 dan resultados distintos según el coche.

**6.2 — El tramo final tarda más (por kWh)**
Pon el modo **Parada dedicada** y la potencia del cargador igual a la máxima de tu
coche. Anota los minutos **por kWh** ("Cargarás: X kWh en Y min", minutos ÷ kWh) en
dos casos:
- **A)** Batería al 30% y pides 2 kWh.
- **B)** Batería al 80% y pides más de lo que cabe (por ejemplo 20 kWh): la app lo
  reduce hasta el 100%.

B debe salir **más lento por kWh que A**. Cuánto más lento depende de la tasa C:

| Coche de ejemplo | Tasa C | Min por kWh en A | Min por kWh en B |
|---|---|---|---|
| 18 kWh con 6,6 kW, LFP (Atto 2 DM-i) | 0,37C | 9,1 | 9,7 (≈ 7% más) |
| 10 kWh con 7,4 kW, LFP *(ejemplo, no un coche real)* | 0,74C | 8,1 | 11,3 (≈ 40% más) |
| 10 kWh con 7,4 kW, NMC *(ejemplo, no un coche real)* | 0,74C | 8,1 | 12,1 (≈ 50% más) |

- Si B no sale más lento que A, es un fallo.
- Con una tasa C baja la diferencia es pequeña, pero **no cero**. Es lo esperado.
- **Ojo:** si en B pides una cantidad pequeña (por ejemplo 3 kWh) y el coche no llega
  al final de la carga, A y B saldrán **iguales** en un coche de tasa C baja. No es un
  fallo: no has llegado al tramo lento.

**6.3 — Por debajo del 80% la química no cambia nada**
Con la batería al 30% y poco tiempo (que no llegue al 80%), cambia el tipo de batería
entre LFP y NMC.
- Los kWh y el tiempo deben ser **idénticos**. La curva solo actúa en el tramo alto.

**6.4 — Arriba, la química solo importa si la tasa C es alta**
Con la batería al 80% y tiempo de sobra para llenar, alterna LFP y NMC.
- Los **kWh no deben cambiar nunca**.
- El **tiempo** depende de la tasa C:

| Tasa C | Diferencia de tiempo entre LFP y NMC |
|---|---|
| 0,37C (por ejemplo 18 kWh con 6,6 kW, o 10 kWh con 3,7 kW) | casi nula (menos del 1%) |
| 0,74C (por ejemplo 10 kWh con 7,4 kW) | en torno al 7% |
| 1,1C (por ejemplo 6 kWh con 6,6 kW) | en torno al 14% |

- Si tu coche tiene una tasa C baja y LFP y NMC dan el mismo tiempo, **es correcto**,
  no un fallo.

> Los umbrales de esta curva son estimaciones razonables, no la curva medida de tu
> modelo. Se contrastaron con una única recarga real (un Atto 2 DM-i cargando del 82%
> al 100%). Si al cargar de verdad ves tiempos muy distintos, **eso es exactamente lo
> que queremos saber**.

---

## 7. Límites físicos

**7.1 — La batería nunca pasa del 100%**
Pon 12 horas y la batería al 10%. La barra debe pararse en el 100%, avisar de que se
llena antes de que te vayas, y el tiempo indicado debe ser **menor** que 12 horas.

**7.2 — Batería llena**
Pon el % a 100 → "Batería llena" y 0 kWh. **No debe decir que compensa.**

**7.3 — Batería llena con tarifa de conexión** *(caso delicado)*
Con la batería al 100%, pon 1 € de tarifa fija en Ajustes.
- Debe seguir diciendo "Batería llena" y avisar de que pagarías 1 € sin cargar nada.
- **Si dice que compensa, es un fallo grave.**

**7.4 — Cargador más potente que tu coche**
Pon 22 kW. Debe avisarte en ámbar de que tu coche topa antes, y **los kWh no deben
aumentar**.

**7.5 — Cargador lento: aviso de eficiencia**
Pon 2 kW de potencia de cargador.
- Debe avisarte de que a esa potencia se pierde más energía y de que ha ajustado la
  eficiencia a la baja.
- Los km ganados deben ser **menores** que con la misma energía a potencia alta.

**7.6 — Pedir más de lo que cabe** *(Parada dedicada)*
Batería al 80% y pide una cantidad grande de kWh: debe reducirlo a lo que cabe y
explicártelo.

**7.7 — Valores absurdos**
Prueba 0, negativos y cifras enormes.
- Puede dar resultados raros, pero **no debe quedarse en blanco, colgada, ni mostrar
  "NaN" o "Infinity"**.

---

## 8. Cargadores que cobran por minuto

*(Sección nueva. Importante: es donde un enchufable pierde más dinero.)*

Arriba hay un selector: **"El cargador cobra por: energía / tiempo"**.

**8.1 — Cambiar el modo cambia el campo**
Al elegir "Tiempo", el campo de €/kWh debe desaparecer y aparecer uno de €/min.

**8.2 — Te dice el equivalente en €/kWh**
Pon 0,10 €/min. En el texto bajo el importe debe aparecer a cuánto te sale el kWh.
- Con un coche que cargue a 6-7 kW, debería rondar **1 €/kWh**.
- **Debería salir "Mejor repostar"** con casi cualquier gasolina. Eso es correcto, no
  un fallo.

**8.3 — Cuanto más lento cargues, peor**
Con el mismo precio por minuto, baja la potencia del cargador de 7 kW a 3 kW.
- El equivalente en €/kWh debe **subir bastante**.
- *Por qué:* pagas por tiempo, así que cargar despacio sale mucho más caro.

**8.4 — Se guarda con el cargador**
Guarda un cargador estando en modo "Tiempo". La etiqueta debe mostrar el precio con
"/min". Al recuperarlo, debe volver también el modo de tarifa, no solo el número.

---

## 9. Otras funcionalidades

**9.1 — Cargadores guardados**
- Guarda un punto con nombre. Cambia los valores. Toca la etiqueta: deben volver.
- Guarda el mismo nombre con **otro precio**: debe avisarte del cambio y **no
  duplicar** la etiqueta.
- Prueba el mismo nombre en mayúsculas: tampoco debe duplicarse.
- Borra uno con la ×.

**9.2 — Buscar gasolineras** *(solo España)*
- Pulsa el botón y da permiso de ubicación.
- ¿Salen gasolineras que reconoces? ¿Están **ordenadas de más cerca a más lejos**?
- ¿La marcada como "Más barata" es realmente la más barata de la lista?
- Toca una: debe poner **su precio exacto**, no la media.
- **Prueba a denegar el permiso** y con modo avión: mensaje claro, sin colgarse.

**9.3 — Varios vehículos**
- Añade un segundo coche (el de otra persona, o uno que te plantees comprar).
- Alterna entre ambos con los mismos precios: los resultados deben cambiar.
- Toca el que ya está seleccionado: debe abrirse para editarlo.
- Intenta borrar cuando solo queda uno: no debe dejarte.

**9.4 — Historial y calibración**
- Guarda varias recargas: contador y total deben ir sumando.
- Con dos vehículos: **cada uno lleva su propio historial**, sin mezclarse.
- En un vehículo LFP, marca "Hoy he cargado al 100%": el punto se pone verde.
- Cambia de vehículo: ese otro debe seguir sin registro.

**9.5 — Tema claro y oscuro**
Cambia el modo oscuro de tu móvil (Ajustes → Pantalla y brillo).
- La app debe cambiar con él, **sin cerrarla ni recargarla**.
- En tema claro, a pleno sol: ¿se leen todos los textos, incluidos los grises?
- La barra de estado del móvil debe acompañar al fondo, sin franjas de otro color.

**9.6 — Que no se pierda nada**
Cierra la app del todo y vuelve a abrirla: debe conservar vehículos, cargadores,
historial, calibración, modo de tarifa, la unidad de tiempo y el modo en que estabas.

**9.7 — Copia de seguridad**
En Ajustes y explicaciones, sección "Copia de seguridad".
- Pulsa **"Descargar copia de seguridad"**. En el móvil se abre el menú de compartir
  (guárdala en Archivos o en la nube); si no, se descarga un archivo
  `carga-vs-gasolina-copia-AAAA-MM-DD.json`.
- Cambia algo (por ejemplo, borra el historial) y pulsa **"Restaurar copia de
  seguridad"**, eligiendo ese archivo. Debe pedir confirmación ("Esto sustituirá los
  datos actuales…") y, al aceptar, recargar la app con **todo como estaba**:
  vehículos, cargadores, historial, medidas y calibración.
- Si eliges un archivo que no es una copia (si el selector te lo permite), debe
  decir "Ese archivo no es una copia de seguridad válida" y **no tocar nada**.

**9.8 — Medir mi coche con datos reales**
En Ajustes y explicaciones → "Medir mi coche con datos reales". Sigue los cuatro
pasos que explica la pantalla (cargar hasta tu nivel de referencia, anotar el
cuentakilómetros, conducir, volver a cargar al mismo nivel) e introduce los km
iniciales, los km finales, los kWh cargados y la gasolina gastada.

- **La cuenta.** La app calcula R = km eléctricos ÷ kWh cargados. Compruébalo con la
  calculadora. Ejemplo: 250 km con 64 kWh → **3,91 km/kWh**.
- **La gasolina se descuenta.** Los km hechos con el motor se restan:
  litros ÷ consumo híbrido × 100. Con 5 L/100km, **0,1 L son 2 km** y 3 L son 60 km.
  Ejemplo: 250 km, 50 kWh y 3 L → (250 − 60) ÷ 50 = **3,80**.
  **Ojo:** un 0,1 que se quede en "Gasolina gastada" cambia el resultado. Si la
  medida no sale como esperas, revisa ese campo primero.
- **Rechazos esperados**, cada uno con su mensaje: km finales menores o iguales que
  los iniciales; sin kWh; más de la mitad de los km hechos con gasolina; resultado
  imposible (R menor de 0,5 o mayor de 15).
- **Tras guardar** debe aparecer "N medidas en uso", "Rindes X km por cada kWh que te
  facturan", "Equivale a un consumo de Y kWh/100km" y el margen de error. El consumo
  eléctrico de Ajustes pasa a ser el medido y los km del veredicto cambian.
- **Borrar.** La × de cada medida pide confirmación y, al borrarla, todo se recalcula.
- **Margen de error.** Con 1 medida sale ±15%. Con 2 sale **mucho más amplio**
  (dos medidas de 3,8 y 4,0 km/kWh → ±16%) y baja deprisa al añadir más (3,8 / 3,9 /
  4,0 → ±4%). **Con 2 medidas el margen nunca baja de ±15%** (el mismo que con una
  sola): aunque coincidan casi exactamente (6,706 y 6,714 → ±15%, no ±0%), la app no
  da por buena esa coincidencia. Desde la tercera medida el margen se calcula sin
  ese mínimo. No te fíes mucho del margen hasta tener 4 o 5 medidas.
- Solo cuentan las 8 últimas medidas de los últimos 6 meses.

**9.9 — Buscar cargadores públicos** *(Open Charge Map)*
- Pulsa "Buscar cargadores cercanos" y da permiso de ubicación. Debe aparecer
  "Distancias en línea recta, no por carretera · hasta X km" y una lista **ordenada de
  más cerca a más lejos** (las 5 primeras, y el resto tras "Ver N más").
- Solo deben salir puntos con conector **Tipo 2** (el de carga lenta en AC),
  operativos y públicos o para clientes (supermercados, por ejemplo). **Si sale un
  punto que solo tiene carga rápida (CCS o CHAdeMO), es un fallo.**
- Toca una tarjeta: se despliega con los conectores y sus kW, el operador, el precio
  ("orientativo, confírmalo al llegar"), las notas y cuándo se verificó el dato. Toca
  otra vez: se contrae. Al abrirla, la potencia del cargador de arriba pasa a ser la
  máxima de ese punto.
- Si las notas hablan de cobro por minuto o por tiempo, salen resaltadas. La app
  **nunca** convierte ese texto en un precio ni en un recargo: eso lo escribes tú.
- Con una tarjeta abierta, "+ Guardar este" abre la ficha con el nombre y la potencia
  ya puestos y el texto de Open Charge Map como ayuda. El precio y el recargo **no**
  salen de ese texto: los escribes tú.
- Un punto que ya tienes guardado debe llevar la etiqueta GUARDADO.
- **Prueba a denegar el permiso** y con modo avión: mensaje claro ("No has dado
  permiso de ubicación." / "Open Charge Map no ha respondido."), y el botón debe
  volver a "Buscar cargadores cercanos", sin quedarse en "Buscando…".

**9.10 — Tiempo en minutos u horas**
En modo Aparcado, el campo "Cuánto tiempo estarás aquí" lleva a la derecha un botón
con la unidad ("horas" o "min").
- Tócalo: el valor se convierte conservando la duración (1,5 horas ↔ 90 min) y **el
  resultado no debe cambiar**.
- 39 minutos deben dar exactamente el mismo resultado que 0,65 horas.
- Cierra la app y ábrela: debe recordar la unidad elegida.

---

## 10. Validación con una recarga real ⭐

**La prueba más valiosa del documento**, y la única que necesita un cargador de
verdad. Es la que dirá si la app funciona con tu coche o solo con el de quien la hizo.

**Antes de enchufar:**
1. Mira el % de batería del coche y ponlo en la app.
2. Pon el precio, el modo de tarifa y la potencia reales del punto.
3. Pon el tiempo que vas a estar.
4. **Anota lo que predice:** kWh, km, coste, % final y **tiempo de carga**.

**Después de la recarga:**

| | La app dijo | La realidad |
|---|---|---|
| kWh cargados | | |
| Coste (€) | | |
| Batería final (%) | | |
| Km eléctricos ganados | | |
| Tiempo hasta llenar | | |

**Cómo interpretarlo:**
- **Diferencia menor del 10%:** bien, tus datos están bien puestos.
- **La app predice más kWh de los que salieron:** la potencia real pudo ser menor (los
  cargadores no siempre dan lo que anuncian), o tu eficiencia es peor que la puesta.
- **La app predice menos kWh:** revisa la capacidad de batería.
- **El tiempo no cuadra pero los kWh sí:** es la curva de carga. Anota desde qué % y
  hasta qué % ibas — es justo el dato que nos falta por modelo.
- **El % final no cuadra:** batería o eficiencia están desviadas.

Cuéntanos **cualquier** diferencia, aunque creas que es culpa de tus datos.

---

## 11. Uso real y usabilidad

- **En un cargador de verdad:** ¿decidiste rápido, o tuviste que pelearte con la app?
- **Con una sola mano**, de pie, quizá bajo el sol: ¿se lee? ¿llegas a los botones?
- **Sin leer nada:** pásasela a alguien que no sepa de esto y **observa sin ayudar**.
  Anota lo primero que no entiende.
- **Palabras confusas:** cualquier término que tuvieras que releer, o campo que no
  supieras rellenar.
- **Lo que sobra:** ¿hay algo en pantalla que nunca miras?

---

## 12. Cómo reportar un fallo

```
QUÉ HICE:      (pasos, uno por línea)
QUÉ ESPERABA:
QUÉ PASÓ:
MI COCHE:      (marca, modelo y los 6 datos que configuraste)
VALORES:       (precio y modo de tarifa, gasolina, potencia, % batería, tiempo)
MÓVIL:         (modelo y navegador)
CAPTURA:       (si puedes)
```

**Ejemplo:**
```
QUÉ HICE:      Puse la batería al 100% y 1 € de tarifa fija
QUÉ ESPERABA:  "Batería llena" y aviso de que pagaría 1 € sin cargar
QUÉ PASÓ:      Dijo "Compensa cargar" con +0,00 €
MI COCHE:      Kia Niro PHEV — 8,9 kWh / NMC / 3,3 kW / 19 kWh100 / 5,4 L100 / 85%
VALORES:       0,30 €/kWh, 1,74 €/L, 7,4 kW, 100%, 2 h
MÓVIL:         iPhone 13, Safari
```

### Qué fallos importan más

1. **Un número mal calculado.** Lo más grave: la app existe para dar cifras fiables.
2. **Un consejo que dañe la batería** — por ejemplo, recomendar cargar al 100% cada
   semana a un coche con batería NMC.
3. **Que diga "compensa" cuando en realidad pierdes dinero**, o al revés.
4. **Pérdida de datos:** vehículos, historial o cargadores que desaparecen.
5. **Que se quede colgada, en blanco, o muestre "NaN" / "Infinity".**
6. **Que tu coche no se pueda configurar bien** con los campos disponibles.
7. **Textos que no se entienden**, o texto ilegible en tema claro.
8. **Detalles visuales:** algo cortado o mal alineado.

---

## 13. Proponer funcionalidades nuevas

Nos interesa más el problema que la solución. En vez de "añadid un botón X",
cuéntanos **qué intentabas hacer y no pudiste**:

```
QUÉ QUERÍA HACER:
POR QUÉ:                (en qué situación real te pasó)
CÓMO LO RESUELVES HOY:  (a mano, con otra app, o no lo resuelves)
CADA CUÁNTO TE PASA:
```

**Ejemplo:**
```
QUÉ QUERÍA HACER:      Saber si me da la batería para llegar a casa sin gasolina
POR QUÉ:               Salí del trabajo al 40% y no sabía si parar a cargar
CÓMO LO RESUELVO HOY:  Mirando la autonomía del coche y calculando a ojo
CADA CUÁNTO:           Dos o tres veces por semana
```

**Limitaciones conocidas** (no hace falta reportarlas):
- **No hay notificaciones.** Una app instalada así no puede enviarlas.
- **No hay precios en vivo de las redes de carga** (Iberdrola, Zunder…): requieren
  acuerdos comerciales de pago. La búsqueda de cargadores públicos muestra el precio
  que figura en Open Charge Map, que es orientativo y puede estar desactualizado.
- **No se conecta al coche** para leer la batería.
- **Solo funciona con gasolina y en euros.** Si tu enchufable es diésel, o estás fuera
  de España, la app no encaja bien todavía. Dínoslo igualmente: queremos saber cuánta
  gente está en ese caso.
- **El modo frío es una aproximación.** Muchos híbridos enchufables arrancan el motor de
  gasolina para calentar el habitáculo; si el tuyo lo hace, en invierno los resultados
  seguirán siendo optimistas. Si notas que se desvían, cuéntanoslo.
- **No contempla carga rápida en corriente continua**, que algunos enchufables tienen.

**Cosas que NO son fallos, son así a propósito:**
- **Los ahorros son pequeños** (a menudo menos de 1 € por recarga). Es la realidad de
  un híbrido enchufable: poca batería. La ventaja está en repetirlo mucho.
- **Los cargadores guardados son comunes a todos los vehículos.** Un punto de carga es
  un sitio, no depende del coche.
- **El desvío se valora a precio de gasolina**, aunque lo hagas en eléctrico. Es
  deliberadamente conservador.
- **Cargar en un poste que cobra por minuto casi nunca compensa** con un enchufable.

---

## 14. Ficha para devolver

```
── TU COCHE ────────────────────────────────
Marca y modelo:
Año:
Batería útil (kWh):
Tipo de batería (LFP / NMC / no lo sé):    ¿de dónde lo sacaste?
Potencia máx. AC (kW):
Consumo eléctrico (kWh/100km):             ¿de dónde lo sacaste?
Consumo híbrido (L/100km):                 ¿de dónde lo sacaste?
Eficiencia usada (%):

── TU USO ──────────────────────────────────
¿Cargas en casa?          Sí / No
¿Dónde cargas normalmente?
¿Has visto cargadores que cobren por minuto?
¿Cuántas veces usaste la app?
¿Hiciste la validación con recarga real? (sección 10)

── COMPROBACIONES ──────────────────────────
Sección 3 (cuentas a mano):       Cuadra / No cuadra
Sección 4 (coherencia):           Todo OK / Fallos: ___
Sección 5 (modos y frío):         Todo OK / Fallos: ___
Sección 6 (química y curva):      Todo OK / Fallos: ___
Sección 7 (límites físicos):      Todo OK / Fallos: ___
Sección 8 (tarifa por minuto):    Todo OK / No pude probarlo / Fallos: ___
Sección 9 (otras funciones):      Todo OK / No pude probarlo / Fallos: ___
Sección 10 (recarga real):        diferencia en kWh ___%  ·  en tiempo ___%

── LO IMPORTANTE ───────────────────────────
¿Te fiarías de la app para decidir?     Sí / No / Depende
¿Qué es lo que menos se entiende?
¿Qué le falta?
¿Qué le sobra?
¿Se la recomendarías a alguien con un PHEV?   Sí / No
```

---

Gracias. Cada coche distinto que la prueba encuentra cosas que con uno solo no se ven.
