# Modelo de datos — AGROCOM Acceso

Método heredado de ACRECIA (`docs/modelo-datos/`):

| Archivo | Qué contiene |
|---|---|
| `01-entidades-propuestas.md` | Entidades, a qué módulo pertenecen y cómo se relacionan |
| `02-dudas-y-ambiguedades.md` | Dudas abiertas (D-xx) con fecha y respuesta cuando se cierran |
| `03-schema-sql.md` | DDL MySQL 8 de referencia (lo que las migraciones deben producir) |
| `tablas/NN_<tabla>.md` | Ficha por tabla: propósito, dueño, columnas, índices, reglas, dudas |

Convenciones: skill `modelo-datos`, ADR 0007, 0011 y 0016. Una tabla nueva actualiza `03-schema-sql.md` y su ficha en el mismo PR que la migración.
