-- Catálogo de permisos (ADR 0004 §5). Idempotente: se puede correr las veces que haga falta, en
-- cualquier entorno (también producción). Un permiso nuevo se agrega acá, nunca a mano.
-- Código: <modulo>.<entidad>.<accion>. Ámbito: 'cuenta' o 'plataforma'.
-- Los tests cargan este mismo archivo: cada sentencia termina en ';' al final de una línea.

-- Sin esto, un cliente `mysql` en latin1 guarda 'Lucía' como 'LucÃ­a' (doble codificación).
SET NAMES utf8mb4;

INSERT INTO permisos (codigo, ambito) VALUES
  ('organizacion.puerta.ver', 'cuenta'),
  ('organizacion.puerta.supervisar', 'cuenta'),
  ('organizacion.sitio.administrar', 'cuenta'),
  ('organizacion.puerta.administrar', 'cuenta'),
  ('organizacion.guardia.asignar', 'cuenta'),
  ('accesos.qr.generar', 'cuenta'),
  ('accesos.qr.generar_propio', 'cuenta'),
  ('accesos.qr.ver', 'cuenta'),
  ('accesos.qr.ver_todos', 'cuenta'),
  ('accesos.qr.anular', 'cuenta'),
  ('accesos.qr.anular_todos', 'cuenta'),
  ('accesos.evento.ver', 'cuenta'),
  ('accesos.evento.ver_todos', 'cuenta'),
  ('accesos.evento.ver_asignadas', 'cuenta'),
  ('seguridad.usuario.ver', 'cuenta'),
  ('seguridad.usuario.crear', 'cuenta'),
  ('seguridad.usuario.editar', 'cuenta'),
  ('seguridad.usuario.eliminar', 'cuenta'),
  ('seguridad.usuario.restringir', 'cuenta'),
  ('seguridad.usuario.suspender', 'cuenta'),
  ('accesos.qr.anular_masivo', 'cuenta'),
  ('accesos.evento.exportar', 'cuenta'),
  ('seguridad.incidente.ver', 'cuenta'),
  ('seguridad.incidente.resolver', 'cuenta'),
  ('seguridad.cupo.ver', 'cuenta'),
  ('seguridad.estadistica.ver', 'cuenta'),
  ('notificaciones.aviso.ver', 'cuenta'),
  ('notificaciones.aviso.gestionar', 'cuenta'),
  ('seguridad.equipo.ver', 'plataforma'),
  ('seguridad.equipo.crear', 'plataforma'),
  ('seguridad.equipo.editar', 'plataforma'),
  ('seguridad.equipo.desactivar', 'plataforma'),
  ('seguridad.cuenta.ver', 'plataforma'),
  ('seguridad.cuenta.crear', 'plataforma'),
  ('seguridad.cuenta.editar', 'plataforma'),
  ('seguridad.cuenta.eliminar', 'plataforma'),
  ('seguridad.cuenta.cambiar_codigo', 'plataforma'),
  ('organizacion.sitio.gestionar', 'plataforma'),
  ('organizacion.puerta.gestionar', 'plataforma'),
  ('seguridad.administrador.regenerar_pin', 'plataforma'),
  ('seguridad.administrador.crear', 'plataforma'),
  ('seguridad.administrador.reasignar', 'plataforma'),
  ('bitacora.registro.ver', 'plataforma'),
  ('resumen.panel.ver', 'plataforma'),
  ('suscripciones.suscripcion.ver', 'plataforma'),
  ('suscripciones.suscripcion.editar', 'plataforma'),
  ('suscripciones.pago.registrar', 'plataforma'),
  ('suscripciones.cobranza.ver', 'plataforma'),
  ('suscripciones.plan.ver', 'plataforma'),
  ('suscripciones.plan.crear', 'plataforma'),
  ('suscripciones.plan.editar', 'plataforma'),
  ('suscripciones.plan.eliminar', 'plataforma'),
  ('suscripciones.cobro.ver', 'plataforma'),
  ('suscripciones.cobro.crear', 'plataforma'),
  ('suscripciones.cobro.editar', 'plataforma'),
  ('suscripciones.cobro.eliminar', 'plataforma'),
  ('dispositivos.placa.ver', 'plataforma'),
  ('dispositivos.placa.registrar', 'plataforma'),
  ('dispositivos.placa.vincular', 'plataforma'),
  ('dispositivos.placa.liberar', 'plataforma'),
  ('limites.configuracion.ver', 'plataforma'),
  ('limites.configuracion.editar', 'plataforma'),
  ('limites.consumo.ver', 'plataforma'),
  ('seguridad.senal.ver', 'plataforma'),
  ('notificaciones.aviso_plataforma.ver', 'plataforma'),
  ('notificaciones.aviso_plataforma.gestionar', 'plataforma')
ON DUPLICATE KEY UPDATE ambito = VALUES(ambito);

-- Rol de plataforma (tenant_id NULL). Sus permisos de ámbito plataforma se asignan al final de este archivo.
INSERT INTO roles (tenant_id, nombre, protegido, activo) VALUES
  (NULL, 'Super admin', 1, 1)
ON DUPLICATE KEY UPDATE protegido = VALUES(protegido), activo = 1;

-- Un único plan anual de 100 usuarios a 1000 Bs (ADR 0022). Los demás planes y los precios se crean y se editan
-- desde el panel; este seed NO pisa el precio si el plan ya existe (solo crea el que falta).
INSERT INTO planes (nombre, max_dispositivos, max_usuarios, max_vigencia_qr_horas, precio_anual, activo) VALUES
  ('100 usuarios', NULL, 100, NULL, 1000, 1)
ON DUPLICATE KEY UPDATE max_usuarios = VALUES(max_usuarios), activo = 1;

-- Topes de generación de QR (ADR 0030 §7). Los mismos valores iniciales que la migración; si AGROCOM ya editó
-- uno, este seed NO lo pisa (solo crea el que falta). Supuestos de partida: tope diario, pendientes y bolsa.
INSERT INTO configuracion_limites (clave, valor) VALUES
  ('qr.tope_diario', 100),
  ('qr.tope_pendientes', 50),
  ('qr.reemplazos_sin_uso_por_dia', 5),
  ('qr.espera_reemplazo_segundos', 120),
  ('qr.max_puertas_por_qr', 10),
  ('qr.bolsa_mensual', 5000),
  ('qr.bolsa_aviso_porcentaje', 80)
ON DUPLICATE KEY UPDATE clave = VALUES(clave);

-- Umbrales de los estados de placa (ADR 0031 §18; los 15 min y las 2 h los fija el ADR, el resto son supuestos de la
-- ola W9: recuperación sostenida de 3 min, lector sin respuesta tras 5 min y observación a las 24 h). No pisa lo
-- que AGROCOM ya haya editado.
INSERT INTO configuracion_limites (clave, valor) VALUES
  ('placa.caida_minutos', 15),
  ('placa.desaparecida_minutos', 120),
  ('placa.recuperacion_minutos', 3),
  ('placa.lector_minutos', 5),
  ('placa.observacion_horas', 24)
ON DUPLICATE KEY UPDATE clave = VALUES(clave);

-- Confirmación de apertura (ADR 0031 §18, ola W10; todos son supuestos): una placa con sensor que no confirma en 90 s
-- queda `sin_confirmacion`; desde 2 aperturas fallidas en 60 min el aviso `apertura.fallida` se abre (el ADR dice
-- «repetirse», un caso aislado no avisa; con 1 avisaría de cada falla). Se editan por la misma ruta de límites.
INSERT INTO configuracion_limites (clave, valor) VALUES
  ('apertura.plazo_confirmacion_segundos', 90),
  ('apertura.fallidas_minimo', 2),
  ('apertura.fallidas_ventana_minutos', 60)
ON DUPLICATE KEY UPDATE clave = VALUES(clave);

-- Incidentes de uso, reincidencia y política de la cuenta (ADR 0033 §4, ola W11; todos son supuestos de partida, los
-- ajusta AGROCOM): 3 incidentes CONFIRMADOS en 30 días es reincidencia; la restricción automática (nivel leve) viene
-- APAGADA (0) y se enciende por cuenta con una excepción de `incidente.restriccion_automatica` = 1. Cinco rechazos de
-- generación por tope en 24 h abren un incidente `generacion_ruidosa` del sistema. No pisa lo que AGROCOM ya editó.
INSERT INTO configuracion_limites (clave, valor) VALUES
  ('incidente.reincidencia_minimo', 3),
  ('incidente.reincidencia_ventana_dias', 30),
  ('incidente.restriccion_automatica', 0),
  ('incidente.rechazos_generacion_minimo', 5),
  ('incidente.rechazos_generacion_ventana_horas', 24)
ON DUPLICATE KEY UPDATE clave = VALUES(clave);

-- Señales de abuso (ADR 0030 §4 y §5, ola W12; todos son supuestos de partida que AGROCOM ajusta con datos reales y
-- NINGUNO limita nada: solo decide cuándo se abre un incidente y se avisa). Uso masivo: aperturas con QR propio de un
-- usuario en un día local, N por rol (el Guardia, el más bajo). Uso imposible: dos usos de un QR propio en sitios
-- distintos con menos de 10 min de diferencia, o en puertas distintas del mismo sitio con menos de 20 s (0 = no se juzga
-- el mismo sitio). Ventana de 24 h para uso imposible, QR reenviado y PIN compartido. QR reenviado: 3 rechazos
-- `qr.usado` sobre un mismo QR. PIN compartido: sesiones activas desde 4 IP distintas. Flujo atípico de la cuenta: al
-- menos 50 aperturas en el día y 25 por usuario activo. No pisa lo que AGROCOM ya haya editado.
INSERT INTO configuracion_limites (clave, valor) VALUES
  ('senal.uso_masivo_administrador', 40),
  ('senal.uso_masivo_titular', 30),
  ('senal.uso_masivo_miembro', 20),
  ('senal.uso_masivo_guardia', 12),
  ('senal.uso_imposible_entre_sitios_minutos', 10),
  ('senal.uso_imposible_entre_puertas_segundos', 20),
  ('senal.ventana_horas', 24),
  ('senal.qr_reenviado_rechazos_minimo', 3),
  ('senal.pin_compartido_ips_minimo', 4),
  ('senal.flujo_aperturas_minimo', 50),
  ('senal.flujo_aperturas_por_usuario', 25)
ON DUPLICATE KEY UPDATE clave = VALUES(clave);

-- El super admin recibe TODOS los permisos de ámbito plataforma (agrégalos en la primera lista).
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles AS r JOIN permisos AS p ON p.ambito = 'plataforma'
  WHERE r.tenant_id IS NULL AND r.nombre = 'Super admin' AND r.deleted_at IS NULL;

-- El Administrador protegido de CADA cuenta recibe todos los permisos de ámbito cuenta, también los que se
-- agregan después de crear la cuenta (las cuentas nuevas los copian de ROLES_BASE al crearse).
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles AS r JOIN permisos AS p ON p.ambito = 'cuenta'
  WHERE r.tenant_id IS NOT NULL AND r.protegido = 1 AND r.nombre = 'Administrador' AND r.deleted_at IS NULL;

-- Los guardias ven los eventos de las puertas que se les asignan, no los de toda la cuenta: el rol base
-- "Guardia" (no protegido) cambia `ver_todos` por `ver_asignadas`. Un rol propio de la cuenta no se toca.
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles AS r JOIN permisos AS p ON p.codigo = 'accesos.evento.ver_asignadas'
  WHERE r.tenant_id IS NOT NULL AND r.protegido = 0 AND r.nombre = 'Guardia' AND r.deleted_at IS NULL;
DELETE rp FROM rol_permisos AS rp
  JOIN roles AS r ON r.id = rp.rol_id AND r.tenant_id IS NOT NULL AND r.protegido = 0 AND r.nombre = 'Guardia'
  JOIN permisos AS p ON p.id = rp.permiso_id AND p.codigo = 'accesos.evento.ver_todos';

-- Roles por nivel (ADR 0028). Una cuenta anterior al árbol tiene "Usuario" en lugar de "Miembro" y no tiene
-- "Titular": se renombra (UPDATE IGNORE no pisa una cuenta que ya tenga un "Miembro") y se crea el rol que falta.
UPDATE IGNORE roles SET nombre = 'Miembro'
  WHERE tenant_id IS NOT NULL AND protegido = 0 AND nombre = 'Usuario' AND deleted_at IS NULL;

INSERT INTO roles (tenant_id, nombre, protegido, activo)
  SELECT c.id, 'Titular', 0, 1 FROM cuentas AS c WHERE c.deleted_at IS NULL
ON DUPLICATE KEY UPDATE activo = 1;

-- El Titular tiene lo del Miembro y además crea, edita, restringe, suspende y elimina a sus Miembros
-- (ADR 0033 §3). Solo se agregan permisos al rol base: un permiso que la cuenta le haya quitado a mano no se
-- vuelve a poner si ya existía la fila borrada.
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles AS r
  JOIN permisos AS p ON p.codigo IN (
    'organizacion.puerta.ver', 'accesos.qr.generar', 'accesos.qr.ver', 'accesos.qr.anular', 'accesos.evento.ver',
    'seguridad.usuario.ver', 'seguridad.usuario.crear', 'seguridad.usuario.editar', 'seguridad.usuario.eliminar',
    'seguridad.usuario.restringir', 'seguridad.usuario.suspender'
  )
  WHERE r.tenant_id IS NOT NULL AND r.protegido = 0 AND r.nombre = 'Titular' AND r.deleted_at IS NULL;

-- Guardia y QR (ADR 0028 §5): el Guardia solo genera su QR propio (`generar_propio`), no QR de visitas
-- (`generar`). Los demás roles base ya tenían `generar` y reciben también `generar_propio`. Solo roles base
-- (no protegidos, por nombre): el Administrador lo recibe arriba con el resto de los permisos de cuenta.
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles AS r JOIN permisos AS p ON p.codigo = 'accesos.qr.generar_propio'
  WHERE r.tenant_id IS NOT NULL AND r.protegido = 0 AND r.nombre IN ('Guardia', 'Titular', 'Miembro')
    AND r.deleted_at IS NULL;
DELETE rp FROM rol_permisos AS rp
  JOIN roles AS r ON r.id = rp.rol_id AND r.tenant_id IS NOT NULL AND r.protegido = 0 AND r.nombre = 'Guardia'
  JOIN permisos AS p ON p.id = rp.permiso_id AND p.codigo = 'accesos.qr.generar';

-- Anulación masiva e incidentes (ADR 0033 §3, ola W11). Cada nivel actúa solo dentro de su rama (el alcance lo impone
-- la API con el árbol del ADR 0028, no el permiso): `anular_masivo` lo tienen los cuatro roles base (el Miembro y el
-- Guardia, solo sobre lo propio), `incidente.ver` también (cada uno ve los de su alcance) y `incidente.resolver` el
-- Titular (los de sus Miembros). El Administrador recibe todos arriba. Exportar es solo del Administrador.
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles AS r
  JOIN permisos AS p ON p.codigo IN ('accesos.qr.anular_masivo', 'seguridad.incidente.ver')
  WHERE r.tenant_id IS NOT NULL AND r.protegido = 0 AND r.nombre IN ('Titular', 'Miembro', 'Guardia')
    AND r.deleted_at IS NULL;
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles AS r JOIN permisos AS p ON p.codigo = 'seguridad.incidente.resolver'
  WHERE r.tenant_id IS NOT NULL AND r.protegido = 0 AND r.nombre = 'Titular' AND r.deleted_at IS NULL;
