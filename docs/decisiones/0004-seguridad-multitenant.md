# ADR 0004 — Seguridad: cuentas (multitenant), multi-rol con rol activo, permisos por acción y credenciales de dispositivo

**Estado:** Aceptada (2026-10-08) · **Origen:** ADR 0004 de ACRECIA, portado a Node + JWT y extendido a dispositivos.

## Contexto

La plataforma `acceso.agrocom.com.bo` la usarán varias empresas (cuentas), cada una con sus sitios, puertas, personas y guardias. AGROCOM administra la plataforma. Además de usuarios, hay **dispositivos** (controladores de puerta) que llaman a la API sin persona detrás.

## Decisión

1. **La cuenta es el tenant.** `cuentas` guarda la identidad; los datos de empresa van en `cuenta_datos_empresa`. `tenant_id NULL` = plataforma.
2. **Aislamiento por construcción**: `ContextoCuenta` (AsyncLocalStorage) lo abre el plugin de autenticación; `RepositorioDeCuenta` filtra y completa `tenant_id`. Sin contexto, falla cerrado. Recurso de otra cuenta → 404.
3. **Login por código de cuenta + usuario + contraseña** (argon2id), mensaje único ante cualquier fallo y límite de intentos. Usuario y correo únicos **dentro de la cuenta**.
4. **JWT de acceso corto (15 min) + refresh rotativo** guardado hasheado y revocable (`sesiones`). En web, el refresh va en cookie `HttpOnly`.
5. **Roles por cuenta, permisos por ámbito** (`plataforma` | `cuenta`), con código `<modulo>.<entidad>.<accion>`. Roles base por cuenta: **Administrador** (protegido), **Guardia** y **Usuario**. Un rol de cuenta nunca recibe un permiso de plataforma.
6. **Un usuario, un login, varios roles, un rol activo** (en el JWT). Los permisos efectivos son los del rol activo, nunca la unión, revalidados en cada request.
7. **Super admin** con código reservado `agrocom`; puede elegir una cuenta como contexto y administrarla con las mismas pantallas, firmando todo con su usuario.
8. **Dispositivos**: credencial propia (`id` + clave aleatoria de 32 bytes mostrada una vez, guardada hasheada), revocable, atada a una cuenta y una puerta. Header `Authorization: Dispositivo <id>.<clave>`. Solo acceden a `/api/v1/dispositivos/*`.
9. **Dos capas de autorización**: permiso del rol activo en la ruta (`preHandler`) y aislamiento por registro en el repositorio.

## Alternativas descartadas

- **Una base o un schema por cuenta**: más aislamiento físico, pero migraciones ×N y sin datos de plataforma compartidos; desproporcionado para V1.
- **Sesión con cookie de servidor**: la app móvil y el firmware no son navegadores; JWT + refresh sirve a los tres.
- **Token de usuario en el dispositivo**: un dispositivo robado tendría los permisos de una persona.
- **mTLS para dispositivos**: más fuerte, pero exige gestionar certificados por placa; queda como evolución (ADR 0009).

## Consecuencias

- Todo endpoint con datos de una cuenta lleva su test de aislamiento.
- El catálogo de permisos se siembra con un seed idempotente; el rol de super admin recibe todos.
