# Cambios — Carga vs Gasolina

Lo que cambia en cada versión, contado para quien usa la app. Lo más reciente,
arriba. La app se actualiza sola al abrirla con conexión.

Si ya la estabas probando, mira lo nuevo desde la última vez y el apartado del
plan de pruebas que lo cubre.

---

## 2026-11-08-3 — El % de batería en la medida del consumo en híbrido

- La medida del consumo en híbrido pide **el % de batería al empezar y al terminar**.
  Mientras el motor funciona, la batería sube y baja (en algunos coches, varios
  puntos): si acaba más llena, parte de la gasolina se quedó guardada en ella y el
  consumo saldría falseado. **Con más de 1 punto de diferencia, la medida no se
  guarda** y la app explica por qué.
- Con el ordenador de a bordo puedes juntar varios trayectos en una medida, mientras
  no enchufes el coche.
- Plan de pruebas: **9.12**.

## 2026-11-08-2 — Guía rápida y manual de usuario

- **Ayuda empieza con una guía rápida**: los siete pasos para usar la app, de
  configurar el coche a descargar la copia de seguridad.
- Debajo, **"Manual completo"** abre en el navegador el manual de usuario detallado
  (`MANUAL.md`). Necesita conexión.

## 2026-11-08-1 — La versión, a la vista

- **Al final de la pestaña Ayuda** aparece la versión que tienes. Dila cuando nos
  cuentes un fallo: así sabemos qué estabas usando.
- Documentos nuevos: `README.md` (qué es la app y dónde abrirla), `PRIVACIDAD.md` y
  este mismo.

## 2026-11-07-8 — Comparar con cargar en casa

- **Nuevo en Ajustes: "Cargar en casa"**, con el precio por kWh y la potencia de tu
  enchufe o wallbox.
- Con eso, Calcular pregunta **"¿Vas a cargar en casa antes de gastar esta
  batería?"**. Si respondes que sí, compara con lo que te costaría meter esa misma
  energía en casa, no con la gasolina: "Compensa cargar aquí" o "Mejor esperar a casa".
- El historial guarda con qué se comparó cada recarga.
- Plan de pruebas: **9.14**.

## 2026-11-07-7 — Descuentos en la gasolina y pestaña Ajustes

- **Nueva pestaña Ajustes**, para lo que no depende del vehículo.
- **Descuentos en la gasolina**: cuánto (en céntimos por litro o en %) y en qué
  marcas. La lista de gasolineras muestra lo que pagas tú, y la "más barata" se decide
  con eso. Al tocar una gasolinera con descuento, el cálculo usa tu precio.
- Plan de pruebas: **9.13**.

## 2026-11-07-6 — Los consumos del cálculo, a la vista

- Mi coche muestra **"Consumos que usa el cálculo"**: el medido con la climatización
  elegida o, si no lo hay, el declarado, y de dónde sale cada uno.
- Los consumos ya no se escriben a mano en la antigua pestaña Ajustes: la app los
  volvía a rellenar y lo escrito se perdía sin aviso.
- La copia de seguridad pasa al final de Mi coche, y la tercera pestaña pasa a
  llamarse Ayuda.

## 2026-11-07-5 — Medir el consumo en híbrido

- **Nueva medida en Mi coche: "Lo que gasta en híbrido"**, con la batería en su nivel
  mínimo al empezar y al terminar, con el contador de a bordo o de depósito a
  depósito. Va por climatización, como el consumo eléctrico.
- **Tus medidas eléctricas se recalculan solas** con ese consumo, porque los litros de
  cada medida se descuentan con él.
- La ficha del vehículo avisa: no vale la cifra combinada que se anuncia ni el
  promedio acumulado del ordenador de a bordo.
- Plan de pruebas: **9.12** y **9.8**.

## 2026-11-07-1 a -4 — Sin cobertura y retoques

- **La app abre sin cobertura** (-4) y en Android se puede instalar como aplicación.
- Los resultados de "Buscar cerca" se pueden **plegar** (-2).
- Las gasolineras se buscan más deprisa si repites en la misma zona (-3).
- "+ Guardar" ya no queda pegado al borde al deslizar los cargadores (-1).
- Plan de pruebas: **9.9** y **9.11**.

## 2026-11-02 — Climatización y nueva interfaz

- **Climatización en vez de ciudad/carretera/frío** (-1). Cada medida guarda si usaste
  la calefacción, el aire o nada, y el cálculo solo usa las medidas hechas con la misma.
  Se quitaron los porcentajes estimados, que no tenían fuente.
- **Interfaz nueva** (-2): pestañas abajo, el resultado fijo arriba y las secciones en
  el orden en que decides.
- Plan de pruebas: **5**.

## 2026-10-18 — Gasolineras por código postal o municipio

- **Buscar gasolineras escribiendo un código postal o un municipio** (-2), sin dar tu
  ubicación. Se recuerda lo último que buscaste.
- Las recargas grandes pesan más que las pequeñas al calcular tu consumo medido (-1).
- Plan de pruebas: **9.2b**.

## Hasta octubre de 2026

Primeras versiones: el cálculo de si compensa cargar, perfiles de vehículo, cargadores
guardados con tarifa por minuto y recargo por tiempo, precios oficiales de gasolineras,
búsqueda de cargadores públicos, mediciones reales, historial, tiempo en horas o
minutos y copia de seguridad.
