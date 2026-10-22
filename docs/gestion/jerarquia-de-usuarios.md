# Jerarquía de usuarios y ajustes tras el primer despliegue

**Fecha:** 2026-10-20 · **Origen:** primera prueba en producción (`acceso.agrocom.com.bo`) con un administrador real.
**Estado:** propuesta del cliente, **sin implementar**. Es una lista de trabajo para refinar: no sale a la primera, así que cada bloque trae sus puntos abiertos (§10) y un orden sugerido (§11). Cuando se cierre el modelo de permisos, pasa a un ADR nuevo que enmiende el 0004 y el 0017.

## 1. Idea central

Los accesos forman un **árbol**. Cada nivel crea al de abajo y solo el nivel superior ve su actividad y le cambia el PIN.

```
AGROCOM (administrador del sistema, super admin)      ← ve todos los niveles de todas las cuentas
└── Cuenta (empresa/condominio que paga el plan)
    └── Propietario            (uno o varios por cuenta)
        ├── Guardia            (a cargo de un propietario; asignado por puerta)
        └── Dueño de la casa   (administrador de la casa; UNO por casa/departamento)
            └── Usuario de la casa   (hijos, pareja, familiares; los que sean necesarios)
```

Vocabulario provisional (a confirmar en §10): **Propietario** = administrador de la propiedad (dueño del condominio y de la cuenta); **Dueño de la casa** = administrador de la casa; **Usuario de la casa** = usuario final.

AGROCOM interactúa con los propietarios; los propietarios, con los dueños de casa y los guardias; los dueños, con sus usuarios finales.

## 2. Matriz de permisos

| Rol | Crea | Ve usuarios | Ve actividad y cambia PIN de | Genera y comparte QR | Usa su propio QR |
|---|---|---|---|---|---|
| AGROCOM (super admin) | cuentas, propietarios | todos, de todas las cuentas | todos | sí | sí |
| Propietario | dueños de casa y guardias | los que creó (dueños y guardias) | los que creó | sí | sí |
| Dueño de la casa | usuarios de la casa | los de su vivienda | los de su vivienda | sí | sí |
| Usuario de la casa | nadie | solo a sí mismo | nadie | sí | sí |
| Guardia | nadie | solo a sí mismo | nadie | **no** (no es nivel administrador de casa; permiso `accesos.qr.generar_propio` sin `accesos.qr.generar`) | sí |

Reglas:
- **Solo el nivel superior** ve la actividad de un usuario o le regenera el PIN. Un igual o un inferior, no.
- **El selector de rol al crear un usuario depende de quién lo crea:** el propietario elige entre *guardia* y *dueño de casa*; el dueño de casa **no ve selector** (todo lo que crea es usuario de la casa); guardia y usuario final no tienen la opción de crear.
- **Una casa, un dueño.** La madre, el padre y los hijos son usuarios de la casa; solo uno es el dueño. Así el propietario administra un interlocutor por vivienda.
- Los guardias dependen del propietario que los creó.

## 3. Cupo de usuarios (política de facturación)

- El plan limita **usuarios habilitados** de la cuenta, no usuarios creados alguna vez. Dar de baja (soft delete) un usuario **libera su lugar**.
- Los QR siguen siendo ilimitados (ADR 0017).
- Riesgo: un dueño de casa puede crear usuarios sin medida y agotar el cupo de toda la cuenta. A resolver (§10): tope de usuarios por casa, que el dueño pueda dar de baja a los suyos (sí) y que el propietario pueda dar de baja a cualquiera de su rama (sí), y avisos al acercarse al cupo.
- El cupo lo consumen todos los niveles (propietarios, dueños, guardias, finales): confirmar.

## 4. Estadísticas (las calcula la API; las ven web y app)

> **Hecho (2026-10-22): estadísticas de uso (§4).** La API calcula inactivos (30 días sin generar QR; un usuario con menos de 30 días de antigüedad no cuenta), ruidosos (más de 10 QR en un día, cortando el día en la hora de La Paz) y Titulares cerca de su tope (80 %), todo informativo. La app lo muestra al Administrador (su rama, con baja directa) y el panel web a AGROCOM (toda la cuenta y los usuarios por Administrador). Quedan compartir el PIN y "Registrar pago" en cobranza.

Audiencia: AGROCOM en el panel web (todas las cuentas) y el propietario en la app (su rama).

1. Usuarios creados por cada dueño de casa.
2. Cupo: habilitados, usados y disponibles por cuenta y por propietario.
3. **Usuarios inactivos:** los que menos usan la app (no generan ni comparten QR ni usan el propio). Candidatos a baja.
4. **Usuarios ruidosos:** generan QR a cada rato sin que se usen (aunque sea ilimitado). Pueden ser un usuario ocioso o un malware; candidatos a revisión.
5. **Dueños que usan mal el cupo:** crean usuarios finales para dar acceso a visitas y familiares, cuando bastaba generar y compartir un QR.

Estas métricas se derivan de `qr_accesos` y `eventos_acceso`; definir umbrales y ventana de tiempo (§10). La API las expone (contrato nuevo en `/api/v1`, aislado por cuenta) y ni la app ni la web calculan nada.

## 5. Cambios en la app

> **Hecho (2026-10-22): textos y cabecera (§5.3, §5.4).** "Generar QR" en toda la interfaz, QR propio en la cabecera del inicio y botón flotante de generar y compartir. Se completaron en `app_en.arb` y `app_pt.arb` las 41 claves que faltaban respecto de `app_es.arb`; la web ya tenía es/en/pt iguales.

> **Hecho (2026-10-22): compartir el PIN (§5.2).** Botón Compartir junto a Copiar al crear o regenerar un PIN; usa la hoja del sistema, avisa que el PIN pasa por una app de terceros y registra cada envío en la bitácora. No se fuerza el cambio en el primer ingreso (decidido el 2026-10-21).

1. **Crear usuario según el nivel** (§2): selector de rol solo para el propietario; ninguno para el dueño de casa.
2. **Compartir el PIN** al crear un usuario o al regenerarlo, por redes/hoja de compartir del sistema, igual que se comparte un QR. Cuidar que el PIN se muestra una sola vez y que viaja por un canal de terceros: evaluar forzar el cambio en el primer ingreso (§10).
3. **Texto "Generar QR" → "Generar QR"** en toda la interfaz (ARB, es/en/pt).
4. **Pantalla de inicio:** el botón flotante pasa a **generar y compartir QR**; el **QR propio** se mueve a la cabecera con otro ícono (tipo "persona entrando").
5. **Estadísticas del propietario** (§4) con los datos de su rama.
6. Ocultar cualquier acción que el rol no tenga (el menú ya es por permiso).

## 6. Cambios en el panel web

> **Hecho en el panel web (2026-10-22):** varios Administradores por cuenta (§6.1), el árbol de la cuenta en la ficha (§6.4, sin estadísticas todavía), reasignar Guardias y unidades (ADR 0028 §7) y editar el tope de Miembros por Titular. Quedan las estadísticas de §4 y el rótulo de "Registrar pago" en cobranza.

1. **Varios propietarios por cuenta.** Hoy se crea un administrador inicial; hay que poder agregar más desde la ficha de la cuenta.
2. **Alta de cuenta:**
   - "Razón social" pasa a **Nombre de la cuenta** (no se factura; la cuenta es una habilitación de acceso).
   - **NIT opcional.**
   - La persona responsable se divide en **Nombre** y **Apellido** (obligatorios). **Teléfono y correo, opcionales.**
3. **Cobranza (`/cobranza`):** en cada cuenta pendiente de pago, botón **Registrar pago** ahí mismo, sin entrar a la ficha.
4. **Reflejar la política de usuarios:** la ficha de la cuenta muestra la jerarquía (propietarios → dueños → usuarios, guardias por propietario), el cupo habilitado/usado y las estadísticas de §4.
5. **Texto "sitio":** no se entendió; el administrador necesitó una explicación. Aplica a condominios, pero también a pabellones de una feria, estancias, fincas, regimientos, colegios. Cambiar el rótulo visible por uno genérico (ver §10); el nombre de tabla `sitios` y las rutas no cambian, solo los textos de ARB y `web/src/l10n/`.

## 7. Cambios en el modelo y en la API (a diseñar)

- **Vínculo superior → inferior** explícito en `usuarios` (por ejemplo `superior_id`), no solo `created_by`: el árbol tiene que sobrevivir a una reasignación.
- **Vivienda** como entidad (casa/departamento) con **un solo dueño activo**: restricción de unicidad compatible con soft delete (ADR 0016). Los usuarios finales cuelgan de la vivienda.
- **Roles y permisos nuevos** (propietario, dueño de casa, usuario de la casa, guardia) con alcance sobre la rama propia. El rol actual *Administrador* se migra a *Propietario*; revisar roles base que crea la API al dar de alta una cuenta y el seed.
- **Visibilidad por rama:** los listados, la actividad y la regeneración de PIN filtran por el árbol del usuario dentro de la cuenta. Es una segunda capa sobre el aislamiento por cuenta; **no lo reemplaza** (invariante 1).
- **Bitácora:** toda baja, regeneración de PIN y creación sigue en la bitácora con quien actúa (invariante 9). Registrar también cuándo se comparte un PIN.
- Endpoints de estadísticas (§4) y de varios propietarios por cuenta, con su test de aislamiento (cuenta A → recurso de B = 404) y un test nuevo de **aislamiento por rama** (propietario 1 → dueño del propietario 2 = 404).

## 8. Invariantes y ADR que toca

- Invariante 1 (aislamiento) y 10 (login, roles y permisos): **revisión línea por línea**, no se delega.
- ADR 0004 (permisos por rol activo), ADR 0017 (planes y límite de usuarios), ADR 0018 (PIN; compartirlo).
- Las invariantes 3 y 4 (QR de un solo uso y registro de todo intento) no cambian.

## 9. Decisiones del cliente ya tomadas

- Un solo dueño por casa; la familia son usuarios de la casa.
- Solo el nivel superior ve actividad y cambia PIN.
- Los guardias dependen de un propietario.
- Todos generan y comparten QR menos el guardia.
- El cupo cuenta usuarios habilitados; una baja libera lugar.
- Nombre de cuenta simple, NIT opcional, sin facturación.
- **Quién crea a quién (2026-10-21):** el Administrador solo crea **Titulares** y **Guardias**; el Titular no elige tipo, todo lo que crea es **Miembro**. Se refleja en la app móvil (el selector de rol solo existe para el Administrador).
- **Guardia (2026-10-21, cierra §10.10):** solo usa su QR propio; no genera ni comparte QR de visitas ni ve estadísticas o cupo. Todo lo decidido quedó en el ADR 0028 (propuesta).
- **Reasignar (2026-10-21, cierra §10.6):** solo **AGROCOM, desde el panel web**, con registro en la bitácora. Mueve un Guardia o una unidad completa (Titular y Miembros) a otro Administrador; el cupo no cambia. Los Miembros **no** pasan de un Titular a otro: si cambian de unidad, se da de baja y se vuelve a crear. Un Administrador nunca entrega su rama a otro.
- **Baja de un Titular (2026-10-21, cierra §10.5):** es una **baja en cascada con confirmación**: antes de confirmar, la app muestra cuántos Miembros se darán de baja, y todos esos lugares se liberan en el cupo. La opción de reasignar Miembros a otro Titular se decide con el punto 6.
- **Cupo (2026-10-21, cierra §10.4):** cuentan en el cupo **todos los niveles** (Administradores, Titulares, Guardias y Miembros). Hay un **tope de Miembros por Titular, configurable por cuenta** (valor por defecto sugerido: 10). El porcentaje de uso del cupo y los avisos al acercarse al límite (80 % y 100 %) los ve **solo el Administrador** (y AGROCOM en el panel web); Titulares, Guardias y Miembros no ven el cupo. Por confirmar: si cada Administrador ve el porcentaje de toda la cuenta o solo el de su rama.
- **Entre Administradores de una misma cuenta (2026-10-21, cierra §10.3):** cada Administrador ve solo su rama (los Titulares, Guardias y Miembros que cuelgan de él), nunca la de otro. Comparten el cupo de la cuenta; AGROCOM ve el total. Es una segunda capa sobre el aislamiento por cuenta y no lo reemplaza: el test de aislamiento por rama (Administrador 1 pidiendo un recurso de la rama de Administrador 2 → 404) es obligatorio.
- **Visibilidad transitiva (2026-10-21, cierra §10.2):** el Administrador ve a todos los de su rama, incluidos los Miembros y su actividad, además de Titulares y Guardias. El Titular ve a sus Miembros.
- **Pantalla de estadísticas para el Administrador (2026-10-21):** una vista en la app con los datos de §4 (inactivos, ruidosos, titulares que abusan del cupo, cupo usado) para decidir a qué usuarios **dar de baja**, con la acción directa desde la lista. Se construye en el paso 5, después de la jerarquía. **No se crea una opción de bloqueo** (decisión del 2026-10-21): la única acción es la baja, que libera el lugar en el cupo. El bloqueo automático del PIN por intentos fallidos sigue como está.
- **Un usuario, un rol (2026-10-21):** desaparece el cambio de rol en la app. El único caso de rol múltiple era Guardia/Titular y un guardia no es titular de nada, así que cada usuario tiene exactamente un rol. Esto enmienda la invariante 10 de CLAUDE.md ("múltiples roles, un rol activo por sesión") y el ADR 0004: el ADR nuevo debe reescribirla, y con ella la pantalla de elegir rol y el rol activo de la sesión.

## 10. Puntos a refinar (abiertos)

> **Decidido (2026-10-21), punto 1:** los rótulos visibles son **Administrador** (antes *Propietario*), **Titular** (antes *Dueño de la casa*, uno por unidad), **Miembro** (antes *Usuario de la casa*, las hojas del árbol) y **Guardia**. "Sitio" pasa a **Propiedad**. Para casa/departamento, **Unidad** (confirmado). Solo cambian los textos: los códigos de rol, las tablas y las rutas no. En el resto de este documento, *Propietario*, *Dueño* y *Usuario de la casa* se leen con estos nombres.

> **Decidido (2026-10-21), puntos 7 a 10 y cupo:** umbrales fijos e informativos (inactivo = 30 días sin usar QR; ruidoso = más de 10 QR por día); el PIN se comparte sin cambio forzado pero con registro en la bitácora; el Guardia solo usa su QR propio; cada Administrador ve el total del cupo de la cuenta; quien necesite dos funciones tiene dos usuarios; producción se reinicia (§13) en lugar de migrar datos. No queda ningún punto abierto: ver el ADR 0028.

1. **Nombres de los roles** y del lugar físico. Para "sitio" se proponen *Propiedad*, *Recinto* o *Lugar*; para "casa/departamento", *Unidad* o *Vivienda*. Elegir uno que sirva para un condominio y para una feria.
2. **¿El propietario ve también a los usuarios finales** (nietos del árbol) y su actividad, o solo dueños y guardias? Por "solo el nivel superior ve al inferior" se infiere que el dueño sí los ve; falta confirmar si el propietario los ve de forma transitiva.
3. **Entre propietarios de una misma cuenta:** ¿ven a los dueños y guardias de los demás, o cada uno solo su rama? Hoy se escribió "los que él creó".
4. **Cupo:** ¿los propietarios y guardias cuentan? ¿Hay tope de usuarios finales por casa? ¿Quién recibe el aviso al acercarse al límite?
5. **Baja de un dueño de casa:** qué pasa con sus usuarios finales (baja en cascada, reasignar o dejarlos huérfanos).
6. **Reasignar** un guardia o una casa a otro propietario.
7. **Umbrales de las estadísticas** (cuántos QR/día es "ruido", cuántos días sin uso es "inactivo") y si disparan alguna acción o son solo informativas.
8. **Compartir el PIN:** forzar cambio en el primer ingreso o no; registrar el envío.
9. **Datos existentes:** cómo migrar las cuentas creadas en producción (los *Administradores* pasan a *Propietario*). Además, las cuentas existentes quedaron con el apellido del responsable vacío tras la migración `20261021100001`: decidir si se cargan a mano o si el panel pide completarlo al editar la cuenta.
10. **Permisos del guardia** frente al QR propio (ya se acordó que sí lo usa; confirmar que no genera ni comparte QR de visitas).

## 11. Orden sugerido (una rama y un PR por paso)

1. **`feature/ajustes-textos`:** solo textos y formularios sin tocar permisos: "Generar QR", nombre de cuenta, NIT opcional, nombre y apellido, responsable sin teléfono ni correo, rótulo de "sitio", QR propio en la cabecera y botón flotante (§5.3, §5.4, §6.2, §6.5) y **Registrar pago** en cobranza (§6.3).
2. **`feature/jerarquia-usuarios`:** ADR nuevo + migraciones (vínculo superior, vivienda) + roles y permisos + visibilidad por rama en la API, con tests de aislamiento por cuenta y por rama. Cerrar antes los puntos 1 a 6 de §10.
3. **`feature/crear-usuarios-por-nivel`:** selector de rol por nivel en la app, varios propietarios en la web, baja de usuarios y cupo.
4. **`feature/compartir-pin`:** compartir el PIN en la app (§5.2).
5. **`feature/estadisticas-usuarios`:** endpoints de §4 y su vista en app y web.

Cada paso pasa `bin/verify` entero antes de abrir el PR. El orden 2 → 3 → 5 es obligatorio; el 1 y el 4 son independientes.

## 12. Secretos por entorno (nota para despliegues futuros)

Desarrollo y producción **no comparten secretos**: `PIN_PIMIENTA` (la de desarrollo está publicada en el repo), `JWT_SECRETO`, `MYSQL_*` y `ADMIN_INICIAL_CLAVE` se generan distintos por entorno (`openssl rand -base64 32`). **`PIN_PIMIENTA` se fija una sola vez:** cambiarla invalida todos los PIN guardados. Rotar `JWT_SECRETO` solo cierra sesiones. El firmware de producción (`pio run -e esp32`) lleva solo la URL, ningún secreto; las claves de dispositivo las genera la API por placa. Variables en `docs/gestion/produccion-variables.ejemplo`.

## 13. Reiniciar la base de producción (referencia)

Con respaldo previo (`mysqldump`), detener `api`, recrear la base con `DROP DATABASE`/`CREATE DATABASE` dentro del contenedor `db` y correr `./bin/desplegar` (migra, siembra el catálogo y recrea `root`). Nunca `down -v` ni el seed `02_demo.sql` (es solo de desarrollo). Las placas vinculadas hay que vincularlas de nuevo.
