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
  ('seguridad.equipo.desactivar', 'plataforma')
ON DUPLICATE KEY UPDATE ambito = VALUES(ambito);

-- Rol de plataforma (tenant_id NULL): el super admin recibe todos los permisos de ámbito plataforma.
INSERT INTO roles (tenant_id, nombre, protegido, activo) VALUES
  (NULL, 'Super admin', 1, 1)
ON DUPLICATE KEY UPDATE protegido = VALUES(protegido), activo = 1;

INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles AS r JOIN permisos AS p ON p.ambito = 'plataforma'
  WHERE r.tenant_id IS NULL AND r.nombre = 'Super admin' AND r.deleted_at IS NULL;
