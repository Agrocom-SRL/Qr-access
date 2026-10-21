-- ============================================================================================
-- SOLO DESARROLLO. NUNCA EN PRODUCCIÓN.
--
-- Cuenta demo `DEM` con todo lo que la app y el firmware necesitan para probar de punta a punta:
-- plan y suscripción vigentes, un sitio (sin puertas ni dispositivos), un administrador,
-- un usuario y un guardia. El administrador y el guardia tienen además el rol Usuario, para probar
-- la elección de rol (handoff C03). Los PIN y las claves de dispositivo están publicados en docs/gestion/entornos.md
-- y en el repositorio: cualquiera puede entrar con ellos. En producción, las cuentas, los PIN y
-- las claves se generan con la API; este archivo no se corre.
--
-- Requiere db/seeds/01_catalogo.sql y la pimienta de desarrollo (.env.example):
--   PIN_PIMIENTA=ZGV2LXBpbWllbnRhLWFncm9jb20tYWNjZXNvLTAxMjM0NTY3ODk=
-- porque `pin_indice` es HMAC-SHA256(pimienta, '<cuenta_id>|<sufijo>'). Con otra pimienta, los
-- PIN no entran.
--
-- Idempotente: se puede correr las veces que haga falta.
-- ============================================================================================

-- Sin esto, un cliente `mysql` en latin1 guarda 'Lucía' como 'LucÃ­a' (doble codificación).
SET NAMES utf8mb4;

INSERT INTO cuentas (id, nombre, codigo, activo) VALUES
  (9001, 'Cuenta demo (desarrollo)', 'DEM', 1)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), codigo = VALUES(codigo), activo = 1, deleted_at = NULL;

INSERT INTO planes (id, nombre, max_dispositivos, max_usuarios, max_vigencia_qr_horas, activo) VALUES
  (9001, 'Demo (desarrollo)', 5, 10, NULL, 1)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), max_dispositivos = VALUES(max_dispositivos),
  max_usuarios = VALUES(max_usuarios), max_vigencia_qr_horas = VALUES(max_vigencia_qr_horas),
  activo = 1, deleted_at = NULL;

INSERT INTO suscripciones (id, tenant_id, plan_id, desde, hasta, estado) VALUES
  (9001, 9001, 9001, '2026-01-01 00:00:00.000', '2036-12-31 00:00:00.000', 'vigente')
ON DUPLICATE KEY UPDATE plan_id = VALUES(plan_id), desde = VALUES(desde), hasta = VALUES(hasta),
  estado = 'vigente', deleted_at = NULL;

INSERT INTO roles (id, tenant_id, nombre, protegido, activo) VALUES
  (9001, 9001, 'Administrador', 1, 1),
  (9002, 9001, 'Miembro', 0, 1),
  (9003, 9001, 'Guardia', 0, 1),
  (9004, 9001, 'Titular', 0, 1)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), protegido = VALUES(protegido), activo = 1, deleted_at = NULL;

-- Administrador: todos los permisos de cuenta. Miembro: emite y ve lo suyo. Titular: lo del Miembro y administra a sus Miembros. Guardia: ve todos los
-- eventos de las puertas que se le asignan, y emite solo su QR propio de acceso.
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT 9001, id FROM permisos WHERE ambito = 'cuenta';

INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT 9002, id FROM permisos WHERE codigo IN (
    'organizacion.puerta.ver', 'accesos.qr.emitir', 'accesos.qr.ver', 'accesos.qr.anular', 'accesos.evento.ver'
  );

-- Por nombre y no por id: en una base anterior al árbol el catálogo ya creó el Titular con otro id.
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT r.id, p.id FROM roles AS r JOIN permisos AS p ON p.codigo IN (
    'organizacion.puerta.ver', 'accesos.qr.emitir', 'accesos.qr.ver', 'accesos.qr.anular', 'accesos.evento.ver',
    'seguridad.usuario.ver', 'seguridad.usuario.crear', 'seguridad.usuario.editar', 'seguridad.usuario.eliminar'
  )
  WHERE r.tenant_id = 9001 AND r.nombre = 'Titular' AND r.deleted_at IS NULL;

INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT 9003, id FROM permisos WHERE codigo IN (
    'organizacion.puerta.ver', 'organizacion.puerta.supervisar', 'accesos.qr.emitir', 'accesos.evento.ver', 'accesos.evento.ver_asignadas'
  );

-- PIN DEMADM1 (Administrador), DEMUSR1 (Miembro) y DEMGRD1 (Guardia). Un usuario, un rol (ADR 0028):
-- el Miembro y el Guardia cuelgan del Administrador.
-- `pin_hash` = argon2id('<id de la cuenta>|<sufijo>'), no del PIN completo: el código de la cuenta se puede cambiar (ADR 0023).
INSERT INTO usuarios (id, tenant_id, superior_id, etiqueta, pin_indice, pin_hash, pin_generado_at, activo) VALUES
  (9001, 9001, NULL, 'Administrador demo', '172ecfdb00ad4ee7776d6a1de972b77ff89dab2f37848864f92dbca989a641d1',
   '$argon2id$v=19$m=19456,p=1,t=2$bGeVY9hw2gApc2AF0o54Gg$2SgWub+4x3E9lgTGlDB4MvXFg1DNR8BK8dLDavFUHIU', NOW(3), 1),
  (9002, 9001, 9001, 'Miembro demo', '60c5daaf7292fa754724a808ab26f6a552d521dfd8a73fb372a1d6680fb200bc',
   '$argon2id$v=19$m=19456,p=1,t=2$iWwhKeBBl7hySni3FNMZvw$MJYNC3Qgy73v7aIOw7/NHnkvtlHGx9EjWVUkeNhhnVM', NOW(3), 1),
  (9003, 9001, 9001, 'Portería turno noche', '84dbfa2d86d62f3e4b11ef75cab7ee854f4389ddaf8017bfbe999d55ba60085a',
   '$argon2id$v=19$m=19456,p=1,t=2$/tq/mdaPTSQLwdr/ccqrQA$jVJJkl3ivWoMu8tjvgZbEh5XSJaSrsRbyMEXPNTF6FY', NOW(3), 1)
ON DUPLICATE KEY UPDATE superior_id = VALUES(superior_id), etiqueta = VALUES(etiqueta), pin_indice = VALUES(pin_indice), pin_hash = VALUES(pin_hash),
  activo = 1, deleted_at = NULL;

INSERT INTO usuario_roles (id, tenant_id, usuario_id, rol_id) VALUES
  (9001, 9001, 9001, 9001),
  (9002, 9001, 9002, 9002),
  (9003, 9001, 9003, 9003)
ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id), rol_id = VALUES(rol_id), deleted_at = NULL;

-- Los segundos roles que traían versiones anteriores de este seed (un usuario, un rol).
UPDATE usuario_roles SET deleted_at = NOW(3) WHERE tenant_id = 9001 AND id IN (9004, 9005) AND deleted_at IS NULL;

INSERT INTO sitios (id, tenant_id, nombre, direccion, zona_horaria, activo) VALUES
  (9001, 9001, 'Sede demo', 'Santa Cruz de la Sierra', 'America/La_Paz', 1)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), direccion = VALUES(direccion),
  zona_horaria = VALUES(zona_horaria), activo = 1, deleted_at = NULL;

-- Sin puertas ni dispositivos a propósito (ADR 0026): se crean desde la app y las placas se
-- vinculan desde el panel, como en producción. Las credenciales de dispositivo de desarrollo se
-- cargan a mano en la placa (`set disp_id` / `set disp_clave`) contra un dispositivo creado así.

-- Retira las puertas y los lectores que traían versiones anteriores de este seed (ids 9001 y 9002),
-- para que una base ya cargada también quede sin puertas. Soft delete: el historial se conserva.
UPDATE dispositivos SET revocado_at = COALESCE(revocado_at, NOW(3)), deleted_at = NOW(3)
  WHERE tenant_id = 9001 AND id IN (9001, 9002) AND deleted_at IS NULL;
UPDATE puertas SET deleted_at = NOW(3)
  WHERE tenant_id = 9001 AND id IN (9001, 9002) AND deleted_at IS NULL;

-- Super admin de desarrollo (web admin): usuario root, contraseña 12345678
INSERT INTO usuarios (id, tenant_id, etiqueta, username, contrasena_hash, contrasena_temporal, activo) VALUES
  (9100, NULL, 'Root', 'root', '$argon2id$v=19$m=19456,p=1,t=2$NRcwaBfCTiX8FgW0y18mfg$SUI+cnQZNQ/LmXeaS1puV66pCoHr1G0gVkWGoC6uS+4', 0, 1)
ON DUPLICATE KEY UPDATE etiqueta = VALUES(etiqueta), username = VALUES(username), contrasena_hash = VALUES(contrasena_hash), activo = 1, deleted_at = NULL;

INSERT INTO usuario_roles (id, tenant_id, usuario_id, rol_id)
  SELECT 9100, NULL, 9100, id FROM roles WHERE tenant_id IS NULL AND nombre = 'Super admin' AND deleted_at IS NULL
ON DUPLICATE KEY UPDATE rol_id = VALUES(rol_id), deleted_at = NULL;
