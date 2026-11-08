# Carga vs Gasolina — Hoja de ruta

Estado a 8 de noviembre de 2026 (el plan de fases es del 7 de septiembre).

---

## Dónde estamos

La app funciona, está desplegada en GitHub Pages y estructurada en módulos con
pruebas automáticas (239 del cálculo + 186 de humo en 18 escenarios). Abre sin
cobertura y se instala como app.

**Lo que ya hace:**

- Decide si compensa cargar, en dos modos: aparcado y parada dedicada
- Perfiles de vehículo, con química de batería y consejo de carga adaptado
- Cargadores guardados con notas, tarifa por minuto y recargo por exceso de tiempo
- Hora límite antes de que el recargo se coma el ahorro
- Búsqueda de cargadores públicos cercanos (Open Charge Map), sin inventar precios
- Precios reales de gasolineras (API del Ministerio), por ubicación, código postal
  o municipio
- R medido por climatización (calefacción / aire / nada), sin factores estimados
  *(2 de noviembre: sustituye a los antiguos botones de ciudad/carretera/frío)*
- **Consumo en híbrido medido**, también por climatización, y R recalculado con él
  *(7 de noviembre; vale para cualquier PHEV)*
- **Comparar con cargar en casa** en vez de con la gasolina, si vas a llegar a casa
  antes de gastar la batería *(7 de noviembre)*
- **Descuentos en la gasolina** por marca, en c€/L o en % *(7 de noviembre)*
- Carga gratuita: sin veredicto, pero contabilizada en el historial
- Historial con desglose entre ahorro gratuito y de pago, y entre recargas
  comparadas con la gasolina o con casa
- Copia de seguridad en un archivo

**La limitación honesta:** sin mediciones propias, los dos consumos (el eléctrico
y el de híbrido) son los declarados, y el margen de error del veredicto es de un
±30% o más. Eso deja indecidibles la mayoría de los cargadores públicos (entre
0,25 y 0,45 €/kWh). Todo lo que viene está ordenado por cuánto reduce esa
incertidumbre o cuánto dinero real pone en juego.

---

## Fase 0 — Validar antes de construir *(ahora, 4-6 semanas)*

**Ninguna funcionalidad nueva.** El objetivo es tener datos con los que decidir
en vez de suposiciones mías.

### 0.1 Tus primeras mediciones

- Mínimo 3 mediciones (mejor 4 o 5) en fin de semana con el cargador del Mercadona
- Anotar: km inicial, km final, kWh facturados, litros
- **Criterio de éxito:** margen de error por debajo del ±10% (con 3 medidas si
  se parecen mucho entre sí; con 5 o 6 si varían de forma normal)
- **Y el consumo en híbrido** *(añadido el 7 de noviembre)*: al menos una medida
  con la batería en su nivel mínimo (en el Atto 2, el 25%) al empezar y al
  terminar. Sin ella, la gasolina usa el declarado, y además ese consumo es el
  que descuenta los km del motor en las medidas de R. El promedio acumulado del
  ordenador de a bordo (2,5 L/100 km) no sirve: mezcla km eléctricos.

### 0.2 Validación contra la realidad

Una vez, antes de una recarga: anotar lo que predice la app (kWh, km, coste,
tiempo) y compararlo con lo que ocurre de verdad.

- **Si la diferencia es menor del 10%:** el modelo es bueno, seguir
- **Si es mayor:** hay que corregir el modelo antes de añadir nada

### 0.3 Repartir a otros usuarios

- Enviar la app y el plan de pruebas a 3-5 personas con enchufables distintos
- **Lo que necesito saber de ellos:**
  - ¿Consiguen configurar su coche sin ayuda?
  - ¿Hay cargadores de tarifa por minuto en su zona?
  - ¿Alguno tiene enchufable diésel, o carga en corriente continua?
  - ¿Cuántos cargan en casa, y con qué tipo de toma?
  - ¿Alguno llega a hacer mediciones, o lo abandona?

### 0.4 Comprobar tu propio uso

La pregunta incómoda: **¿usas la app o no?** Y en concreto:

- ¿Miras el veredicto, o solo guardas las recargas en el historial?
- ¿Cambias la climatización antes de calcular, o se queda siempre igual?
- ¿Usas el modo "parada dedicada" o solo "aparcado"?

Si no miras el veredicto, la app debería reorganizarse alrededor del historial.
*(Los modos de conducción ciudad/mixto/carretera ya se quitaron el 2 de
noviembre: sus porcentajes no tenían fuente.)*

**Puerta de decisión:** con estos datos se decide qué fases siguen vivas y en
qué orden. Es posible que alguna de las de abajo se caiga.

---

## Fase 1 — Honestidad sobre la incertidumbre *(1 sesión)*

**Lo más valioso que queda por hacer, y ya está calculado.**

Hoy la app da un veredicto con dos decimales aunque su margen de error sea del
±30%. Debería admitir cuándo no lo sabe.

- Calcular la banda real a partir de tus mediciones. *(Desde el 7 de noviembre
  son dos: la de R y la del consumo en híbrido. El precio límite del cargador es
  R × consumo en híbrido ÷ 100 × precio de la gasolina, así que sus márgenes se
  combinan: sin medir nada, unos ±42%; con las dos bien medidas, en torno al ±7%.
  Queda por decidir qué margen se da al consumo de gasolina declarado: el mismo
  ±30% que al eléctrico es coherente, pero es una convención, no un dato. Frente
  a casa no entran ni R ni la gasolina: solo la diferencia de pérdidas entre la
  potencia de aquí y la de casa, así que ese veredicto ya es mucho más seguro.)*
- Si el precio del cargador cae dentro de la banda, decir *"con tus datos no
  puedo distinguirlo"* en vez de fingir precisión
- Indicar cuántas mediciones faltan para resolver **ese cargador concreto**
  (un cargador a 0,25 se resuelve con 1 medida; uno a 0,32 necesita 8; uno a
  0,34 no se resolverá nunca)

**Por qué primero:** convierte el punto más débil de la app en su rasgo más
fiable, y empuja a medir, que es lo que hace fiable todo lo demás.

**Depende de:** nada. Se puede hacer ya.

---

## Fase 2 — Capacidad real de la batería *(1 sesión)*

El desgaste no afecta al veredicto (el coste por km es inmune), pero **infla el
historial**: con un 15% de degradación, el ahorro acumulado sale un 18% alto.
Sobre 621 € anuales son 110 € de ahorro fantasma.

- Estimar la capacidad real a partir de una carga profunda (% inicial + kWh
  facturados) y ofrecer actualizar el dato
- Revisión sugerida cada 2-3 años, no más

**Depende de:** nada.

---

## Fase 3 — R por condiciones *(en marcha desde el 2 de noviembre)*

**Hecho:** los factores estimados de ciudad, carretera y frío se han quitado.
No tenían fuente y además se aplicaban encima de R medido, así que contaban dos
veces la calefacción y la forma de conducir que la medida ya incluía.

Ahora cada medida guarda la **climatización** (calefacción / aire / nada) y si
**hizo frío**. El cálculo usa solo las medidas con la climatización que vas a
usar; sin ninguna, lo dice y usa el consumo declarado con su ±30%. Nunca toma
prestadas medidas de otra climatización.

**Pendiente, y solo con datos:**

- **Separar por frío.** Hoy el frío se guarda pero no separa grupos. Si tras un
  invierno las medidas "sin climatización" con frío salen claramente distintas
  de las templadas, se divide ese grupo. Si no, se queda así.
- **Ciudad o carretera.** No se pregunta: combinada con la climatización daría
  demasiados grupos para el número de medidas que hace una persona. Solo se
  añadirá si los datos de varios testers muestran que hace falta.
- **El consumo de gasolina** *(7 de noviembre: hecho)*. Se mide como R, por
  climatización: con la batería en su nivel mínimo al empezar y al terminar, sin
  enchufar, con el contador de a bordo o de depósito a depósito. Vale para
  cualquier PHEV. Además corrige R: los litros de cada medida eléctrica se
  descuentan con el consumo medido. El frío se guarda, pero, igual que en R, no
  separa grupos hasta que los datos lo pidan.

**Depende de:** mediciones de invierno y de verano, de varios coches.

---

## Fase 4 — Ahorro anual proyectado *(1 sesión)*

El dato que de verdad responde *"¿me merece la pena tener un enchufable?"*.

- A partir del historial, proyección anual con su margen
- Desglose entre carga gratuita y de pago
- Requiere un dato nuevo: kilómetros anuales

**Depende de:** que en la fase 0 se confirme que usas el historial.

---

## Fase 5 — Coste de oportunidad *(1 sesión)*

Si vas a poder cargar gratis mañana en la oficina, pagar 0,25 €/kWh hoy no te
cuesta cero: te cuesta 3 € de ahorro al que renuncias.

- Detectar que tienes un cargador gratuito guardado
- Avisar cuando estés a punto de pagar en otro sitio

**Depende de:** confirmar que el caso se te da en la práctica y no es teórico.

**Hecho el caso de casa** *(7 de noviembre, lo piden dos testers que cargan en
casa)*: si configuras la carga en casa en Ajustes y respondes que vas a cargar en
casa antes de gastar la batería, el cálculo compara con meter esa misma energía en
casa, no con la gasolina. Pendiente, solo si los testers lo echan en falta: repartir
el caso mixto (llegar a casa gastando más batería de la que hay), que necesita los
km hasta casa y el nivel mínimo real de la batería.

---

## Sin fecha — a la espera de datos de los testers

Nada de esto se construye hasta que alguien lo pida con un caso real:

| Qué | Se hará si |
|---|---|
| Enchufables diésel | Algún tester tiene uno |
| Otras monedas y países | Algún tester está fuera de España |
| Carga rápida en corriente continua | Algún tester tiene un coche que la use |
| Medición por porcentaje de batería | Varios no pueden leer los kWh |
| Exportar el historial | El historial acumula meses de datos |
| Compartir cargadores entre usuarios | Hay varios usuarios activos |

---

## Descartado, y por qué

- **Notificaciones y avisos** — una app instalada así no puede enviarlos
- **Precios en vivo de las redes de carga** — requieren acuerdos comerciales
- **Conexión con el coche** — la app oficial de BYD no publica los kWh por sesión
- **Meteorología automática** — la temperatura ambiente no es la de la batería,
  y añadía una dependencia externa para un dato aproximado
- **Factores estimados de conducción y frío** — porcentajes sin fuente que se
  aplicaban sobre R medido y contaban dos veces lo que la medida ya incluía.
  Sustituidos por R medido por climatización (Fase 3)
- **Base de datos de vehículos por marca y modelo** — los datos que harían falta
  no los publica nadie con fiabilidad; inventarlos sería peor que preguntarlos
- **Reescritura con framework** — a 3.000 líneas no compensa, y un proceso de
  compilación rompería el despliegue desde el móvil

---

## Deuda técnica pendiente

| Qué | Gravedad |
|---|---|
| `interfaz.js` tiene unas 1.700 líneas; podría partirse en vistas | Media |
| El plan de pruebas no cubre aún la carga gratuita | **Media** |
| Si el JS busca un `id` que no está en index.html, `humo.mjs` solo avisa (AVISO), no falla | Media |
| Sin comprobación de contraste en tema claro a pleno sol | Baja |

---

## Cómo se decide qué toca

En este orden:

1. **¿Corrige un número equivocado?** Va primero, siempre.
2. **¿Reduce la incertidumbre?** Va antes que cualquier funcionalidad nueva.
3. **¿Hay dinero real en juego?** Los recargos por tiempo mueven más euros que
   el veredicto.
4. **¿Lo ha pedido alguien con un caso concreto?** Si no, espera.

Y la regla que ya nos ha ahorrado trabajo dos veces: **si al construirlo hay que
inventarse un dato, no se construye.**
