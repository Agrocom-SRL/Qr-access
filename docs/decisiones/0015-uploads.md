# ADR 0015 — Subida de archivos (fotos de personas, logos de cuenta)

**Estado:** Propuesta (2026-10-08) — en V1 solo si se confirma la foto de la persona (duda D-07)

## Contexto

ACRECIA resolvía los límites de subida en `docker/uploads.ini` (el límite del proxy por encima del de la aplicación, para que el mensaje lo dé la aplicación) pero no tenía un ADR. Acá los archivos previstos son la foto de la persona (que el guardia ve al validar) y el logo de la cuenta.

## Decisión

- **Endpoint por recurso**: `PUT /api/v1/personas/{id}/foto` (`multipart/form-data`, `@fastify/multipart`) — nunca un "subir cualquier archivo" genérico.
- **Validación por contenido**, no por extensión: tipo detectado por los bytes (`file-type`), solo `image/jpeg`, `image/png`, `image/webp`; máximo 5 MB.
- **Reprocesado**: se recodifica con `sharp` (quita EXIF/GPS, normaliza a WebP, máx. 1024 px) y se genera una miniatura. Nunca se sirve el archivo original.
- **Almacenamiento fuera del contenedor**: volumen montado en local, compatible S3 en producción (interfaz `Almacenamiento` en `platform/`). Ruta `cuentas/<tenant_id>/personas/<id>/<uuid>.webp`: nombre aleatorio, nunca el del usuario.
- **Acceso**: se sirve por la API con el mismo aislamiento de cuenta (o URL firmada de vida corta), nunca desde una carpeta pública.
- **Límites en cascada**: Nginx (`client_max_body_size 8m`) > Fastify (`bodyLimit`/multipart 5 MB), así el error lo da la API con su `code` (`archivo.muy_grande`).
- La tabla guarda la referencia (`foto_ruta`, `foto_actualizada_at`); borrar la persona hace soft delete y el archivo se purga por un proceso posterior.

## Consecuencias

- La app comprime antes de subir (`image_picker` con calidad/tamaño acotados).
