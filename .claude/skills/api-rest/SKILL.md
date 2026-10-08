---
name: api-rest
description: Convenciones del contrato REST de AGROCOM Acceso — rutas, versionado /api/v1, esquemas zod como fuente del OpenAPI, errores RFC 9457 con code, paginación, autenticación de usuarios (JWT) y de dispositivos (clave propia), y qué es un cambio incompatible. Usar antes de crear o cambiar un endpoint o de consumirlo desde Flutter o el firmware.
---

# API REST — contrato

ADR 0005. Consumidores: la app Flutter (móvil y web) y el firmware de cada puerta.

## Rutas

| Regla | Ejemplo |
|---|---|
| Prefijo de versión | `/api/v1/…` |
| Recursos en español, plural, kebab-case | `/api/v1/puertas`, `/api/v1/reglas-acceso` |
| Anidar solo un nivel | `/api/v1/sitios/{sitioId}/puertas` |
| Acciones no CRUD como subrecurso | `POST /api/v1/sesiones` (login), `POST /api/v1/sesiones/rol-activo`, `POST /api/v1/dispositivos/validaciones` |
| Salud | `GET /api/v1/salud` (sin auth) |
| OpenAPI | `GET /api/v1/openapi.json`, UI en `/api/v1/docs` solo fuera de producción |

## Formato

- JSON en `snake_case`; fechas ISO 8601 en UTC (`2026-10-08T19:30:00.000Z`); ids como **string**.
- Listado: `GET /api/v1/puertas?q=&pagina=1&por_pagina=25&orden=nombre` → `{ "datos": [...], "meta": { "pagina": 1, "por_pagina": 25, "total": 132 } }`. `por_pagina` máx. 100.
- Detalle: el objeto directo. Crear: `201` + objeto + `Location`. Borrar: `204` (soft delete).
- Idempotencia: `POST` críticos (invitaciones) aceptan `Idempotency-Key`.

## Errores (RFC 9457)

```json
{ "type": "https://acceso.agrocom.com.bo/errores/qr.vencido", "title": "qr.vencido",
  "status": 422, "code": "qr.vencido", "errores": [{ "campo": "token", "code": "formato" }] }
```

| Status | Cuándo |
|---|---|
| 400 | JSON mal formado |
| 401 | Sin token o token inválido/vencido |
| 403 | Autenticado pero sin el permiso del rol activo |
| 404 | No existe **o es de otra cuenta** (nunca 403 para recursos de otra cuenta) |
| 409 | Conflicto de unicidad o de estado |
| 422 | Validación o regla de negocio (`code` dice cuál) |
| 429 | Límite de intentos |

## Autenticación

- **Usuarios**: `Authorization: Bearer <jwt>` (15 min) + refresh rotativo (`POST /api/v1/sesiones/refresco`). En web, el refresh va en cookie `HttpOnly; Secure; SameSite=Strict`.
- **Dispositivos**: `Authorization: Dispositivo <id>.<clave>`; solo pueden llamar a `/api/v1/dispositivos/*` de su propia puerta.

## Endpoints del dispositivo (mínimos)

```
POST /api/v1/dispositivos/validaciones   { "token": "<texto del QR>", "leido_en": "…" }
  → 200 { "abrir": true,  "segundos": 5, "evento_id": "…", "mensaje_code": "acceso.permitido" }
  → 200 { "abrir": false, "evento_id": "…", "mensaje_code": "qr.vencido" }
POST /api/v1/dispositivos/latidos        { "firmware": "1.2.0", "rssi": -61, "puerta_abierta": false }
GET  /api/v1/dispositivos/configuracion  → { "segundos_apertura": 5, "zona_horaria": "America/La_Paz", "ota": null }
```

La validación responde siempre `200` con `abrir` explícito (un rechazo de negocio no es un error HTTP para el firmware); `401` solo si la credencial del dispositivo es inválida.

## Compatibilidad

Dentro de `v1` solo se **agrega**: un campo opcional nuevo, un endpoint nuevo, un `code` nuevo. Quitar o renombrar un campo, cambiar un tipo o volver obligatorio algo opcional es `v2`. Los clientes ignoran campos que no conocen.
