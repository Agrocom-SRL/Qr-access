# ADR 0018 — Inicio de sesión de los usuarios de cuenta por PIN

**Estado:** Propuesta (2026-10-08). Pedido del cliente; confirmar el detalle con las dudas D-22 a D-24. Modifica el ADR 0004 §3 para los usuarios de cuenta.

## Contexto

El cliente pide que cada usuario de una cuenta inicie sesión con un **PIN que genera AGROCOM**. Con la cuenta creada, se generan varios PIN de acceso, y cada uno entra a la app y emite QR para que los lea el lector de la puerta. Un PIN es corto y fácil de dictar, pero tiene poca entropía: un PIN de 6 dígitos son solo un millón de combinaciones. Sin protección, se puede adivinar probando.

## Decisión (propuesta)

1. **Login de cuenta = código de cuenta + PIN.** El código de cuenta acota la búsqueda y obliga a un atacante a conocer la cuenta. El PIN es numérico, de **8 dígitos**, generado al azar por el servidor (`crypto.randomInt`), único dentro de la cuenta y nunca elegido a mano.
2. **Cada PIN es un usuario** (`usuarios`), con su etiqueta (a quién se entregó), sus roles y su `activo`. Así se mantienen la autoría, la bitácora, "un rol activo por sesión" y el límite `max_usuarios` del plan (ADR 0017). Dar de baja o regenerar un PIN invalida sus sesiones.
3. **Almacenamiento**: el PIN no se guarda en claro. Para encontrarlo, se guarda un índice `pin_indice = HMAC-SHA256(PIN_PIMIENTA, tenant_id | pin)` (único por cuenta) y, para verificarlo, un `pin_hash` con argon2id. La pimienta vive en el entorno, nunca en la base (invariante 6). El PIN se muestra **una sola vez**, al generarlo.
4. **Protección contra adivinanza**: límite de intentos por cuenta y por IP (p. ej. 5 fallos → bloqueo creciente), un mensaje único ante cualquier fallo y un evento de bitácora ante cada bloqueo.
5. **Quién genera PIN**: el super admin (AGROCOM) para cualquier cuenta y, si se confirma (D-23), el administrador de la cuenta con el permiso `seguridad.usuario.crear`.
6. **El super admin** mantiene usuario + contraseña (argon2id), con segundo factor como evolución.
7. La sesión sigue igual que en el ADR 0004: JWT corto + refresh rotativo, rol activo en el JWT.

## Alternativas descartadas

- **PIN solo, sin código de cuenta**: obliga a que el PIN sea único en toda la plataforma y deja que un atacante pruebe contra todas las cuentas a la vez.
- **PIN de 4–6 dígitos**: demasiado fácil de adivinar, aunque haya un límite de intentos, con muchas cuentas e IPs.
- **PIN guardado solo con argon2 (sin índice)**: para encontrarlo habría que verificar contra todos los usuarios de la cuenta en cada intento.

## Consecuencias

- `usuarios` agrega `pin_indice`, `pin_hash`, `pin_generado_at` y `etiqueta`. `username` y `contrasena_hash` quedan solo para el super admin (D-24).
- CLAUDE.md, invariante 10: el login de cuenta pasa a ser cuenta + PIN.
- Tests obligatorios: un PIN de la cuenta A no entra en la B; un PIN regenerado o dado de baja no entra y corta sus sesiones; el bloqueo se activa tras N fallos.
