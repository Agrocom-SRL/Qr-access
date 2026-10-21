---
name: seguridad-roles
description: Seguridad multitenant de AGROCOM Acceso — cuentas y su aislamiento (ContextoCuenta, RepositorioDeCuenta), login por cuenta + usuario, JWT y refresh, super admin con contexto de cuenta, roles por cuenta con permisos por ámbito, rol activo, menú por permiso y credenciales de dispositivo. Usar antes de tocar autenticación, permisos, roles, dispositivos o cualquier consulta sobre datos de una cuenta.
---

# Seguridad — cuentas, roles y dispositivos

ADR 0004. Origen: ADR 0004 de ACRECIA, portado de Laravel a Node.

## La cuenta es el tenant

- `cuentas`: identidad (nombre, `codigo` de ingreso, `activo`). Datos de empresa aparte (`cuenta_datos_empresa`).
- `usuarios.tenant_id NULL` = usuario de la **plataforma** (super admin de AGROCOM).
- Todo lo demás de una cuenta (suscripción, sitios, puertas, dispositivos, QR emitidos, eventos) lleva `tenant_id`.

## Aislamiento por construcción

1. El plugin `autenticacion` verifica el JWT y abre `ContextoCuenta.ejecutar({ cuentaId, usuarioId, rolActivoId, origen: 'api' }, handler)`.
2. `RepositorioDeCuenta` lee el contexto en cada consulta: agrega `tenant_id = ?` y lo completa al insertar. **Sin contexto → lanza** (falla cerrado).
3. Un id de otra cuenta no se encuentra → **404**, nunca 403.
4. Saltar el aislamiento (`RepositorioDePlataforma`, `ejecutarEn`) es explícito y se justifica en el PR. Usos legítimos: login (buscar cuenta por código), procesos de sistema, super admin administrando una cuenta elegida.

## Login

Usuarios de cuenta (ADR 0018): `POST /api/v1/sesiones { pin }`:
- PIN de 7 caracteres sin separadores: 3 letras = `cuentas.codigo` + 4 alfanuméricos al azar (`A`–`Z` sin `Ñ`, `0`–`9`). Se normaliza a mayúsculas y sin espacios.
- Con el código se busca la cuenta (salto explícito); con el sufijo, `pin_indice = HMAC-SHA256(PIN_PIMIENTA, tenant_id | sufijo)` y se verifica `pin_hash` (argon2id). Cuenta inexistente, inactiva o PIN erróneo → mismo `401 sesion.credenciales_invalidas`.
- Límite de intentos (`platform/seguridad/limitador-de-intentos.ts`, en memoria: una sola instancia de la API): 5 fallos seguidos por IP + código de cuenta, o 30 por cuenta, bloquean con `429 sesion.bloqueada` (1 minuto, el doble en cada bloqueo siguiente, hasta 1 hora). Cada bloqueo deja un `warn` en el log. Un fallo cuesta el mismo tiempo exista o no la cuenta (argon2 contra un hash de relleno).
- El refresh se rota **en sitio** (misma fila de `sesiones`, nuevo hash): el JWT de acceso en vuelo sigue valiendo y un refresh ya usado deja de servir. Cada petición revalida contra la base la sesión, el usuario, la cuenta y el rol activo.

Super admin: `POST /api/v1/sesiones/plataforma { usuario, contrasena }` con **argon2id** [confirmar ruta al implementar].
- Respuesta: JWT de acceso (15 min) + refresh (30 días, rotativo, guardado hasheado en `sesiones`, revocable). Un usuario tiene un solo rol (ADR 0028): el JWT lleva ese rol; sin rol vigente sale sin permisos.

## Roles y permisos

- `roles.tenant_id`: cada cuenta tiene los suyos; cada cuenta nace con **Administrador** (protegido), **Titular**, **Miembro** y **Guardia** (`domain/roles-base.ts`); el nombre del rol define el nivel en el árbol (`domain/jerarquia.ts`).
- `permisos`: catálogo global sembrado (`<modulo>.<entidad>.<accion>`, p. ej. `organizacion.puerta.editar`, `accesos.evento.ver`, `accesos.qr.escanear`) con **ámbito** `plataforma` o `cuenta`. Un rol de cuenta nunca recibe uno de plataforma.
- **Un usuario, un rol** (ADR 0028; ya no hay cambio de rol): el rol viaja en el JWT (`rid`) y la base lo impone (`uq_usuario_roles_usuario`). Los permisos efectivos son los de ese rol, revalidados contra la base en cada request (un rol quitado deja de servir de inmediato).
- **Árbol y visibilidad por rama** (ADR 0028): `usuarios.superior_id` vincula Administrador → Titular y Guardia → Miembro. Cada nivel crea solo el de abajo (`puedeCrear`) y ve, edita, da de baja y regenera el PIN solo de su **rama** (`RepositorioDeUsuarios.buscarEnRama`/`listarDeRama`), nunca de un igual ni un superior (404). Es una segunda capa sobre el aislamiento por cuenta, no su reemplazo. Estadísticas de uso (informativas, umbrales fijos: 30 días sin QR = inactivo, más de 10 QR en un día = ruidoso, Titular cerca del tope desde el 80 %): `GET /usuarios/estadisticas` (permiso `seguridad.estadistica.ver`, solo el Administrador, solo su rama) y `GET /plataforma/cuentas/:id/estadisticas-de-usuarios` (AGROCOM, toda la cuenta con el cupo de cada rama); los calcula la API (`domain/actividad-de-usuarios.ts`) a partir de `qr_accesos` y las apps no calculan nada. Solo AGROCOM (panel web, rutas `/plataforma/cuentas/:id/…`) suma Administradores (`administradores`, permiso `seguridad.administrador.crear`), ve el árbol de la cuenta (`jerarquia`), reasigna un Guardia o un Titular con su unidad y Miembros a otro Administrador (`reasignaciones`, permiso `seguridad.administrador.reasignar`) y fija `max_miembros_por_titular` al editar la cuenta. Un Titular nace con su unidad (`unidad` en `POST /usuarios`); la baja de quien tiene a otros debajo exige `?confirmar=true` y es en cascada (unidades y sesiones incluidas); un Titular tiene hasta `cuentas.max_miembros_por_titular` Miembros; `GET /cupo` (permiso `seguridad.cupo.ver`, solo el Administrador) muestra el uso del cupo de toda la cuenta.
- Ruta: `preHandler: permiso('organizacion.puerta.editar')`. Menú de la app: `GET /api/v1/sesiones/actual` devuelve los permisos del rol y la app oculta lo que no corresponde (presentación, no autorización).

## Super admin

Entra con el código reservado `agrocom`. Puede elegir una cuenta como contexto (`POST /api/v1/sesiones/contexto { cuenta_id }`) y trabajar con las mismas pantallas que su administrador; todo lo que crea queda firmado por él en la bitácora.

## Dispositivos

- Alta por un administrador de la cuenta: `POST /api/v1/puertas/{id}/dispositivos` → devuelve **una sola vez** `{ id, clave }`. En la base solo queda el hash.
- Autenticación: `Authorization: Dispositivo <id>.<clave>`; el plugin abre el contexto con la cuenta del dispositivo y `origen: 'dispositivo'`.
- Revocar = `revocado_at`; un dispositivo revocado o inactivo recibe `401` y el firmware queda en modo "sin servicio" (no abre).
- Un dispositivo solo valida QR para **su** puerta.

## Tests obligatorios

- Aislamiento: cuenta A pide/edita/borra un recurso de B → 404; listados de A no muestran filas de B.
- Rol activo: un permiso de otro rol del mismo usuario no sirve.
- Dispositivo de la cuenta A no puede validar en una puerta de B; clave revocada → 401.
