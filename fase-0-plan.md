# Fase 0 — Plan de trabajo

Desde el **7 de septiembre** hasta mediados de octubre.
Nada que programar: solo recoger datos para decidir con hechos.

---

## Resumen de la semana

| | Qué hacer | Cuándo |
|---|---|---|
| **Esta semana** | Preparar la app y avisar a los testers | 2 horas en total |
| **Semanas 1-4** | Medir, usar la app y anotar | Unos minutos por recarga |
| **Semana 5** | Rellenar el informe final y decidir | 1 hora |

---

# BLOQUE A — Tus mediciones

**Objetivo:** bajar el margen de error del ±30% actual a menos del ±10%.

Para conseguirlo hacen falta **entre 3 y 6 mediciones**, según lo parecidas que
sean entre sí (ver la tabla de más abajo). Con pocas mediciones el margen es
mucho más ancho de lo que parece, y la app lo calcula así a propósito.

## Qué necesitas

- Hacer **3 mediciones como mínimo, mejor 4 o 5**, cargando en el **Mercadona**
  (o cualquier punto que facture kWh)
- Ventanas de **un solo ciclo**: cargas, conduces, vuelves a cargar
- **No cargar en la oficina** dentro de la ventana, o la medida no vale

## La ventana ideal para ti

Fin de semana, porque no pasas por la oficina:

1. **Viernes o sábado** — cargas al 100% en el Mercadona. Anotas km y kWh
2. Fin de semana normal, sin cargar en ningún otro sitio
3. **Domingo** — vuelves a cargar al 100%. Anotas km, kWh y litros

Con unos 50-70 km por ventana, lo normal es que el motor no arranque y salgan
0 litros. Si sale más, la app te avisará si la medida no sirve.

## Hoja para anotar

```
MEDICIÓN 1        fecha: ____________
  km al desenchufar        ______________
  km al volver a enchufar  ______________
  kWh facturados           ______________
  litros de gasolina       ______________
  ¿cargué en otro sitio?   sí / no    (si es sí, la medida no vale)

MEDICIÓN 2        fecha: ____________
  km al desenchufar        ______________
  km al volver a enchufar  ______________
  kWh facturados           ______________
  litros de gasolina       ______________
  ¿cargué en otro sitio?   sí / no

MEDICIÓN 3        fecha: ____________
  km al desenchufar        ______________
  km al volver a enchufar  ______________
  kWh facturados           ______________
  litros de gasolina       ______________
  ¿cargué en otro sitio?   sí / no

MEDICIÓN 4        fecha: ____________
  km al desenchufar        ______________
  km al volver a enchufar  ______________
  kWh facturados           ______________
  litros de gasolina       ______________
  ¿cargué en otro sitio?   sí / no

MEDICIÓN 5        fecha: ____________
  km al desenchufar        ______________
  km al volver a enchufar  ______________
  kWh facturados           ______________
  litros de gasolina       ______________
  ¿cargué en otro sitio?   sí / no
```

## Cómo saber si va bien

Tras cada medición, mira el margen de error en la pantalla de medición.

**El margen no depende solo de cuántas medidas tienes, sino de cuánto se parecen
entre sí.** La app lo calcula con la t de Student, que con pocas medidas exige un
margen mucho más ancho. Estos son los valores que debería mostrar:

| Medidas | Se parecen mucho (varían un ~4%) | Variación normal (~10%) |
|---|---|---|
| 1 | ±15% | ±15% |
| 2 | ±18% | ±45% |
| 3 | ±7% | ±17% |
| 4 | ±5% | ±12% |
| 5 | ±4% | ±9,5% |
| 6 | ±3% | ±8% |

*Qué es "varían un 4%":* por ejemplo, dos medidas de 6,3 y 6,7 km/kWh. *Qué es
"varían un 10%":* por ejemplo, 6,0 y 6,9.

- **Con 2 medidas el margen nunca baja del ±15%** (el mismo que con una sola).
  Si se parecen casi exactamente, la estadística daría un margen minúsculo por
  pura casualidad, y la app no se lo cree. Desde la tercera medida se calcula sin
  ese mínimo. No te fíes mucho del margen hasta tener 4 o 5 medidas.
- **El objetivo (por debajo del ±10%) se alcanza con 3 medidas si se parecen mucho**
  y con 5 o 6 si varían de forma normal.
- **Si con 5 medidas el margen sigue por encima del ±15%:** tus medidas varían
  mucho entre sí. Anota si hubo algo raro (viaje largo, mucho frío, atascos).
- **Si tu R sale muy distinto de 3,9 km/kWh:** no es un error, es tu dato real.
  Interesa saberlo.

**Apunta el R final:** ____________ km/kWh

---

# BLOQUE B — Validación contra la realidad

**Objetivo:** comprobar si el modelo predice bien. Es la única prueba que
verifica la app entera de una vez.

**Hazlo una sola vez**, en cualquier recarga donde conozcas los kWh.

## Antes de enchufar

Configura la app con los datos reales del punto y anota lo que predice:

```
  batería al llegar        ______ %
  precio del cargador      ______ €/kWh
  potencia del punto       ______ kW
  tiempo que voy a estar   ______ h

  LA APP PREDICE:
    kWh que cargaré        ______
    km que ganaré          ______
    coste                  ______ €
    batería final          ______ %
    tiempo de carga        ______
```

## Después de la recarga

```
  LO QUE PASÓ DE VERDAD:
    kWh facturados         ______
    coste                  ______ €
    batería final          ______ %
    tiempo hasta llenar    ______
```

## Cómo interpretarlo

| Diferencia | Qué significa |
|---|---|
| Menos del 10% | El modelo va bien. Seguir con la hoja de ruta |
| La app predice **más** kWh | La potencia real fue menor, o la eficiencia es peor del 86% |
| La app predice **menos** kWh | La capacidad de batería declarada se queda corta |
| Los kWh cuadran pero **el tiempo no** | Es la curva de carga. Anota desde y hasta qué % ibas |
| Más del 20% en cualquiera | **Hay que corregir el modelo antes de añadir nada** |

---

# BLOQUE C — Testers

**Objetivo:** saber qué casos reales existen ahí fuera, para no construir a ciegas.

## A quién buscar

3-5 personas con enchufables **distintos al tuyo**. Prioriza, por este orden:

1. Alguien con **batería NMC** (la mayoría que no sea BYD) — nunca se ha
   probado el consejo de carga invertido con un usuario real
2. Alguien que **cargue en casa**, con wallbox o enchufe normal
3. Alguien con un coche de **poca potencia de carga** (3,3 kW), donde el ajuste
   de eficiencia es más agresivo
4. Alguien **fuera de España**, si lo tienes a mano — para saber si el buscador
   de gasolineras y los euros son un problema real

## Qué enviarles

- El enlace a la app
- El documento `plan-de-pruebas.md`
- Este mensaje:

> Te paso una app que he hecho para decidir si compensa cargar el híbrido
> enchufable en un punto público o tirar de gasolina. Está sin terminar y me
> interesa más lo que falle que lo que funcione.
>
> Con que la uses una semana y me digas qué no entiendes, ya me sirve. Si
> puedes rellenar la ficha del final del documento, mejor.
>
> Aviso: los ahorros por recarga son pequeños, de menos de un euro. Es la
> realidad de un enchufable, no un fallo de la app.

## Lo que necesito saber de ellos

Aunque no rellenen nada más, estas cuatro respuestas son las que deciden la
hoja de ruta:

```
  1. ¿Pudo configurar su coche sin preguntarte nada?      sí / no
  2. ¿Hay cargadores que cobren por minuto en su zona?    sí / no / no lo sé
  3. ¿Carga en casa? ¿Con wallbox o enchufe normal?       ______________
  4. ¿Llegó a hacer alguna medición, o lo dejó?           ______________
```

Y estos casos, que activan fases hoy congeladas:

```
  ¿Alguno tiene enchufable diésel?              sí / no
  ¿Alguno tiene carga rápida en continua?       sí / no
  ¿Alguno está fuera de España?                 sí / no
  ¿Alguno no puede leer los kWh al cargar?      sí / no
```

---

# BLOQUE D — Tu propio uso

**Objetivo:** el más incómodo. Descubrir qué partes de la app sobran.

No hay que hacer nada especial: usar la app con normalidad y, al final de las
cuatro semanas, responder con sinceridad.

```
  ¿Cuántas veces la abriste?                        ______

  ¿Miraste el veredicto (compensa / no compensa)?
     siempre / a veces / casi nunca

  ¿Guardaste recargas en el historial?
     siempre / a veces / casi nunca

  ¿Tocaste los modos de conducción?
     sí, varias veces / una o dos / nunca

  ¿Usaste el modo "parada dedicada"?
     sí / no

  ¿Usaste el buscador de gasolineras?
     sí / no

  ¿Te sirvió el aviso de la hora límite del Mercadona?
     sí / no / no llegué a usarlo

  ¿Qué es lo primero que quitarías?                 ______________
  ¿Qué echaste de menos?                            ______________
```

## Qué haremos con cada respuesta

| Si… | Entonces |
|---|---|
| Nunca tocaste los modos de conducción | Se quitan, y con ellos los factores estimados |
| Casi nunca miras el veredicto | La app se reorganiza alrededor del historial |
| No usaste "parada dedicada" | Se plantea dejar un solo modo |
| No usaste el buscador de gasolineras | Se simplifica a un campo de texto |
| El aviso de la hora límite te sirvió | Se refuerza: es lo que más dinero mueve |

---

# Semana 5 — Decidir

Con todo lo anterior delante, respondemos a tres preguntas:

1. **¿El modelo es fiable?** (bloque B) — si no, se corrige antes de nada
2. **¿Qué sobra?** (bloque D) — se quita antes de añadir
3. **¿Qué casos reales existen?** (bloque C) — se descongelan solo esas fases

Y entonces empieza la **fase 1**, que ya está diseñada y solo necesita una
sesión: que la app admita cuándo no puede decidir.

---

## Lo mínimo, si andas corto de tiempo

Si solo puedes hacer una cosa de todo esto, haz el **bloque A**: tres
mediciones como mínimo, mejor cuatro o cinco. Es lo que convierte los números de
la app en fiables, y sin ello todo lo demás se apoya en estimaciones que ya
sabemos que fallan un ±30%.

Lo segundo más valioso es el **bloque D**, que no cuesta tiempo: solo
sinceridad al final.
