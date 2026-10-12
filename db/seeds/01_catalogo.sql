-- Catálogo de permisos (ADR 0004 §5). Idempotente: se puede correr las veces que haga falta, en
-- cualquier entorno (también producción). Un permiso nuevo se agrega acá, nunca a mano.
-- Código: <modulo>.<entidad>.<accion>. Ámbito: 'cuenta' o 'plataforma'.
-- Los tests cargan este mismo archivo: cada sentencia termina en ';' al final de una línea.

INSERT INTO permisos (codigo, ambito) VALUES
  ('organizacion.puerta.ver', 'cuenta'),
  ('organizacion.puerta.supervisar', 'cuenta'),
  ('accesos.qr.emitir', 'cuenta'),
  ('accesos.qr.ver', 'cuenta'),
  ('accesos.qr.ver_todos', 'cuenta'),
  ('accesos.qr.anular', 'cuenta'),
  ('accesos.qr.anular_todos', 'cuenta'),
  ('accesos.evento.ver', 'cuenta'),
  ('accesos.evento.ver_todos', 'cuenta'),
  ('seguridad.usuario.ver', 'cuenta'),
  ('seguridad.usuario.crear', 'cuenta'),
  ('seguridad.usuario.editar', 'cuenta'),
  ('seguridad.usuario.eliminar', 'cuenta'),
  ('seguridad.equipo.ver', 'plataforma'),
  ('seguridad.equipo.crear', 'plataforma'),
  ('seguridad.equipo.desactivar', 'plataforma'),
  ('seguridad.cuenta.ver', 'plataforma'),
  ('seguridad.cuenta.crear', 'plataforma'),
  ('seguridad.cuenta.editar', 'plataforma'),
  ('seguridad.cuenta.eliminar', 'plataforma'),
  ('seguridad.cuenta.cambiar_codigo', 'plataforma'),
  ('organizacion.sitio.gestionar', 'plataforma'),
  ('organizacion.puerta.gestionar', 'plataforma'),
  ('seguridad.administrador.regenerar_pin', 'plataforma'),
  ('bitacora.registro.ver', 'plataforma'),
  ('resumen.panel.ver', 'plataforma'),
  ('suscripciones.suscripcion.ver', 'plataforma'),
  ('suscripciones.suscripcion.editar', 'plataforma'),
  ('suscripciones.pago.registrar', 'plataforma'),
  ('suscripciones.cobranza.ver', 'plataforma'),
  ('suscripciones.plan.ver', 'plataforma'),
  ('suscripciones.plan.crear', 'plataforma'),
  ('suscripciones.plan.editar', 'plataforma'),
  ('suscripciones.plan.eliminar', 'plataforma')
ON DUPLICATE KEY UPDATE ambito = VALUES(ambito);

-- Rol de plataforma (tenant_id NULL). Sus permisos de ámbito plataforma se asignan al final de este archivo.
INSERT INTO roles (tenant_id, nombre, protegido, activo) VALUES
  (NULL, 'Super admin', 1, 1)
ON DUPLICATE KEY UPDATE protegido = VALUES(protegido), activo = 1;

-- Los tres planes anuales por cupo de usuarios (ADR 0022). Los precios son de ejemplo: se editan desde el panel
-- y este seed NO los pisa si ya existen (solo crea los planes que faltan).
INSERT INTO planes (nombre, max_dispositivos, max_usuarios, max_vigencia_qr_horas, precio_anual, activo) VALUES
  ('100 usuarios', NULL, 100, NULL, 12000, 1),
  ('200 usuarios', NULL, 200, NULL, 21600, 1),
  ('350 usuarios', NULL, 350, NULL, 33600, 1)
ON DUPLICATE KEY UPDATE max_usuarios = VALUES(max_usuarios), activo = 1;

-- El super admin recibe TODOS los permisos de ámbito plataforma (agrégalos en la primera lista).
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles AS r JOIN permisos AS p ON p.ambito = 'plataforma'
  WHERE r.tenant_id IS NULL AND r.nombre = 'Super admin' AND r.deleted_at IS NULL;
