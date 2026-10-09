---
name: app-flutter
description: Mapa de la app Flutter de AGROCOM Acceso (Android, iOS y web) — estructura por feature, sistema de diseño en tokens (verde Santa Cruz), Riverpod (Notifier por pantalla), go_router con guarda de sesión, cliente de la API (dio + contratos), l10n, pantallas de QR y reglas de pantalla. Usar antes de escribir o cambiar código en app/.
---

# App Flutter — mapa de `app/`

ADR 0012 (estructura y diseño), 0013 (textos) y 0019 (patrón de presentación). Diseño: el handoff V1 en `docs/diseno/handoff/` (README con la especificación, `.dc.html` y capturas por id C01–E10b: **compara cada pantalla con su captura**), `docs/diseno/sistema-diseno.md` y `docs/diseno/guia-pantallas.md`.

## Estructura

```
app/lib/
  main.dart                     ProviderScope + override de proveedorTokensProvider (la sesión)
  app.dart                      AccesoApp: MaterialApp.router, tema, l10n
  core/
    api/                        ClienteApi (un método por endpoint), contratos (DTO) de cada recurso,
                                ErrorApi (RFC 9457 → code), InterceptorSesion (JWT + un solo refresco),
                                mensaje_error.dart (code → texto del ARB; desconocido → genérico)
    config/entorno.dart         --dart-define=API_URL, versión de la API, tiempo de espera
    formato/                    fecha_hora.dart (UTC de la API → hora local, "hoy", días restantes)
    listados/pagina.dart        Pagina<T> (lo que pinta ListadoPaginado) y tamaño por defecto
    navegacion/destinos.dart    DestinoNav y destinosPara(sesion, clase): la tabla rol → destinos del handoff
    plataforma/                 interfaces + implementación por plataforma (ver "Plataforma")
    qr/                         pintor_qr.dart (matriz y módulos) e imagen_qr.dart (PNG 1080×1350 compartido)
    router/                     rutas.dart, guarda_sesion.dart (función pura), router.dart
    sesion/                     SesionControlador (dueño de la sesión), SesionEstado, Permisos
    tiempo/reloj.dart           relojProvider: la hora se inyecta, nunca DateTime.now() en la lógica
    theme/
      primitivos.dart           ÚNICOS valores literales de color (rampa verde Santa Cruz, neutros, suaves, sombras)
      tokens.dart               AccesoTokens (ThemeExtension): colores semánticos, espacio, radio, duracion, tamano, tipografia, breakpoint
      tema.dart                 ThemeData claro y oscuro construidos desde los tokens (IBM Plex empaquetada)
      tema_controlador.dart     temaProvider (ThemeMode) recordado en AlmacenPreferencias
  shared/widgets/
    atoms/                      AccesoBoton, AccesoBadge, AccesoCampoTexto, AccesoSelector, AccesoInterruptor,
                                AccesoAccionFila, AccesoTarjeta, AccesoAvatar, AccesoLogo, AccesoSkeleton, AccesoCargando
    molecules/                  CampoFormulario, TarjetaIndicador, EstadoVacio (vacío/error/sin conexión), ConfirmarDialogo,
                                FilaClaveValor, AccesoAviso, SelectorSegmentado, TarjetaSeleccionable, IndicadorPasos,
                                BannerSinConexion, TarjetaFila, ChipEtiqueta, CajaIcono
    organisms/                  ListadoPaginado<T> (tarjetas < 1024 / DataTable ≥ 1024, 4 estados, estadoDesdeAsync),
                                FormularioSecciones (+ BarraDeAcciones), VisorQr
    templates/                  PlantillaAuth, PlantillaAdmin (NavigationBar / rail / rail extendido), PlantillaPantallaCompleta
  features/
    sesion/                     bienvenida, ingreso por PIN (casillas_pin.dart), elegir rol
    inicio/                     inicio de usuario (hero, accesos rápidos, vigentes hoy) y tablero de administración
    puertas/                    solo datos (puertas con su lector y estado); barrel puertas.dart
    qr_accesos/                 stepper de emisión, QR emitido (compartir PNG), Mis QR con anulación (ADR 0008)
    eventos/                    bitácora con filtros, grupos por día y tabla (ADR 0007)
    perfil/                     cuenta, plan, rol activo (cambiar), tema, cerrar sesión
    administracion/             Puertas (estado del lector), Usuarios (nuevo, editar, eliminar, generar PIN), PIN generado
      <feature>.dart            lo único que otras features pueden importar
  l10n/app_es.arb               textos (prefijo por feature; comun* para lo compartido), en tuteo, los del handoff
```

Dentro de una feature:

```
domain/        modelos y reglas puras (Pin, DatosEmision, EstadoQr); sin Flutter ni red
data/          repositorio abstracto + implementación con ClienteApi; convierte contratos a dominio
presentation/  página (ConsumerWidget), controlador (Notifier/AsyncNotifier), widgets/ propios
```

## Paquetes de referencia

`flutter_riverpod` (3.x, sin codegen), `go_router`, `dio`, `flutter_secure_storage` (refresco en móvil), `shared_preferences` (tema elegido), `qr` (matriz del QR: se pinta y se exporta como PNG), `share_plus` (compartir la imagen; en web, Web Share API o descarga con `package:web`), `intl`, `very_good_analysis`. Versiones fijadas en `pubspec.lock`, que se versiona.

## Reglas

1. **Tokens siempre**: `context.tokens.espacio.m`, `context.tokens.colores.primarioSuave`, `tokens.tipografia.mono(…)`. Prohibido `Color(0x…)`, `Colors.green`, `EdgeInsets.all(13)`, `Duration(milliseconds: 200)` en un widget. Lo controla `test/arquitectura/tokens_test.dart`. Las medidas de componente (48, 56, 80…) también son tokens (`tokens.tamano`).
2. **Textos siempre del ARB** (`context.l10n.sesionIngresoTitulo`), en tuteo. Los errores de la API se traducen con `textoDeError(l10n, error)`, nunca se muestra el mensaje del servidor.
3. **Una feature no importa archivos internos de otra**: solo su `<feature>.dart`. Lo controla `test/arquitectura/fronteras_test.dart`.
4. **Ningún widget llama a la red**: página → controlador → repositorio (`data/`) → `ClienteApi`. El controlador no conoce widgets ni `dio`.
5. **Un widget no es un método**: cada bloque de una pantalla es una clase `Widget` (ADR 0019). Privada si la usa un solo archivo; en `presentation/widgets/` si es de la feature; en `shared/widgets/` si la usan dos features o más. Nada de `_construirX()`.
6. **Controlador solo cuando hay lógica**: una pantalla sin acción ni estado no lleva `Notifier`. Estado inmutable en clase Dart, sin codegen.
7. **Fakes con el shape real**: los tests sobrescriben `xxxRepositorioProvider` con un fake que devuelve lo que devuelve el contrato.
8. **Web y móvil con el mismo código**: lo específico de plataforma va detrás de una interfaz en `core/plataforma/` y se elige por importación condicional (`if (dart.library.io)`). Nada de `dart:io` fuera de `*_movil.dart`.
9. **QR**: negro sobre blanco siempre (`colores.qrModulo`/`qrFondo`), al menos `tamano.qrMinimo` dp, zona de silencio de `tamano.qrZonaSilencioModulos`, con la hora de vencimiento visible. El `texto` del token solo vive en la pantalla que lo muestra y comparte (ADR 0008): se pasa por `extra` de la ruta y no se guarda.
10. **Sesión**: el acceso vive en memoria. El refresco se guarda cifrado en móvil y solo en memoria en web (ADR 0004). El interceptor renueva una sola vez aunque lleguen varios 401 a la vez. Lo que el rol activo no puede usar no se muestra y la ruta tampoco se abre (`guarda_sesion.dart`). Los destinos de la navegación salen de los permisos (`destinosPara`), nunca del nombre del rol.
11. **Breakpoints**: `context.clasePantalla` (compacta < 600, media < 1024, expandida). Una pantalla con listado se prueba en 360×800 y en 1440×900 (`montarPantalla(expandida: true)`). Cada pantalla se compara con la captura de su id en `docs/diseno/handoff/capturas/`.
12. **Lo que se ve una sola vez** (el token del QR, el PIN generado) viaja por `extra` de go_router y nunca se guarda; su pantalla usa `PlantillaPantallaCompleta`.

## Plataforma (`core/plataforma/`)

| Qué | Interfaz | Móvil | Web |
|---|---|---|---|
| Refresco de la sesión | `AlmacenRefresco` | `almacen_refresco_movil.dart` (flutter_secure_storage) | `almacen_refresco_web.dart` (memoria) |
| Compartir la imagen del QR | `CompartirImagen` | share_plus (`XFile.fromData`) | share_plus; sin Web Share API, descarga (`descargar_archivo_web.dart`) |
| Tema elegido | `AlmacenPreferencias` | shared_preferences | shared_preferences |

Pendiente: brillo de pantalla para el QR (CLAUDE.md, invariante 5) y la cookie HttpOnly del refresco cuando la API la soporte.

## Reglas de pantalla (de ACRECIA, `guia-pantallas.md`)

- Arquetipos: **Tablero** (`inicio`), **Listado** (`qr_accesos`, `eventos`, `administracion`), **Formulario** (`FormularioSecciones`), **Stepper** (emitir QR), **Pantalla completa** (QR emitido, PIN generado).
- Tras guardar, el formulario se queda en edición (no vuelve al listado). Para emitir, la pantalla avanza a mostrar el QR.
- `activo` nunca va en un formulario: se activa/desactiva con una acción aparte.
- Colores fijos de acción: Ver = info, Editar = advertencia, Eliminar = peligro; un cambio de estado lleva el tono del estado destino. Toda baja o cambio de estado confirma con `ConfirmarDialogo`.

## Tests

- `test/features/<feature>/domain/*` y `test/core/*`: unitarios (Pin, DatosEmision, interceptor, controladores de sesión).
- `presentation/*`: widget tests con `montarPantalla` (test/helpers/pantalla.dart; compacto por defecto, `expandida: true` para las tablas) y los fakes de `test/helpers/fakes.dart`. `textosEn(tester)` da los textos del ARB ya cargados.
- `test/l10n/` (redacción neutra, textos literales) y `test/arquitectura/` (tokens, fronteras).
