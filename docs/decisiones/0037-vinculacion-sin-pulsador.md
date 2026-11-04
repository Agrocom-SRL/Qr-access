# ADR 0037 — Vinculación de placas sin pulsador

**Estado:** Aceptada (2026-11-04) · Reemplaza el §4 y el §5 del [ADR 0026](0026-vinculacion-automatica-con-confirmacion-fisica.md) (confirmación física con el pulsador de salida) y mantiene el resto (anuncio, candidatos, panel, liberar, respaldo de taller).

## Contexto

El ADR 0026 exigía que alguien mantuviera pulsado el pulsador de salida 5 s en la puerta para vincular una placa. En la práctica estorba: la placa ya está conectada y en línea, el instalador no siempre tiene el pulsador cableado, y para probar en banco hay que puentear IO12 a GND a mano.

Además, ese pulsador nunca fue una barrera que el servidor pudiera comprobar. `POST /dispositivos/confirmar` solo verifica `(mac, clave)` y la ventana abierta: quien conoce la MAC (pública) puede anunciar su propia clave y llamar a `confirmar` dentro de la ventana. El botón protegía solo a la placa legítima, no al servidor.

## Decisión

1. **El anuncio vincula.** Si el super admin pidió vincular la placa (ventana de 10 minutos abierta) y el candidato que se anuncia pasa las guardas del §2, `POST /dispositivos/anunciar` crea el dispositivo con la clave de ese candidato y responde `{ estado: "vinculado", dispositivo_id }`. El firmware publicado ya procesa esa respuesta (guarda el id), así que no hay que recargar placas.
2. **Guardas del candidato** (una sola implementación, `solicitud-de-vinculo.ts`, que usan `/anunciar` y `/confirmar`):
   - **Único y activo.** Es el único candidato vivo de la MAC anunciado en los últimos 90 s (la placa real repite el suyo cada 30 s). Con dos o más no se vincula ninguna: no hay forma de saber cuál es la real.
   - **Previo a la solicitud.** Su primer anuncio es anterior al momento en que el super admin pidió el vínculo: el super admin vincula una placa que ya vio en el panel, y un candidato nuevo que aparece después no lo es.
   - **Atómica.** La comprobación se repite dentro de la transacción de creación, con la fila de la placa y los candidatos bloqueados (`FOR UPDATE`): nadie inserta otro candidato entre contar y crear.
   - **Solicitud intacta.** Con la fila bloqueada se comparan ventana, cuenta, puerta, nombre, sentido y solicitante con lo que se validó; si el super admin canceló o cambió la solicitud, no se crea nada.
3. **Respuestas.** En `/anunciar`, cualquier rechazo (candidato dudoso, plan, puerta, ventana) responde `detectada`, sin decirle a una ruta anónima qué falló. En `/confirmar`, el candidato dudoso es el 401 uniforme `dispositivo.anuncio_invalido` y cuenta contra los límites por IP y por MAC. El argon2id se calcula al final, solo si cuenta, plan y puerta ya validaron, para que un anónimo no lo dispare gratis.
4. **Tope de candidatos.** El máximo de 5 cuenta solo candidatos activos: cinco claves falsas ya envejecidas no dejan sin vincular a la placa real.
5. **`confirmar` se conserva** para las placas con firmware anterior, que lo llaman al recibir `confirmar` (ADR 0005); el servidor ya no responde ese estado. Con las guardas del §2 deja de ser el atajo que antes saltaba la única defensa.
6. **Panel y documentación:** el diálogo ya no pide pulsar nada; indica que la placa se vincula sola en su próximo anuncio.

## Riesgos aceptados

- **Se pierde la prueba de presencia física.** Antes tampoco la comprobaba el servidor (el pulsador era una convención del firmware), pero era un paso humano más. Ahora un atacante que conoce la MAC no puede quedarse con el vínculo mientras la placa real siga anunciándose, pero sí puede **impedirlo** anunciándose de forma sostenida (dos candidatos activos: no se vincula ninguno). Es una denegación, no una toma.
- **Caso residual:** si la placa real lleva más de 90 s callada cuando el super admin pide el vínculo y un candidato falso ya existía antes de la solicitud, ese falso sería el único activo. Se acepta porque el super admin solo vincula placas que ve **en línea** en el panel.
- **Mitigaciones que se mantienen:** solo el super admin abre la ventana, de 10 minutos; el panel muestra MAC, IP pública y último contacto; los límites de anuncios por IP y por MAC y de placas nuevas por IP; los demás candidatos se descartan al vincular.

## Alternativas descartadas

- **Mantener el pulsador:** la fricción no compensa, y el servidor no podía comprobarlo.
- **Elegir el candidato en el panel:** exige una migración y una pantalla nuevas; con el candidato único activo se cubre el caso real sin ellas. Puede añadirse si aparecen anuncios hostiles.

## Consecuencias

- **API:** `anunciar-placa` crea el dispositivo; `confirmar-placa` queda como compatibilidad. Sin migración.
- **Firmware:** sin cambios; el estado `confirmar` y la lectura del pulsador de 5 s quedan sin uso y pueden retirarse en una versión posterior.
- **Tests prioritarios:** el anuncio vincula con la ventana abierta; sin ventana nunca vincula; dos candidatos activos no vinculan, ni por `/anunciar` ni por `/confirmar`; un falso viejo no estorba; un candidato posterior a la solicitud no vincula aunque esté solo; el tope cuenta solo activos; un cambio de solicitud a mitad del vínculo no crea el dispositivo con la vieja.
