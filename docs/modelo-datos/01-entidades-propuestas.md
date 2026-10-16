# Entidades propuestas

**Estado:** Propuesta revisada (2026-10-08) tras cerrar D-01 a D-05, D-09 y D-11: quien entra no se registra, los QR los emiten los usuarios de la cuenta y la cuenta tiene una suscripción con plan (ADR 0008 y 0017). Siguen abiertas D-14, D-16, D-17 y D-21, que afectan a `planes` y `qr_accesos`.

```
planes (catálogo de plataforma)
   │
cuentas ─┬─< suscripciones (plan, desde, hasta, estado)
         ├─< usuarios >─< usuario_roles >─ roles >─< rol_permisos >─ permisos
         │        └─ sesiones (refresh)
         ├─< sitios ─< puertas ─< dispositivos
         ├─< qr_accesos (emitido_por usuario, token_hash, vence_at, usado_at, anulado_at)
         │        └─< qr_acceso_puertas (qr_acceso_id, puerta_id)
         ├─< eventos_acceso (solo inserción)
         └─< bitacoras (solo inserción)
```

| # | Tabla | Módulo dueño | Tenant | Notas |
|---|---|---|---|---|
| 01 | `cuentas` | seguridad | — | Identidad: nombre, `codigo`, `activo` |
| 02 | `cuenta_datos_empresa` | seguridad | sí | Razón social, NIT, logo, contacto (1:1) |
| 03 | `planes` | suscripciones | — (catálogo) | `nombre`, `max_dispositivos`, `max_usuarios`, `max_vigencia_qr_horas` (`NULL` = sin límite), `activo` |
| 04 | `suscripciones` | suscripciones | sí | `plan_id`, `desde`, `hasta`, `estado` (`vigente`/`suspendida`/`vencida`); una vigente por cuenta |
| 05 | `usuarios` | seguridad | sí (NULL = plataforma) | Usuario de cuenta = un PIN (ADR 0018): `etiqueta`, `pin_indice` (HMAC, único por cuenta), `pin_hash`, `pin_generado_at`, `rol_preferido_id` (último rol elegido), `activo`. Super admin: `username`, `contrasena_hash` |
| 06 | `usuario_perfiles` | seguridad | sí | Nombre, apellidos, teléfono (1:1) |
| 07 | `roles` | seguridad | sí (NULL = plataforma) | `protegido` |
| 08 | `permisos` | seguridad | — (catálogo global) | `codigo`, `ambito` |
| 09 | `rol_permisos` | seguridad | — | Pivote |
| 10 | `usuario_roles` | seguridad | sí | Pivote con `tenant_id` para el aislamiento |
| 11 | `sesiones` | seguridad | sí | Refresh token hasheado, `expira_at`, `revocada_at` |
| 12 | `sitios` | organizacion | sí | `nombre`, `direccion`, `zona_horaria` |
| 13 | `puertas` | organizacion | sí | `sitio_id`, `nombre`, `segundos_apertura` (pulso) |
| 14 | `dispositivos` | dispositivos | sí | `puerta_id` (único vigente), `clave_hash`, `firmware_version`, `ultimo_latido_at`, `revocado_at` |
| 15 | `qr_accesos` | accesos | sí | `emitido_por` (usuario), `token_hash` (único), `etiqueta`, `vence_at`, `usado_at`, `usado_dispositivo_id`, `anulado_at`; baja diaria por soft delete |
| 16 | `qr_acceso_puertas` | accesos | sí | Pivote; depende de D-17 (si un QR abre una sola puerta, pasa a columna `puerta_id`) |
| 17 | `eventos_acceso` | accesos | sí | Solo inserción; `puerta_id`, `dispositivo_id`, `qr_acceso_id` (si se identificó), `token_hash`, `resultado`, `motivo_code`, `metodo` (`qr`, `pulsador`, `forzada`) |
| 18 | `bitacoras` | plataforma | sí (NULL = plataforma) | Solo inserción; antes/después en JSON |

## Salen respecto de la propuesta anterior

`personas`, `grupos`, `grupo_personas`, `reglas_acceso`, `reglas_acceso_franjas`, `credenciales_qr`, `qr_usos` e `invitaciones`: quien entra no se registra, no hay reglas por persona ni horario, y el anti-reuso pasa a ser `qr_accesos.usado_at` con consumo atómico (ADR 0008). Ninguna tenía migración todavía.
