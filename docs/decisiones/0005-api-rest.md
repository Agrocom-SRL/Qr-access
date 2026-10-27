# ADR 0005 — Contrato de la API REST

**Estado:** Aceptada (2026-10-08)

## Contexto

La API tiene dos tipos de cliente con ciclos de actualización muy distintos: la app (se publica en tiendas y en web) y el firmware (instalado en puertas físicas, se actualiza por OTA cuando se puede). Un cambio incompatible rompe puertas.

## Decisión

- **OpenAPI 3.1 generado desde los esquemas zod** (`/api/v1/openapi.json`): una sola fuente para validación, tipos y documentación. La app genera su cliente desde ese archivo.
- **Versión en la ruta** (`/api/v1`). Dentro de una versión solo se agrega; un cambio incompatible es `v2`, que convive con `v1` hasta que los clientes migren.
- Recursos en español, plural, kebab-case; JSON en `snake_case`; fechas ISO 8601 UTC; ids como string.
- **Errores RFC 9457** (`application/problem+json`) con `code` estable. La API no devuelve frases para el usuario: la app traduce el `code` (ADR 0013).
- Paginación `pagina`/`por_pagina` (máx. 100) con `{ datos, meta }`; búsqueda `q`.
- Recurso de otra cuenta → 404.
- La validación del dispositivo responde siempre `200` con `abrir: true|false` explícito.
- Límites: rate limit en login y en validaciones por dispositivo; tamaño de body acotado.

Detalle operativo: skill `api-rest`.

## Alternativas descartadas

- **GraphQL**: flexible para la app, pero pesado para un ESP32 y sin beneficio con un dominio tan acotado.
- **Versión por header**: invisible en logs y más difícil de depurar desde el firmware.

## Consecuencias

- `api-rest` (agente) revisa todo cambio de esquema antes de que `backend` lo implemente.
- Un test compara el OpenAPI generado con el último publicado y falla ante un cambio incompatible en `v1` (pendiente de implementar con la primera versión de la API).

**Enmienda 2026-10-26.** Usar `.strictObject` en los cuerpos de entrada (campos de más, 400 `validacion.invalida`) es una excepción aceptada de endurecimiento de la entrada (ADR 0033 §2), no un cambio incompatible: solo rechaza lo que el contrato nunca definió. `cuerpoDeMiPerfil` y `cuerpoDeEdicionDeUsuario` siguen sin `strict` por sus tests de mass-assignment; queda pendiente para una ola posterior. Ampliar un campo para aceptar `null` (p. ej. `tipo_cuenta` en la cuenta de cobro nueva) es una ampliación compatible.

**Enmienda 2026-10-27.** `POST /qr-accesos` amplía su contrato de forma compatible (ADR 0030 §2.1): el campo `texto` de la respuesta pasa a ser nullable (`null` cuando se reutiliza un QR propio vigente, porque el servidor solo guarda el hash del token); aparece `reutilizado: boolean`; y la respuesta es `200` al reutilizar y `201` al crear un QR nuevo. Un cliente que solo lee `texto` de un `201` no cambia; el que trate `200` como error debe ajustarse. La descripción OpenAPI de la ruta lo recoge.
