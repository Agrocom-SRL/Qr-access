# Instrucciones para Claude Code · frontend React del panel web

Lee primero `README.md` (qué construir) y después esto (cómo construirlo). Ante cualquier duda de dominio, endpoints, nombres de campos o reglas de negocio, consulta:

```
/Users/miguel/Applications/AndroidStudio/Qr-access/docs
```

No inventes contratos de API. Si los documentos no lo cubren, deja un `// TODO(docs): …` y pregunta.

## 0. Cómo aplicar los cambios
1. Explora el repo del frontend actual: estructura, dependencias, rutas, estilos y llamadas a la API. Haz un inventario breve antes de tocar nada.
2. Lee `docs/` y arma el mapa de **módulos de la API** (por ejemplo `auth`, `cuentas`, `suscripciones`, `pagos`, `planes`, `bitacora`, `equipo`). Los módulos del frontend llevan **los mismos nombres** que la API.
3. Migra de forma incremental, una rama o PR por paso, sin romper lo que funciona:
   1. tokens + tema + fuentes
   2. i18n
   3. capa `shared/api` (cliente HTTP + traductor de errores)
   4. átomos y moléculas
   5. organismos y plantillas
   6. un módulo a la vez, empezando por `auth` y `cuentas`
4. Si el repo ya resuelve algo (router, cliente HTTP, forms), adáptalo a esta arquitectura antes de reemplazarlo. Justifica cada dependencia nueva.
5. Cada pantalla se compara con su PNG en `capturas/` (mismo id: A01…A12, AD…, PE…). El PNG es el diseño aprobado; el `.dc.html` sirve para leer valores exactos.
6. Antes de crear un asset, busca si ya existe en el proyecto Flutter (`pubspec.yaml` → assets): ilustraciones unDraw, Lottie, logo y fuentes. Los íconos son Material Symbols Outlined, igual que en la app.

## 1. Stack sugerido
React 18 + TypeScript estricto, Vite, React Router, TanStack Query (estado de servidor), react-hook-form + zod (formularios y validación), i18next + react-i18next, CSS Modules o vanilla-extract sobre las variables de `tokens/acceso-tokens.css`. Sin librerías de UI con estética propia (MUI, AntD): los componentes salen del sistema atómico de abajo. Tests: Vitest + Testing Library; Storybook opcional para el catálogo atómico.

## 2. Estructura

```
src/
  app/                      # composición: providers, router, layout raíz
    providers/              # QueryClient, I18n, Tema, Auth, ApiClient (inyección)
    router.tsx              # rutas por módulo, lazy
  shared/
    api/                    # httpClient (interfaz + implementación fetch), traductorErrores, tipos comunes (Paginado<T>)
    i18n/                   # init i18next, formatos (moneda, fecha), detector de idioma
    theme/                  # acceso-tokens.css, theme.ts, ProveedorTema, useTema
    ui/
      atoms/
      molecules/
      organisms/
      templates/
      assets/ilustraciones/
    hooks/                  # useConexion, useDebounce, usePaginacion
    lib/                    # utilidades puras (sin React)
  modules/
    auth/
    resumen/
    cuentas/
    suscripciones/          # cambiar plan, renovar
    pagos/                  # cobranza
    planes/
    bitacora/
    equipo/
    perfil/
```

Cada módulo repite la misma forma:

```
modules/cuentas/
  domain/        # tipos y reglas puras: Cuenta, EstadoSuscripcion, calcularEstado(), puedeBajarPlan()
  api/           # CuentasRepositorio (interfaz) + cuentasHttp (implementación) + mapeadores DTO→dominio
  application/   # hooks de caso de uso: useCuentas, useCrearCuenta, useValidarCodigo
  ui/
    pages/       # CuentasPage, CrearCuentaPage, DetalleCuentaPage (solo componen)
    components/  # piezas propias del módulo (FilaCuenta, PasoPlan)
  i18n/          # es.json del módulo (namespace "cuentas")
  routes.tsx
  index.ts       # API pública del módulo; nadie importa sus rutas internas
```

Reglas de dependencia: `ui → application → domain` y `api → domain`. `domain` no importa React ni fetch. Un módulo no importa a otro salvo por su `index.ts`. `shared` no importa módulos.

## 3. SOLID aplicado
- **S · Responsabilidad única**: una página compone, un hook orquesta un caso de uso, un repositorio habla HTTP y un mapeador traduce DTOs. Nada de fetch dentro de componentes.
- **O · Abierto/cerrado**: los componentes crecen por props de variante (`variante="primario" | "tonal" | "texto" | "peligro"`) y por composición (`children`, slots), sin `if` por pantalla. Estados de badge y colores de acción salen de mapas (`theme.ts`).
- **L · Sustitución**: toda implementación de `XRepositorio` (HTTP, mock, caché offline) cumple la misma interfaz y los tests corren con cualquiera.
- **I · Segregación**: props mínimas y específicas. `TablaDatos<T>` recibe `columnas` + `filas` + `estado`, no el objeto entero de la API. Interfaces de repositorio por módulo, no un `ApiService` gigante.
- **D · Inversión**: `application` depende de interfaces (`CuentasRepositorio`), no de `fetch`. Las implementaciones se inyectan en `app/providers` (contexto o fábrica) para poder cambiar a mocks en tests y Storybook.

## 4. Atomic design
| Nivel | Componentes |
|---|---|
| Átomos | `AccesoBoton`, `BotonIcono`, `AccesoBadge`, `BadgeSuscripcion`, `AccesoInterruptor`, `Icono`, `Skeleton`, `Spinner`, `Avatar`, `TextoMono` |
| Moléculas | `AccesoCampoTexto`, `AccesoSelector`, `CampoFormulario`, `CampoContrasena`, `CampoCodigo`, `BarraUso`, `FilaClaveValor`, `FiltroSegmentado`, `Paginador`, `Buscador`, `Aviso` (info/advertencia/peligro), `Ilustracion` |
| Organismos | `TablaDatos`, `ListadoPaginado`, `TarjetaIndicador`, `TarjetaPlan`, `Stepper`, `ConfirmarDialogo`, `Dialogo`, `EstadoVacio`, `EstadoError`, `BannerSinConexion`, `FormularioSecciones`, `RailNavegacion`, `Pestanas`, `PinUnaVez` |
| Plantillas | `PlantillaAuth` (A01: mitad hero, mitad formulario de 400), `PlantillaAdmin` (rail + encabezado + contenido) |
| Páginas | dentro de cada módulo, en `ui/pages` |

- Los átomos no conocen i18n ni dominio: reciben textos ya traducidos.
- Ningún valor suelto: todo color, espacio, radio o tamaño sale de un token. Un lint (stylelint `declaration-strict-value`) bloquea hex y px fuera de la escala.
- `ListadoPaginado` resuelve los 4 estados (carga, vacío, error, sin conexión) a partir de `estado` de TanStack Query + `useConexion`, para que ninguna página los reimplemente.

## 5. Multiidioma
- i18next con un namespace por módulo y `comun` / `errores` compartidos. Empieza con `es` (copia `i18n/es.json` y divídelo por namespace). Deja `en` preparado con las mismas claves.
- Español con **tuteo**; nunca voseo ni "usted".
- Formatos con `Intl`, nunca a mano: `formatearMonto(12000) → "Bs 12.000"` (`es-BO`, sin decimales), `formatearFecha → dd/mm/aaaa`. Moneda e idioma salen de la configuración, no de los componentes.
- Errores de API: `traductorErrores(codigo, params) → t('errores.' + codigo, params)` con respaldo a `errores.DESCONOCIDO`. Un test verifica que todo código documentado en `docs/` tenga traducción.
- Nada de texto literal en JSX (regla de lint `i18next/no-literal-string`).

## 6. Estado, datos y seguridad
- Estado de servidor en TanStack Query, con claves por módulo (`['cuentas', filtros]`). Tras cada mutación se invalidan las queries afectadas, incluida `bitacora`.
- Estado de UI local (filtros, paso del stepper) en el componente o en la URL (búsqueda, filtro y página van en query params para poder compartir el enlace).
- Sesión: guardar el token según lo que diga `docs/` (preferir cookie httpOnly). Un 401 lleva a "Tu sesión terminó" (PE5c).
- El PIN inicial y la contraseña temporal viven solo en el estado del componente que los muestra. Nunca en caché de Query, logs ni analytics.
- Sin conexión: `useConexion` + `networkMode` de Query. Las lecturas muestran caché con banner y las escrituras quedan desactivadas.

## 7. Definición de terminado por pantalla
- Coincide con su id de `diseño/` en claro y en oscuro.
- Tiene los 4 estados vía `ListadoPaginado` / `EstadoVacio` / `EstadoError`.
- Sin textos literales, sin valores fuera de los tokens, contraste AA, foco visible y navegable con teclado.
- Funciona a 768 px (rail colapsado a 80).
- Tests de dominio (reglas puras) y de un caso de uso con repositorio mock.
- Si una regla vino de `docs/`, se cita el archivo en el PR.
