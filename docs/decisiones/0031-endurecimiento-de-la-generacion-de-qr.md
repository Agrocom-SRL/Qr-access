# ADR 0031 — Endurecimiento de la generación de QR

**Estado:** Aceptada (2026-10-23), con los puntos 7, 8, 12 y 13 diferidos (futuro) y los descartados indicados abajo. Complementa el ADR 0030 (topes, abuso y notificaciones) y el ADR 0008 (diseño del QR). Decididos con Miguel: los puntos 0, 1, 2 y 11 (con las precisiones de abajo); el 15 (descartado) y el 18 (reemplazado por el estado de las placas y la confirmación de apertura, §E). Los puntos 5 y 6 (ventana de activación y franja horaria) se descartaron: la vida de un QR es solo su vencimiento. El resto sigue como propuesta y no se implementa sin su visto bueno.

## Contexto

El ADR 0030 limita *cuántos* QR se generan. Falta endurecer *cómo* se generan, se comparten y se revocan: un QR viaja como imagen por WhatsApp, se puede reenviar o fotografiar, y su generador puede dejar de ser de confianza (baja, PIN filtrado, sesión robada). Estas medidas no cambian la regla de oro: la puerta abre solo con validación positiva del servidor (invariante 2) y un QR sirve una vez (invariante 3).

## Propuestas

### A. Revocación y ciclo de vida

0. **Estados (vocabulario único).** Los estados de un usuario o de una cuenta se llaman **restringido**, **suspendido** y **eliminado** (ADR 0033 §1; «bloqueado» queda para el bloqueo del login por intentos, «anulado» para el QR y «cancelado» para la suscripción). Los dos primeros son los niveles de baja:
   - **Restringido (nivel leve):** conserva sus sesiones abiertas, entra a la app y consulta, pero no puede generar QR (código `qr.generacion_restringida`). **Sus QR ya generados siguen vivos** y abren hasta su vencimiento, bajo las mismas reglas de vida del QR (confirmado por Miguel). Es el nivel *leve*. Aplica igual a una cuenta: una cuenta restringida no genera, pero lo ya generado sirve.
   - **Suspendido (nivel crítico):** se cierran sus sesiones, se anulan sus QR vigentes y se suspende toda la actividad de su rama (o de toda la cuenta, si se suspende la cuenta). Para la validación, el generador suspendido, o uno cuyo superior lo está, no abre.
1. **[Aprobado] Revocación en cascada.** Al dar de baja o **suspender** a un usuario, regenerar su PIN, cerrar todas sus sesiones o quitarle el rol, se anulan sus QR vigentes en la misma transacción (bitácora incluida). **Un superior arrastra a su rama:** suspender o dar de baja a un Administrador alcanza a sus Titulares, Guardias y Miembros y a todos sus QR (consistente con la baja en cascada del ADR 0028); un Titular alcanza a sus Miembros. **Suspender la cuenta** alcanza a todos sus usuarios; reactivarla no revive los QR anulados: se generan de nuevo. La restricción (0) no cierra sesiones.
2. **[Aprobado] La validación comprueba al generador.** Al validar, además de lo del ADR 0008 §4, el usuario que generó el QR y **todos sus superiores** deben estar activos o restringidos (no suspendidos ni eliminados), y la cuenta no suspendida. Es defensa en profundidad de (1): cubre cualquier camino que olvide anular. Un QR de generador suspendido responde `qr.generador_suspendido` y queda en el registro.
3. **[Aceptado] Anulación masiva a pedido.** "Anular todos mis QR vigentes" (usuario) y "anular todos los QR vigentes de este usuario/cuenta" (Administrador y AGROCOM): respuesta rápida ante un PIN filtrado o una sesión robada. **Implementado en la ola W11** (`POST /api/v1/qr-accesos/anulacion-masiva`, con alcance por el árbol del ADR 0028 y motivo en la bitácora): contrato en el ADR 0033 §4. La anulación por AGROCOM de una cuenta sigue siendo suspenderla (ADR 0031 §1).
4. **[Aceptado, unido al punto 0] Cuenta restringida.** Es el nivel leve aplicado a una cuenta: un interruptor de AGROCOM que impide generar sin tocar la validación (ADR 0030 §1); sirve para el abuso comprobado mientras se negocia.

### B. Forma del QR

5. ~~Ventana de activación (`valido_desde`).~~ **Descartado** (2026-10-23): el tiempo de vida de un QR es uno solo, hasta su `vence_at`. No hay «desde cuándo»; un QR de un solo uso que se lee antes de la hora prevista se consume y deja de servir, y quien lo generó decide cuándo enviarlo y con qué vigencia.
6. ~~Franja horaria dentro del día.~~ **Descartado** por el mismo motivo que el 5.
7. **[Futuro] Vigencia por puerta sensible.** Una puerta puede marcarse como sensible: vigencia máxima más corta y/o etiqueta obligatoria. El máximo efectivo es el menor entre plan, cuenta y puerta.
8. **[Futuro] Etiqueta obligatoria por política de cuenta.** Si la cuenta lo activa, el QR no se genera sin nombre del visitante (o placa del vehículo). La etiqueta se normaliza, se limita de largo y se escapa al mostrarla; entra a la bitácora y se ve en `eventos_acceso` para trazabilidad.
9. **[Aceptado] Límite de puertas por QR.** Tope de puertas por QR (por ejemplo, 10) para que un solo token no sea una llave maestra; configurable por plan.
10. **[Aceptado] Versión del formato.** El prefijo `AQ1.` ya versiona el texto; el lector y el servidor rechazan versiones desconocidas con `qr.formato_invalido`, lo que permite pasar a `AQ2.` sin ambigüedad.

### C. Generación robusta

11. **[Aprobado] Idempotencia con caché en la app.** `POST /qr-accesos` acepta `Idempotency-Key`: un reintento por mala red devuelve el mismo QR y no consume cupo dos veces. La clave se guarda hasheada, con vencimiento corto, dentro de la cuenta. La app guarda en una caché local la solicitud pendiente (con su clave) y reintenta sola, sin que el usuario repita el gesto (ADR 0027). La clave se descarta cuando llega la respuesta o vence.
12. **[Futuro] Reautenticación para acciones de riesgo.** Pedir el PIN de nuevo (o una sesión reciente) para generar QR a puertas sensibles o más de N en una hora. Frena el uso de una sesión robada.
13. **[Futuro] Aprobación.** En puertas sensibles, el QR de un Miembro queda "pendiente" hasta que su Titular lo apruebe. Solo si el cliente lo pide; se documenta aquí para no perder la idea.
14. **[Aceptado] Generación solo desde sesión vigente y con suscripción vigente** (ya vigente); se agrega a los tests de abuso del ADR 0030 que un token de acceso de una sesión revocada no genera.

### D. Compartir y exposición

15. ~~El QR propio no se captura.~~ **Descartado** (2026-10-23): el QR que genera un usuario es su responsabilidad, y la bitácora deja constancia de quién lo creó (§Descartadas).
16. ~~Imagen compartida con vencimiento visible.~~ **Descartado** junto con el 15 (§Descartadas).
17. **[Aceptado] Sin enlaces públicos.** No se ofrece un enlace web al QR: un enlace es un segundo token que expondría el primero. Se mantiene el envío de imagen.

### E. Detección en la puerta

18. **Estado de las placas y confirmación de apertura** (reemplaza a la «ráfaga de tokens desconocidos»; lo que ocurra fuera de lo que la placa reporta queda fuera de nuestro alcance):
    - **Reintento de la placa:** si pierde la red, reintenta conectarse cada cierto lapso (ya lo hace el firmware); no se alarma por una caída corta.
    - **Estados derivados en el servidor** (solo lectura, en el panel de AGROCOM; la app de la cuenta sigue viendo solo en línea o no):

      | Estado | Regla | Qué pasa |
      |---|---|---|
      | **En línea** | último latido ≤ 180 s (ADR 0009, `estaEnLinea`) | Normal |
      | **Sin conexión** | sin latido entre 180 s y 15 min | Se muestra en el panel; **sin aviso**: un corte breve de red o energía se resuelve solo |
      | **Caída sostenida** | sin latido por **15 min** | Notificación a AGROCOM y al propietario de la cuenta: la puerta no lee QR (solo pulsador y llave) y conviene revisar el enlace o la energía a distancia |
      | **Desaparecida** | sin latido por **2 h** | Segunda notificación, a AGROCOM: «revisar físicamente la placa de la puerta X». Otra al recuperarse |
      | **En observación** | en línea, pero **sin ninguna lectura en 24 h** en la puerta | Marca informativa en el panel, sin aviso; el umbral es un día por omisión, configurable por puerta (una puerta de poco tráfico es normal) |
      | **Lector sin respuesta** | el latido informa que el lector QR no responde por UART | Aviso a AGROCOM tras unos minutos (no 24 h): la puerta no puede leer |

      Los umbrales de 15 min y 2 h son de partida y se ajustan con datos reales (configuración de plataforma, ADR 0030 §7). Si varias placas del mismo sitio o cuenta caen a la vez, es un corte común (red o energía): se envía **un solo aviso agrupado** por sitio, no uno por placa. El aviso se emite una vez por escalón y se cierra al recuperarse. Una placa que nunca envió un latido (recién instalada) no genera aviso.
    - **Latido ampliado:** además de `puertaAbierta`, el firmware reporta si el lector QR responde y el estado del sensor de puerta, si está instalado. Es diagnóstico; no decide nada.
    - **Confirmación de apertura:** hoy el firmware solo da un pulso al relé con un `delay`. Tras un `abrir: true`, la placa, si tiene sensor de puerta (contacto magnético, `docs/hardware/README.md`), informa si la puerta **efectivamente se abrió** en unos segundos. El servidor guarda una fila aparte enlazada al intento (`confirmaciones_apertura`: `confirmada`, `no_confirmada` o `sin_sensor`), sin editar el intento (solo inserción, invariante 4). El panel muestra el éxito o la falla de la ejecución. Repetirse `no_confirmada` (puerta trabada, relé, riel o cerradura sin respuesta) dispara una notificación a AGROCOM; un caso aislado no. Sin sensor queda `sin_sensor`: no se inventa un éxito.
    - **Implementado en la ola W10 (parte 1, API).** Con las cláusulas de este punto tomadas como aceptadas por indicación de Miguel, más sus supuestos:
      - **Vocabulario:** el servidor guarda `ejecutada` / `fallida` / `sin_confirmacion` con una `causa` (equivale a `confirmada` / `no_confirmada` / `sin_sensor` de arriba; `sin_confirmacion` también cubre la placa con sensor que no contestó). Ficha `docs/modelo-datos/tablas/32_confirmaciones_apertura.md`; contrato de la placa en `docs/hardware/README.md`.
      - **Sensor por configuración, no por detección:** `dispositivos.sensor_instalado` (por omisión 0) y `sensor_abierto_nivel` (por omisión `alto`) se fijan por dispositivo (`PUT /plataforma/placas/{id}/sensor`) porque la polaridad del reed y el cableado real **no están confirmados**; hasta habilitarlo, la placa informa `sin_sensor` y no se inventa ni un éxito ni una falla. Al habilitarlo se guarda `sensor_habilitado_at`: el detector solo juzga aperturas por QR ordenadas desde ese instante (no hay fallas retroactivas), y la constancia `sin_respuesta` se sella con la orden + el plazo, no con la hora de la pasada. Con el sensor habilitado, un informe `sin_sensor` cuenta como falla; las fallas de dispositivos sin sensor se ignoran.
      - **Límites conocidos (auditoría W10):** `ejecutada` es lo que informa la propia placa con su sensor: un sensor trabado o un firmware que miente produce un éxito falso que el servidor no puede detectar. El orden para decidir «desde la última apertura ejecutada» usa `registrada_at` (hora del servidor), no `ocurrido_at`. Todavía no hay política de retención para `confirmaciones_apertura` (pendiente; ver ficha 32 y duda D-06).
      - **Aviso `apertura.fallida`** (supuestos W10, editables en `configuracion_limites`): se abre cuando una puerta acumula **2** fallas en **60 min** (desde su última apertura ejecutada); un caso aislado no avisa. Una falla es un informe `fallida` o la falta de informe de una placa con sensor tras **90 s**. Un aviso por sitio, severidad `aviso`, para el Administrador de la cuenta y para AGROCOM, que se cierra cuando ninguna puerta del sitio sigue fallando. Si Miguel quiere avisar de CADA falla basta fijar `apertura.fallidas_minimo = 1`.
      - **Visible en el panel sin esperar al aviso:** `ejecucion` (`ejecutada`, `fallida`, `sin_confirmacion` o `null`) en el listado y el detalle de eventos de acceso y en el panel de plataforma (con filtro `ejecucion=fallida`), y `apertura_fallida` / `sensor_puerta` en el inventario de placas.
      - Una confirmación se acepta hasta 10 min después de la orden y solo de la placa que ejecutó esa apertura; una tardía manda sobre la constancia `sin_respuesta` del servidor.
    - **Cuánto tiempo queda abierta la puerta:** decisión abierta. Por ahora lo controla una persona (guardia) y el sistema no lo mide; si más adelante se quiere («puerta abierta demasiado tiempo»), el sensor ya aportaría el dato.
    - El firmware sigue sin lógica de negocio: lee pines y reporta; que la apertura sea válida lo decide siempre el servidor.
19. **[Aceptado] Contador de rechazos por motivo** en las estadísticas de la cuenta (`qr.usado`, `qr.vencido`, `qr.otra_puerta`): muchos `qr.usado` repetidos sugieren QR reenviados o compartidos.
    - **Implementado en la ola W12 (señal `qr_reenviado`).** La tarea `senal-qr-reenviado` cuenta los rechazos `qr.usado` por QR (todas las filas, repeticiones de la ola W7 incluidas, ADR 0032 §4.3) y los **lectores** distintos que los vieron; abre un incidente `qr_reenviado` del sistema y avisa (ADR 0030, «Implementado (ola W12)»). Un lector que relee un QR usado frente a una persona no dispara: hacen falta lectores distintos, o una insistencia del triple del mínimo (solo constancia baja). No mira IP ni instalaciones (no existen para un rechazo de lector).
20. **[Aceptado] Reloj único.** La hora que cuenta es la del servidor; el firmware no evalúa vencimientos ni ventanas (el firmware lee, pregunta y obedece).

## Descartadas

- **El QR propio no se captura (`FLAG_SECURE`)** y la **imagen con vencimiento visible como medida antifraude**: lo que se haga con un QR es responsabilidad de quien lo generó; la trazabilidad la da la bitácora (invariante 9) y el registro de accesos.
- **Ráfaga de `qr.desconocido` por lector:** depende del equipo físico. Se reemplaza por el estado de las placas (punto 18).
- **Ventana de activación y franja horaria** (puntos 5 y 6): no existe un «desde»; la vigencia de un QR es solo su vencimiento.
- **QR de varios usos o permanente:** contradice la invariante 3. Quien entra a menudo usa el QR propio, que se reutiliza mientras no se use (ADR 0030 §2.1).
- **Datos firmados dentro del QR** para validar sin red: contradice la invariante 2 y el ADR 0008.
- **Enlace web compartible** (punto 17): amplía la superficie sin necesidad.

## Consecuencias

- **Modelo de datos:** columnas `sensible` (puertas) e `idempotency_key_hash`, tabla `confirmaciones_apertura` y campos de diagnóstico del latido (lector, sensor); cada una con su migración (ADR 0011) y sus tests de aislamiento.
- **API (compatible, ADR 0005):** códigos `qr.formato_invalido`, `qr.etiqueta_requerida`, `qr.limite_puertas`, `sesion.reautenticacion_requerida`; encabezado `Idempotency-Key`. Los textos van en los ARB y en `web/src/l10n/`.
- **Firmware:** latido ampliado (lector y sensor) y reporte de confirmación de apertura; sigue sin evaluar nada del QR. La lectura del sensor es un cambio nuevo y se prueba en `pio test -e native`.
- **Tests obligatorios:** baja de usuario anula sus QR; QR de un generador inactivo no abre; una apertura `no_confirmada` no edita el intento y queda enlazada; un reintento idempotente no duplica ni consume cupo; cuenta A no ve ni anula QR de B (404).
- **Orden sugerido:** (1, 2) → (11) → (18); el resto, según prioridad del cliente.
