# Carga vs Gasolina — Hoja de ruta

Estado a 7 de septiembre de 2026.

---

## Dónde estamos

La app funciona, está desplegada en GitHub Pages y estructurada en módulos con
pruebas automáticas (52 del cálculo + 22 de humo).

**Lo que ya hace:**

- Decide si compensa cargar, en dos modos: aparcado y parada dedicada
- Perfiles de vehículo, con química de batería y consejo de carga adaptado
- Cargadores guardados con notas, tarifa por minuto y recargo por exceso de tiempo
- Hora límite antes de que el recargo se coma el ahorro
- Precios reales de gasolineras (API del Ministerio)
- Ajuste por tipo de conducción y por frío
- Carga gratuita: sin veredicto, pero contabilizada en el historial
- Historial con desglose entre ahorro gratuito y de pago
- Medición de R con datos reales, con ventana de vigencia

**La limitación honesta:** sin mediciones propias, el margen de error del
veredicto es de un ±30%, y eso deja indecidibles la mayoría de los cargadores
públicos (entre 0,25 y 0,45 €/kWh). Todo lo que viene está ordenado por cuánto
reduce esa incertidumbre o cuánto dinero real pone en juego.

---

## Fase 0 — Validar antes de construir *(ahora, 4-6 semanas)*

**Ninguna funcionalidad nueva.** El objetivo es tener datos con los que decidir
en vez de suposiciones mías.

### 0.1 Tus primeras mediciones

- Mínimo 3 mediciones (mejor 4 o 5) en fin de semana con el cargador del Mercadona
- Anotar: km inicial, km final, kWh facturados, litros
- **Criterio de éxito:** margen de error por debajo del ±10% (con 3 medidas si
  se parecen mucho entre sí; con 5 o 6 si varían de forma normal)

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
- ¿Tocas alguna vez los modos de conducción?
- ¿Usas el modo "parada dedicada" o solo "aparcado"?

Si en un mes no has tocado los modos, se quitan. Si no miras el veredicto, la
app debería reorganizarse alrededor del historial.

**Puerta de decisión:** con estos datos se decide qué fases siguen vivas y en
qué orden. Es posible que alguna de las de abajo se caiga.

---

## Fase 1 — Honestidad sobre la incertidumbre *(1 sesión)*

**Lo más valioso que queda por hacer, y ya está calculado.**

Hoy la app da un veredicto con dos decimales aunque su margen de error sea del
±30%. Debería admitir cuándo no lo sabe.

- Calcular la banda real a partir de tus mediciones
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

## Fase 3 — R por condiciones *(2 sesiones, necesita datos)*

Hoy los factores de ciudad, carretera y frío son **estimaciones mías**. Con
suficientes mediciones podrían ser tuyos.

- R separado por tipo de conducción y por frío
- Sustituir los factores estimados por los medidos, cuando haya al menos 3
  mediciones de esa condición
- Mientras no las haya, seguir con los factores actuales

**Depende de:** tener mediciones de varias estaciones. Antes de la primavera no
tiene sentido empezar.

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
- **Base de datos de vehículos por marca y modelo** — los datos que harían falta
  no los publica nadie con fiabilidad; inventarlos sería peor que preguntarlos
- **Reescritura con framework** — a 1.500 líneas no compensa, y un proceso de
  compilación rompería el despliegue desde el móvil

---

## Deuda técnica pendiente

| Qué | Gravedad |
|---|---|
| `interfaz.js` tiene 705 líneas; podría partirse en vistas | Baja |
| El plan de pruebas no cubre aún medición, gratis ni modularización | **Media** |
| No hay prueba automática de que index.html y los módulos casen tras editar | Media |
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
