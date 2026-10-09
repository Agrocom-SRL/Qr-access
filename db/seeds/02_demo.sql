-- ============================================================================================
-- SOLO DESARROLLO. NUNCA EN PRODUCCIÓN.
--
-- Cuenta demo `DEM` con todo lo que la app y el firmware necesitan para probar de punta a punta:
-- plan y suscripción vigentes, un sitio, dos puertas, un dispositivo por puerta, un administrador,
-- un usuario y un guardia (que además tiene el rol Usuario, para probar la elección de rol). Los PIN y las claves de dispositivo están publicados en docs/gestion/entornos.md
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

INSERT INTO cuentas (id, nombre, codigo, activo) VALUES
  (9001, 'Cuenta demo (desarrollo)', 'DEM', 1)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), codigo = VALUES(codigo), activo = 1, deleted_at = NULL;

INSERT INTO planes (id, nombre, max_dispositivos, max_usuarios, max_vigencia_qr_horas, activo) VALUES
  (9001, 'Plan demo (desarrollo)', 5, 10, NULL, 1)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), max_dispositivos = VALUES(max_dispositivos),
  max_usuarios = VALUES(max_usuarios), max_vigencia_qr_horas = VALUES(max_vigencia_qr_horas),
  activo = 1, deleted_at = NULL;

INSERT INTO suscripciones (id, tenant_id, plan_id, desde, hasta, estado) VALUES
  (9001, 9001, 9001, '2026-01-01 00:00:00.000', '2036-12-31 00:00:00.000', 'vigente')
ON DUPLICATE KEY UPDATE plan_id = VALUES(plan_id), desde = VALUES(desde), hasta = VALUES(hasta),
  estado = 'vigente', deleted_at = NULL;

INSERT INTO roles (id, tenant_id, nombre, protegido, activo) VALUES
  (9001, 9001, 'Administrador', 1, 1),
  (9002, 9001, 'Usuario', 0, 1),
  (9003, 9001, 'Guardia', 0, 1)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), protegido = VALUES(protegido), activo = 1, deleted_at = NULL;

-- Administrador: todos los permisos de cuenta. Usuario: emite y ve lo suyo. Guardia: ve todos los
-- eventos y el estado de las puertas, no emite.
INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT 9001, id FROM permisos WHERE ambito = 'cuenta';

INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT 9002, id FROM permisos WHERE codigo IN (
    'organizacion.puerta.ver', 'accesos.qr.emitir', 'accesos.qr.ver', 'accesos.qr.anular', 'accesos.evento.ver'
  );

INSERT IGNORE INTO rol_permisos (rol_id, permiso_id)
  SELECT 9003, id FROM permisos WHERE codigo IN (
    'organizacion.puerta.ver', 'organizacion.puerta.supervisar', 'accesos.evento.ver', 'accesos.evento.ver_todos'
  );

-- PIN DEMADM1 (administrador), DEMUSR1 (usuario) y DEMGRD1 (guardia y usuario)
INSERT INTO usuarios (id, tenant_id, etiqueta, pin_indice, pin_hash, pin_generado_at, activo) VALUES
  (9001, 9001, 'Administrador demo', '172ecfdb00ad4ee7776d6a1de972b77ff89dab2f37848864f92dbca989a641d1',
   '$argon2id$v=19$m=19456,p=1,t=2$AGBWcv3jHfRNchFSbVxE9w$dpiDbgdP0ERL9t8CS6dnSo2j7xRTOQHVGVtkl9Yj3sA', NOW(3), 1),
  (9002, 9001, 'Usuario demo', '60c5daaf7292fa754724a808ab26f6a552d521dfd8a73fb372a1d6680fb200bc',
   '$argon2id$v=19$m=19456,p=1,t=2$CGOmdJaRv0cS0gjvr4o6Rg$n9dOdb4KNQBM6r1D1f5exDIChttGRMy67vfN0acbrLk', NOW(3), 1),
  (9003, 9001, 'Portería turno noche', '84dbfa2d86d62f3e4b11ef75cab7ee854f4389ddaf8017bfbe999d55ba60085a',
   '$argon2id$v=19$m=19456,p=1,t=2$AX1kT5y6DvW+tt9DY3S38g$tcxh7wUYPmz6f5bb97aMyRfumQkx/4BOEi72AkfZ7Os', NOW(3), 1)
ON DUPLICATE KEY UPDATE etiqueta = VALUES(etiqueta), pin_indice = VALUES(pin_indice), pin_hash = VALUES(pin_hash),
  activo = 1, deleted_at = NULL;

INSERT INTO usuario_roles (id, tenant_id, usuario_id, rol_id) VALUES
  (9001, 9001, 9001, 9001),
  (9002, 9001, 9002, 9002),
  (9003, 9001, 9003, 9003),
  (9004, 9001, 9003, 9002)
ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id), rol_id = VALUES(rol_id), deleted_at = NULL;

INSERT INTO sitios (id, tenant_id, nombre, direccion, zona_horaria, activo) VALUES
  (9001, 9001, 'Sede demo', 'Santa Cruz de la Sierra', 'America/La_Paz', 1)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), direccion = VALUES(direccion),
  zona_horaria = VALUES(zona_horaria), activo = 1, deleted_at = NULL;

INSERT INTO puertas (id, tenant_id, sitio_id, nombre, segundos_apertura, activo) VALUES
  (9001, 9001, 9001, 'Portón principal', 5, 1),
  (9002, 9001, 9001, 'Puerta trasera', 5, 1)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), segundos_apertura = VALUES(segundos_apertura),
  activo = 1, deleted_at = NULL;

-- Credenciales de dispositivo: `Dispositivo 9001.<clave>` y `Dispositivo 9002.<clave>` (ver entornos.md)
INSERT INTO dispositivos (id, tenant_id, puerta_id, nombre, clave_hash, revocado_at, activo) VALUES
  (9001, 9001, 9001, 'Lector portón principal',
   '$argon2id$v=19$m=19456,p=1,t=2$3yZIZ0D52SSjRYo380PIvg$+6NeEYIgDioIafNBdryVpzaXUuAQlP+oubwYmNl8ojw', NULL, 1),
  (9002, 9001, 9002, 'Lector puerta trasera',
   '$argon2id$v=19$m=19456,p=1,t=2$8FAOrCcsjZcaxWw7ePAA+Q$1gWRVRI18wWXBH8qznAOMHRmNeRytCe3RXd7SFnPy4I', NULL, 1)
ON DUPLICATE KEY UPDATE puerta_id = VALUES(puerta_id), nombre = VALUES(nombre), clave_hash = VALUES(clave_hash),
  revocado_at = NULL, activo = 1, deleted_at = NULL;
