# ADR 0026 — Vinculación automática de placas con confirmación física

**Estado:** Propuesta (2026-10-14) · Reemplaza el §2 y el §8 del ADR 0025 (código de vinculación por placa y alta manual) y mantiene el resto (clave generada por la placa, dispositivo = placa asignada a una puerta, liberar, solo Ethernet).

## Contexto

El ADR 0025 exige un paso de taller por placa: leer la MAC, registrarla en el panel, copiar el código de 16 caracteres, cargarlo por serie y reiniciar. Es lento, exige conocimientos técnicos y no escala. Además, con la API en la nube y el panel en otro sitio, cualquier paso que requiera un cable USB junto a un computador no sirve para una instalación en campo.

Objetivo: **todas las placas iguales, sin nada que cargar**. Se enchufa el cable de red y la corriente, la placa aparece sola en el panel y AGROCOM la vincula.

El riesgo que el código por placa cubría: la MAC es pública y falsificable, así que cualquiera podría presentarse como una placa ajena y recibir su vínculo (invariante 5). Se reemplaza por una **prueba de presencia física**: quien vincula demuestra que tiene la mano sobre la placa que está en la puerta.

## Decisión

1. **Un solo binario para todas las placas**, sin código ni secreto por placa. Se elimina `placas.codigo_hash` y el comando `set codigo`.
2. **Anuncio.** Sin vínculo, la placa sortea su clave (32 bytes, `esp_random()`, NVS; ADR 0025 §4) y cada 30 s llama a `POST /api/v1/dispositivos/anunciar` con `{ mac, clave, firmware_version }`, sin autenticación. El servidor crea o actualiza una fila de **`placas` en estado `detectada`** (sin `tenant_id`) guardando `argon2id(clave)` por cada pareja `(mac, clave)`: una misma MAC puede tener varios candidatos, y solo uno es el real.
3. **Panel.** El super admin ve las placas detectadas con MAC, IP pública, versión y último contacto, y las vincula eligiendo cuenta, sitio, puerta y nombre (como hoy). Al pulsar **Vincular** la placa pasa a `por_confirmar` con una ventana de 10 minutos; todavía no existe el dispositivo.
4. **Confirmación física.** En su siguiente sondeo, la placa recibe `estado: "confirmar"` y lo anuncia con el LED azul parpadeando lento y un beep cada 2 s. El instalador mantiene **pulsado el pulsador de salida 5 s**; la placa llama a `POST /dispositivos/confirmar` con `{ mac, clave }`. Solo entonces el servidor crea el `dispositivo` con la clave de **esa** pareja `(mac, clave)`, revoca los demás candidatos de esa MAC y responde `vinculado`. Un atacante que solo conoce la MAC puede anunciarse, pero nunca confirmar: no tiene la mano en el pulsador. Si la ventana vence, la placa vuelve a `detectada`.
5. **El pulsador sigue siendo apertura física.** Mantenerlo 5 s solo cuenta como confirmación si la placa está en `confirmar`; en cualquier otro estado conserva su función (invariante 2).
6. **Higiene del inventario** (el endpoint es anónimo y crea filas):
   - límite de anuncios por IP y por MAC, con `429` creciente;
   - máximo de candidatos por MAC (5) y de placas `detectadas` sin vincular por IP;
   - las `detectadas` sin contacto en 7 días se dan de baja (soft delete); el panel permite descartar a mano.
7. **Liberar** funciona igual que en el ADR 0025 §7 (la placa borra id y clave, sortea otra y vuelve a anunciarse). Pasa a `detectada`; para otra cuenta se repite la confirmación física.
8. **Respaldo de taller:** el alta manual por serie (`set disp_id` y `set disp_clave`) se mantiene para mesa de trabajo y recuperación; la compilación de producción no cambia.

## Alternativas descartadas

- **Código por placa impreso o flasheado** (ADR 0025): correcto en seguridad, pero un paso manual por placa.
- **MAC sola**: reclamable por cualquiera sin presencia física.
- **Flasheo desde el panel con Web Serial** (ESP Web Tools): solo sirve con alguien junto a la placa y un navegador; no escala a instalaciones remotas. Puede añadirse como herramienta de taller sin cambiar este diseño.
- **Código de confirmación mostrado en el panel y tecleado en la placa**: la placa no tiene teclado ni pantalla.
- **Confirmación por la app del instalador**: contradice que AGROCOM vincula (ADR 0025).

## Consecuencias

- **Migración** nueva sobre `placas`: estado `detectada | por_confirmar | vinculada`, `por_confirmar_hasta`, múltiples candidatos por MAC (la unicidad pasa a `(mac, clave_hash)` entre filas activas), se retira `codigo_hash`.
- **API:** `POST /dispositivos/anunciar` y `POST /dispositivos/confirmar` (sin contexto de cuenta; revisión línea por línea, como la autenticación de dispositivos) reemplazan a `reclamar`. El `reclamar` actual se retira dentro de la misma versión solo si el firmware publicado aún no lo usa; si no, se mantiene deprecado (ADR 0005). `vincular` pasa a abrir la ventana de confirmación y la creación del dispositivo ocurre en `confirmar`; el plan sigue verificándose en ambos puntos.
- **Firmware:** quitar el código de la NVS y de la consola, agregar estado `confirmar` con su indicación y la lectura del pulsador de 5 s (no bloqueante); falla segura intacta: sin vínculo no valida ningún QR.
- **Panel web:** la lista de placas pasa a mostrar las detectadas y un estado "Esperando confirmación en la puerta" con cuenta atrás; desaparece el alta con código.
- **Riesgos aceptados:** un anuncio falso solo ensucia el inventario (acotado por el §6); un instalador con acceso físico a la placa y la ventana abierta puede confirmarla, que es lo esperado.
- **Tests prioritarios:** confirmar sin ventana abierta, confirmar con una clave de otro candidato, dos candidatos para la misma MAC (solo vincula el que confirma), ventana vencida, límites de anuncios, liberar y reanunciar, que el pulsador fuera de `confirmar` no confirma, y que ni la clave ni el estado lleguen a un log.
- **Orden de trabajo:** migración y API, firmware, panel web, documentación de hardware.
