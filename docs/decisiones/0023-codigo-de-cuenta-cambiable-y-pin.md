# ADR 0023 — Código de cuenta cambiable y PIN que no depende de él

**Estado:** Aceptada (2026-10-12) · Ajusta el ADR 0018 (login por PIN) y completa el ADR 0022.

## Contexto

El PIN de un usuario son 7 caracteres: el **código de la cuenta** (3 letras) más 4 al azar (ADR 0018). AGROCOM no conoce los PIN de los usuarios (se muestran una sola vez y se guardan hasheados), y cada administrador de la cuenta crea y regenera los PIN de sus usuarios. AGROCOM solo emite el primer PIN de administrador. Hasta ahora el código era inmutable porque el `pin_hash` era el argon2id del PIN completo: cambiar el código habría invalidado todos los PIN sin forma de recalcularlos.

## Decisión

1. **El hash de un PIN ya no incluye el código**: `pin_hash = argon2id(<id de la cuenta>|<sufijo>)` (`secretoDePin`). El índice `pin_indice` ya era independiente del código (`HMAC(pimienta, id|sufijo)`). El código es público y no aporta secreto; el id de la cuenta ata el hash a su cuenta.
2. **AGROCOM puede cambiar el código de una cuenta** (`PUT /plataforma/cuentas/:id/codigo`, permiso `seguridad.cuenta.cambiar_codigo`): las 3 primeras letras de los PIN de **todos** sus usuarios cambian y el sufijo queda igual; nadie recibe un PIN nuevo. Las sesiones abiertas siguen (el JWT lleva el id de la cuenta). El código anterior queda libre. Queda en la bitácora (`cuenta.codigo_cambiado`).
3. **AGROCOM regenera el PIN de un administrador** (`POST /plataforma/cuentas/:id/administradores/:usuarioId/pin`, permiso `seguridad.administrador.regenerar_pin`) si lo olvida: se sortea uno nuevo, se muestra una sola vez y se cortan sus sesiones. AGROCOM no toca los PIN de los demás usuarios: cada administrador los regenera desde la app (HU-06, `POST /usuarios/:id/pin`).
4. Nadie conoce un PIN anterior: regenerar siempre sortea uno nuevo.

## Consecuencias

- Migración de datos: los `pin_hash` existentes (hash del PIN completo) dejan de verificar. Es aceptable porque aún no hay producción; los seeds de desarrollo se regeneraron. Una cuenta con PIN antiguos necesita que se le regenere el PIN.
- La verificación en el login pasa a `verificarHash(pin_hash, secretoDePin(cuenta.id, sufijo))`; el relleno de tiempo constante no cambia.
- Tests nuevos: cambio de código (PIN viejo falla, nuevo con el mismo sufijo sirve, sesiones abiertas siguen, código viejo libre, colisiones), regeneración (solo administradores de esa cuenta, el anterior y sus sesiones dejan de servir) y que el PIN nunca llega a la bitácora.
