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

`POST /api/v1/sesiones { codigo_cuenta, usuario, contrasena }`:
- Contraseña con **argon2id**. Cuenta inexistente, inactiva, usuario de otra cuenta o contraseña errónea → mismo `401 sesion.credenciales_invalidas`.
- Límite: 10 intentos por minuto por IP + código de cuenta (`@fastify/rate-limit`).
- Respuesta: JWT de acceso (15 min) + refresh (30 días, rotativo, guardado hasheado en `sesiones`, revocable). Si el usuario tiene más de un rol y ninguno preferido, el JWT sale sin rol activo y la app pide elegirlo.

## Roles y permisos

- `roles.tenant_id`: cada cuenta tiene los suyos; cada cuenta nace con **Administrador** (protegido) y **Guardia**; usuarios finales con **Usuario**.
- `permisos`: catálogo global sembrado (`<modulo>.<entidad>.<accion>`, p. ej. `organizacion.puerta.editar`, `accesos.evento.ver`, `accesos.qr.escanear`) con **ámbito** `plataforma` o `cuenta`. Un rol de cuenta nunca recibe uno de plataforma.
- **Rol activo**: viaja en el JWT (`rol`). `POST /api/v1/sesiones/rol-activo` emite un JWT nuevo sin pedir contraseña. Los permisos efectivos son los del rol activo, **nunca la unión**, revalidados contra la base en cada request (un rol quitado deja de servir de inmediato).
- Ruta: `preHandler: permiso('organizacion.puerta.editar')`. Menú de la app: `GET /api/v1/sesiones/actual` devuelve los permisos del rol activo y la app oculta lo que no corresponde (presentación, no autorización).

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
