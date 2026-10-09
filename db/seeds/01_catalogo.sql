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
  ('seguridad.usuario.eliminar', 'cuenta')
ON DUPLICATE KEY UPDATE ambito = VALUES(ambito);
