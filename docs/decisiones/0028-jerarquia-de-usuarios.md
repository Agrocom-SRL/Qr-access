# ADR 0028 — Jerarquía de usuarios: árbol por cuenta, un usuario un rol y cupo por rama

**Estado:** Propuesta (2026-10-21). Enmienda el ADR 0004 (§5 y §6), el ADR 0017 (§5) y la invariante 10 de `CLAUDE.md`.  Todos los puntos abiertos quedaron cerrados el 2026-10-21 (ver "Decisiones finales"). Origen y conversación completa: `docs/gestion/jerarquia-de-usuarios.md`.

## Contexto

La primera prueba en producción con un administrador real mostró que el modelo plano de la cuenta (un Administrador, usuarios con varios roles y un rol activo por sesión) no refleja cómo se administra un condominio, una feria o una finca: hay quien administra el lugar, quien responde por cada unidad, quien vigila y quienes solo viven o trabajan allí. Además, el cupo del plan (ADR 0017) se podía agotar sin que nadie lo controlara.

## Decisión

### 1. Árbol de usuarios

Cada nivel crea al de abajo; el vínculo es explícito y sobrevive a una reasignación.

```
AGROCOM (super admin)
└── Cuenta
    └── Administrador          (uno o varios por cuenta)
        ├── Guardia            (cuelga del Administrador que lo creó)
        └── Titular            (uno por unidad)
            └── Miembro        (las hojas: familiares, empleados, expositores)
```

Vocabulario visible: **Propiedad** (antes "sitio"), **Unidad** (casa, departamento, pabellón), **Administrador**, **Titular**, **Miembro**, **Guardia**. Solo cambian los rótulos: los nombres de tabla y las rutas no.

### 2. Un usuario, un rol

Desaparece el rol activo y el cambio de rol en la app. Cada usuario tiene exactamente **un rol** y sus permisos son los de ese rol. Quien necesite dos funciones tiene **dos usuarios** con su PIN cada uno (no hay roles combinados). Reemplaza el ADR 0004 §6 y la invariante 10 (sigue valiendo: un login por usuario, PIN de 7 caracteres, ADR 0018; los permisos se definen por acción con ámbito y un rol de cuenta nunca recibe un permiso de plataforma).

### 3. Quién crea a quién

| Rol | Crea |
|---|---|
| AGROCOM | cuentas y Administradores |
| Administrador | **Titulares y Guardias** (elige entre los dos) |
| Titular | **Miembros** (sin selector: todo lo que crea es Miembro) |
| Miembro, Guardia | nadie |

Nadie asigna un rol con permisos que él mismo no tenga (ADR 0017 §5).

### 4. Visibilidad y actividad

- **Solo el nivel superior** ve la actividad de un usuario y le regenera el PIN. Un igual o un inferior, no.
- El Administrador ve **toda su rama**, Miembros incluidos. El Titular ve a sus Miembros. Miembros y Guardias solo se ven a sí mismos.
- **Cada Administrador ve solo su rama**, nunca la de otro Administrador de la misma cuenta. AGROCOM ve todo.
- Esta es una **segunda capa sobre el aislamiento por cuenta**, nunca su reemplazo (invariante 1): primero se filtra por cuenta (`RepositorioDeCuenta`) y luego por rama.

### 5. Permisos sobre el QR

Administrador, Titular y Miembro **generan y comparten** QR y usan su QR propio. El **Guardia** solo usa su QR propio: no genera ni comparte QR de visitas, y no ve estadísticas ni cupo.

### 6. Cupo

- Cuentan **todos los niveles** (Administrador, Titular, Guardia y Miembro) mientras estén habilitados; la baja (soft delete) libera el lugar. Los QR siguen ilimitados (ADR 0017).
- **Tope de Miembros por Titular**, configurable por cuenta (por defecto 10). La API lo hace cumplir al crear (`plan.limite_miembros_por_titular`, RFC 9457) además del límite del plan.
- El porcentaje de uso del cupo y los avisos al 80 % y al 100 % los ve **solo el Administrador** (y AGROCOM en el panel web). Cada Administrador ve el **total de la cuenta**, porque comparten el cupo, aunque solo gestione su rama.

### 7. Bajas y reasignación

- **No hay bloqueo de usuarios**: la única acción es la **baja**. El bloqueo automático del PIN por intentos fallidos no cambia.
- La baja de un **Titular** es **en cascada con confirmación**: la app muestra antes cuántos Miembros se darán de baja; todos los lugares se liberan.
- El Administrador puede dar de baja a cualquiera de su rama; el Titular, a sus Miembros.
- **Reasignar** un Guardia o una unidad completa (Titular y Miembros) a otro Administrador es una operación **solo de AGROCOM**, en el panel web, con bitácora. El cupo no cambia. Los Miembros no pasan de un Titular a otro.

### 8. Modelo de datos y API

- `usuarios.superior_id` (el nivel de arriba, distinto de `created_by`) y la tabla `unidades` (con tenant, un Titular activo por unidad: unicidad compatible con soft delete, ADR 0016). Los Miembros cuelgan de su unidad.
- Roles base por cuenta: **Administrador**, **Titular**, **Miembro** y **Guardia**. Migración de los existentes: el rol *Administrador* se conserva; el rol *Usuario* pasa a *Miembro*; el *Guardia* se conserva. No hay migración de datos de producción: se reinicia la base (ver "Decisiones finales").
- El JWT deja de llevar rol activo; lleva el rol único y el árbol se resuelve en el servidor. Las rutas de listado, actividad y regeneración de PIN filtran por rama en el repositorio, no en cada módulo.
- Toda creación, baja, reasignación y regeneración de PIN va a la bitácora con quien actúa (invariante 9).
- Estadísticas (inactivos, ruidosos, uso del cupo, Titulares que abusan del cupo) las calcula la API a partir de `qr_accesos` y `eventos_acceso`; la app y la web solo las muestran. Audiencia: el Administrador en la app (con la baja directa desde la lista) y AGROCOM en el panel web.

## Alternativas descartadas

- **Mantener múltiples roles con rol activo**: el único caso real (Guardia y Titular) no existe, porque un Guardia no es titular de nada; costaba una pantalla, un claim del JWT y un caso de prueba por permiso.
- **Opción de bloqueo de usuarios** distinta de la baja: duplica estados sin liberar cupo; la baja con confirmación alcanza.
- **Que el Administrador reasigne su rama a otro**: abre un camino entre ramas que el aislamiento por rama debería impedir; queda como operación de soporte de AGROCOM.
- **Cupo que no cuente a Guardias y Administradores**: el cupo dejaría de medir los PIN activos.

## Consecuencias

- Enmienda: ADR 0004 §5 y §6, ADR 0017 §5 y la invariante 10 de `CLAUDE.md`; hay que actualizarlas cuando este ADR pase a Aceptada.
- **Revisión línea por línea** (no se delega): el filtro por rama, la regla "solo el nivel superior", la creación por nivel y el modelo de permisos.
- Tests obligatorios: aislamiento por cuenta (cuenta A → recurso de B = 404) y **por rama** (Administrador 1 → Titular o Guardia del Administrador 2 = 404); cada rol solo crea lo que le toca; el Guardia no genera QR; el tope de Miembros y el cupo; la cascada de la baja y su confirmación; la reasignación solo por AGROCOM.
- Orden de ramas: este ADR y la jerarquía en la API (`feature/jerarquia-usuarios`), luego la creación por nivel en la app y la web, y por último las estadísticas. Compartir el PIN es independiente.

## Decisiones finales (2026-10-21)

- **Umbrales de las estadísticas:** fijos e informativos. Inactivo = 30 días sin usar QR; ruidoso = más de 10 QR por día. No disparan ninguna acción: el Administrador decide la baja.
- **Compartir el PIN:** sin cambio forzado en el primer ingreso, pero cada envío queda en la bitácora (quién compartió el PIN de quién y cuándo).
- **Guardia:** solo usa su QR propio; no genera ni comparte QR de visitas.
- **Cupo:** cada Administrador ve el total de la cuenta y los avisos de 80 %/100 %.
- **Dos funciones:** quien las necesite tiene dos usuarios con su PIN cada uno; ambos cuentan en el cupo.
- **Datos de producción:** solo hay datos de la primera prueba. Se **reinicia la base** con respaldo previo (`docs/gestion/jerarquia-de-usuarios.md` §13), sin migrar usuarios con varios roles ni completar apellidos; se recrea el Administrador y las placas se vinculan de nuevo.
