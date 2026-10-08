# Entidades propuestas

**Estado:** Propuesta (2026-10-08), sujeta a las dudas de `02-dudas-y-ambiguedades.md`.

```
cuentas ─┬─< usuarios >─< usuario_roles >─ roles >─< rol_permisos >─ permisos
         │        └─ sesiones (refresh)
         ├─< sitios ─< puertas ─< dispositivos
         ├─< personas >─< grupo_personas >─ grupos
         │      └─ (usuario_id opcional)
         ├─< reglas_acceso  (persona_id | grupo_id) × puerta_id × franjas
         │        └─< reglas_acceso_franjas (dia_semana, desde, hasta)
         ├─< credenciales_qr (persona_id, secreto cifrado) ─< qr_usos (credencial_id, paso)
         ├─< invitaciones (puerta_id, ventana, token_hash, usos)
         ├─< eventos_acceso (solo inserción)
         └─< bitacoras (solo inserción)
```

| # | Tabla | Módulo dueño | Tenant | Notas |
|---|---|---|---|---|
| 01 | `cuentas` | seguridad | — | Identidad: nombre, `codigo`, `activo` |
| 02 | `cuenta_datos_empresa` | seguridad | sí | Razón social, NIT, logo, contacto (1:1) |
| 03 | `usuarios` | seguridad | sí (NULL = plataforma) | Credenciales: `username`, `email`, `contrasena_hash`, `activo` |
| 04 | `usuario_perfiles` | seguridad | sí | Nombre, apellidos, teléfono (1:1) |
| 05 | `roles` | seguridad | sí (NULL = plataforma) | `protegido` |
| 06 | `permisos` | seguridad | — (catálogo global) | `codigo`, `ambito` |
| 07 | `rol_permisos` | seguridad | — | Pivote |
| 08 | `usuario_roles` | seguridad | sí | Pivote con `tenant_id` para el aislamiento |
| 09 | `sesiones` | seguridad | sí | Refresh token hasheado, `expira_at`, `revocada_at`, dispositivo/navegador |
| 10 | `sitios` | organizacion | sí | `nombre`, `direccion`, `zona_horaria` |
| 11 | `puertas` | organizacion | sí | `sitio_id`, `nombre`, `tipo_cerradura` (`fail_secure`/`fail_safe`), `segundos_apertura` |
| 12 | `personas` | organizacion | sí | `nombres`, `apellidos`, `documento`, `usuario_id` opcional, `foto_ruta` |
| 13 | `grupos` | organizacion | sí | |
| 14 | `grupo_personas` | organizacion | sí | Pivote |
| 15 | `dispositivos` | dispositivos | sí | `puerta_id` (único vigente), `clave_hash`, `firmware_version`, `ultimo_latido_at`, `revocado_at` |
| 16 | `reglas_acceso` | accesos | sí | `puerta_id`, `persona_id` XOR `grupo_id`, `vigente_desde`, `vigente_hasta` |
| 17 | `reglas_acceso_franjas` | accesos | sí | `dia_semana` (1–7), `hora_desde`, `hora_hasta` |
| 18 | `credenciales_qr` | accesos | sí | `persona_id`, `secreto_cifrado`, `activo`, `rotada_at` |
| 19 | `qr_usos` | accesos | sí | Solo inserción; único `(credencial_id, paso)` — anti-reuso |
| 20 | `invitaciones` | accesos | sí | `puerta_id`, `desde`, `hasta`, `token_hash`, `usos_max`, `usos`, `estado` |
| 21 | `eventos_acceso` | accesos | sí | Solo inserción; `resultado`, `motivo_code`, `metodo` (`qr_dispositivo`, `qr_guardia`, `invitacion`, `pulsador`, `forzada`) |
| 22 | `bitacoras` | plataforma | sí (NULL = plataforma) | Solo inserción; antes/después en JSON |
