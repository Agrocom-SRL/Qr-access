# ADR 0017 — Cuentas con suscripción y planes con límites

**Estado:** Aceptada (2026-10-08). Los límites concretos y el cobro siguen abiertos (dudas D-14 y D-15).

## Contexto

El modelo de negocio es por suscripción. AGROCOM vende cuentas a empresas. Cada cuenta paga una suscripción y tiene sus propios usuarios, que entran a la app (móvil y web). Esos usuarios emiten QR ilimitados según los parámetros de su plan (cantidad de dispositivos, vigencia de cada QR…) y pueden crear otros usuarios para que también administren los ingresos. AGROCOM controla las cuentas, los usuarios y el uso de los QR.

Eso es exactamente un sistema **multitenant**: el *tenant* es la cuenta que paga. Este ADR no reemplaza el ADR 0004 (aislamiento por cuenta): le agrega lo comercial.

## Decisión

1. **Cuenta = suscriptor = tenant.** Todo lo de una cuenta (usuarios, sitios, puertas, dispositivos, QR, eventos) lleva su `tenant_id`, y ninguna cuenta ve lo de otra (invariante 1). AGROCOM opera la plataforma con el super admin (`tenant_id NULL`).
2. **Planes** (`planes`, catálogo de plataforma): nombre y límites. Mínimo: `max_dispositivos`, `max_usuarios` y `max_vigencia_qr_horas` (D-14). Un límite `NULL` significa "sin límite". Los QR no tienen tope de cantidad.
3. **Suscripciones** (`suscripciones`, con `tenant_id`): plan, `desde`, `hasta` y estado. Una cuenta tiene una sola suscripción vigente. En V1 la registra el super admin a mano; la pasarela de pago es una evolución (D-15).
4. **La API hace cumplir los límites** en la acción que los consume: dar de alta un dispositivo, crear un usuario, emitir un QR. Si se pasa del límite, responde un error `plan.limite_dispositivos` (o el que corresponda), en formato RFC 9457. Con la suscripción vencida, la cuenta no emite QR y sus puertas rechazan con `suscripcion.vencida`, y el intento queda registrado (ADR 0008).
5. **Usuarios que crean usuarios**: crear usuarios es un permiso (`seguridad.usuario.crear`), no un privilegio fijo del administrador. Nadie asigna un rol con permisos que él mismo no tenga (D-19).
6. **Quien entra no es un usuario**: no tiene login ni registro. Solo existe el QR que se le envió (ADR 0008).

## Alternativas descartadas

- **Una base de datos por cliente**: aísla más, pero obliga a correr cada migración N veces y a duplicar los planes y el super admin. No hace falta en V1 (ADR 0004).
- **Límites en la app**: la app se puede saltear. El único lugar que hace cumplir un límite es la API.

## Consecuencias

- El modelo de datos agrega `planes` y `suscripciones`, y saca `personas`, `grupos`, `reglas_acceso` y `credenciales_qr` (`01-entidades-propuestas.md`).
- Tests obligatorios: superar cada límite → error con su `code`; suscripción vencida → emisión rechazada y puerta que no abre; cuenta A sin acceso a la suscripción de B.
