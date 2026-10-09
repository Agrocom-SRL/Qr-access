# ADR 0018 — Inicio de sesión de los usuarios de cuenta por PIN

**Estado:** Propuesta (2026-10-08); formato del PIN y quién lo genera confirmados el 2026-10-09 (D-22, D-23). Queda abierta D-24. Modifica el ADR 0004 §3 para los usuarios de cuenta.

## Contexto

El cliente pide que cada usuario de una cuenta inicie sesión con un **PIN que genera AGROCOM**. Con la cuenta creada, se generan varios PIN de acceso, y cada uno entra a la app y emite QR para que los lea el lector de la puerta. Un PIN es corto y fácil de dictar, pero tiene poca entropía: sin protección, se puede adivinar probando. AGROCOM registra las cuentas y quiere que el PIN sea único por usuario y que el propio PIN identifique la cuenta, sin un campo aparte.

## Decisión (propuesta)

1. **El PIN lleva la cuenta adentro: 7 caracteres, sin separadores.**
   - Los **3 primeros** son el **código de la cuenta** (`cuentas.codigo`): 3 letras `A`–`Z` (sin `Ñ`), únicas en la plataforma, que AGROCOM asigna al dar de alta la cuenta (normalmente sus iniciales; si ya existen, otra combinación). Dos cuentas nunca comparten código.
   - Los **4 siguientes** son al azar, alfanuméricos `A`–`Z` (sin `Ñ`) y `0`–`9`, generados por el servidor con `crypto.randomInt` carácter por carácter: 36⁴ = 1.679.616 combinaciones por cuenta. Nadie los elige a mano.
   - Ejemplo: `AGR7K2Q`. Se ingresa sin distinguir mayúsculas; el servidor normaliza a mayúsculas y quita espacios antes de verificar.
   - **Unicidad**: el sufijo es único dentro de la cuenta (índice único) y el código es único entre cuentas, así que el PIN completo es único en la plataforma. Si el sorteo choca con uno existente, el servidor sortea otro; ni AGROCOM ni el cliente revisan repetidos.
   - **Login**: con los 3 primeros caracteres se busca la cuenta (salto explícito del aislamiento, como cualquier login) y con los 4 restantes el usuario dentro de ella. La app muestra un solo campo.
2. **Cada PIN es un usuario** (`usuarios`), con su etiqueta (a quién se entregó), sus roles y su `activo`. Así se mantienen la autoría, la bitácora, "un rol activo por sesión" y el límite `max_usuarios` del plan (ADR 0017). Dar de baja o regenerar un PIN invalida sus sesiones.
3. **Almacenamiento**: el PIN no se guarda en claro. Para encontrarlo, se guarda un índice `pin_indice = HMAC-SHA256(PIN_PIMIENTA, tenant_id | sufijo)` (único por cuenta) y, para verificarlo, un `pin_hash` con argon2id. La pimienta vive en el entorno, nunca en la base (invariante 6). El PIN se muestra **una sola vez**, al generarlo.
4. **Protección contra adivinanza**: el código de la cuenta es fácil de deducir, así que la seguridad depende de los 4 caracteres al azar. Con 50 usuarios en una cuenta, un intento a ciegas acierta 1 vez cada ~33.600. Se suma límite de intentos por cuenta y por IP (p. ej. 5 fallos → bloqueo creciente), un mensaje único ante cualquier fallo y un evento de bitácora ante cada bloqueo.
5. **Quién genera PIN** (D-23): el super admin (AGROCOM), al dar de alta la cuenta y su primer administrador o después; y el administrador de la cuenta, con el permiso `seguridad.usuario.crear` y dentro del límite `max_usuarios` del plan.
6. **El super admin** mantiene usuario + contraseña (argon2id), con segundo factor como evolución.
7. La sesión sigue igual que en el ADR 0004: JWT corto + refresh rotativo, rol activo en el JWT.

## Alternativas descartadas

- **Código de cuenta en un campo aparte + PIN numérico de 8 dígitos** (propuesta inicial): igual de seguro, pero obliga a recordar y escribir dos datos.
- **3 dígitos de la cuenta + 3 dígitos al azar**: solo 1.000 PIN por cuenta; con 50 usuarios, un intento a ciegas acierta 1 vez cada 20, y el límite de intentos terminaría bloqueando a los usuarios legítimos.
- **Código de cuenta = iniciales tal cual**: dos empresas con las mismas iniciales chocarían; el código se asigna y se verifica único.
- **PIN sin código de cuenta**: deja que un atacante pruebe contra todas las cuentas a la vez.
- **PIN guardado solo con argon2 (sin índice)**: para encontrarlo habría que verificar contra todos los usuarios de la cuenta en cada intento.

## Consecuencias

- `cuentas` agrega `codigo CHAR(3)` único (solo `A`–`Z`), obligatorio e inmutable: cambiarlo invalidaría todos los PIN de la cuenta.
- `usuarios` agrega `pin_indice`, `pin_hash`, `pin_generado_at` y `etiqueta`. `username` y `contrasena_hash` quedan solo para el super admin (D-24).
- CLAUDE.md, invariante 10: el login de cuenta pasa a ser el PIN (código de cuenta + 4 caracteres al azar).
- Tests obligatorios: un PIN de la cuenta A no entra en la B (mismo sufijo con otro código → rechazo); el PIN se acepta en minúsculas; un PIN regenerado o dado de baja no entra y corta sus sesiones; el bloqueo se activa tras N fallos.
