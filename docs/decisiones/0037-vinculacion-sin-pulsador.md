# ADR 0037 — Vinculación de placas sin pulsador

**Estado:** Aceptada (2026-11-04) · Reemplaza el §4 y el §5 del [ADR 0026](0026-vinculacion-automatica-con-confirmacion-fisica.md) (confirmación física con el pulsador de salida) y mantiene el resto (anuncio, candidatos, panel, liberar, respaldo de taller).

## Contexto

El ADR 0026 exigía que alguien mantuviera pulsado el pulsador de salida 5 s en la puerta para vincular una placa. En la práctica estorba: la placa ya está conectada y en línea, el instalador no siempre tiene el pulsador cableado, y para probar en banco hay que puentear IO12 a GND a mano.

Además, ese pulsador nunca fue una barrera que el servidor pudiera comprobar. `POST /dispositivos/confirmar` solo verifica `(mac, clave)` y la ventana abierta: quien conoce la MAC (pública) puede anunciar su propia clave y llamar a `confirmar` dentro de la ventana. El botón protegía solo a la placa legítima, no al servidor.

## Decisión

1. **El anuncio vincula.** Si el super admin pidió vincular la placa (ventana de 10 minutos abierta) y el candidato que se anuncia es el único activo, `POST /dispositivos/anunciar` crea el dispositivo con la clave de ese candidato y responde `{ estado: "vinculado", dispositivo_id }`. El firmware publicado ya procesa esa respuesta (guarda el id), así que no hay que recargar placas.
2. **Candidato único y activo.** Un candidato cuenta como activo si se anunció en los últimos 90 s (la placa real repite su anuncio cada 30 s). Con dos o más activos para la misma MAC no se vincula ninguna y se responde `detectada` (falla cerrada); se reintenta en el siguiente anuncio. Un anuncio falso de una sola vez deja de contar a los 90 s.
3. **El servidor ya no responde `confirmar`.** `POST /dispositivos/confirmar` se conserva sin cambios para las placas con firmware anterior que lo llaman al recibir `confirmar` (ADR 0005: sin cambios incompatibles en `/api/v1`). Con la ventana cerrada responde `409 placa.sin_solicitud`.
4. **La lógica de creación es una sola** (`solicitud-de-vinculo.ts`): ventana, cuenta, puerta, plan y cupo se revalidan con la fila bloqueada, igual que antes.
5. **Panel y documentación:** el diálogo ya no pide pulsar nada; indica que la placa se vincula sola en su próximo anuncio.

## Riesgos aceptados

- **Se pierde la prueba de presencia física.** Un atacante que conozca la MAC y se anuncie sostenidamente dentro de la ventana puede impedir la vinculación (con dos candidatos activos no se vincula ninguno), pero **no** quedarse con ella: solo se vincula un candidato único. Si se anuncia antes de que lo haga la placa real, y la placa real no se anuncia durante la ventana, podría ser el candidato único; en la práctica la placa ya está en línea y se anuncia cada 30 s.
- **Mitigaciones que se mantienen:** solo el super admin abre la ventana, de 10 minutos; el super admin ve MAC, IP pública y último contacto en el panel y elige él cuándo vincular; los límites de anuncios por IP y por MAC y de placas nuevas por IP; los demás candidatos se descartan al vincular.
- **Un anuncio hostil sostenido** puede impedir que una placa se vincule (denegación), no tomar su lugar. Se detecta por los límites y por el panel.

## Alternativas descartadas

- **Mantener el pulsador:** la fricción no compensa, y el servidor no podía comprobarlo.
- **Elegir el candidato en el panel:** exige una migración y una pantalla nuevas; con el candidato único activo se cubre el caso real sin ellas. Puede añadirse si aparecen anuncios hostiles.

## Consecuencias

- **API:** `anunciar-placa` crea el dispositivo; `confirmar-placa` queda como compatibilidad. Sin migración.
- **Firmware:** sin cambios; el estado `confirmar` y la lectura del pulsador de 5 s quedan sin uso y pueden retirarse en una versión posterior.
- **Tests prioritarios:** el anuncio vincula con la ventana abierta; sin ventana nunca vincula; dos candidatos activos no vinculan; un falso viejo no estorba; `confirmar` sigue funcionando.
