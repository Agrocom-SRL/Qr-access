# Recomendaciones para construir AGROCOM Acceso con Claude Code

## 1. Antes de empezar
1. Copia esta carpeta dentro del repo, por ejemplo en `docs/diseño/`.
2. Crea un `CLAUDE.md` en la raíz del repo con el bloque de la sección 2. Claude Code lo lee en cada sesión.
3. Trabaja por etapas cortas (sección 4) y revisa cada una antes de seguir. No pidas "haz toda la app".

## 2. CLAUDE.md sugerido (copiar y pegar)
```markdown
# AGROCOM Acceso — Flutter (Android + web)

## Fuente de verdad del diseño
- docs/diseño/README.md (especificación completa)
- docs/diseño/diseño/*.dc.html (abrir en navegador; ids C01, E04b, etc.)
- docs/diseño/capturas/ (PNG por id: compacto 2x, expandido 1x, estados)
- lib/core/theme/ (tokens; no inventar valores; los del handoff están en docs/diseno/handoff/tokens.md)

## Reglas
- Material 3. Colores solo desde context.ac (AccesoColores) o Theme.of(context).colorScheme. Prohibido Color(0x...) fuera de core/theme/primitivos.dart.
- Espaciado solo con AccesoEspacio (2,4,8,12,16,24,32,48). Radios solo con AccesoRadio. Medidas de componente con AccesoMedida.
- Tipografía: IBM Plex Sans; AccesoTema.mono() para PIN, códigos, horas y cifras.
- Controles de 44 dp como mínimo. Contraste AA.
- El QR nunca se tematiza: negro sobre blanco, ≥ 240 dp + 16 dp de zona de silencio.
- Textos en español con tuteo; nunca voseo ni "usted". Todas las cadenas en ARB (lib/l10n/app_es.arb).
- Nombres de componentes obligatorios: AccesoBoton, AccesoBadge, AccesoCampoTexto, AccesoSelector, AccesoInterruptor, CampoFormulario, TarjetaIndicador, EstadoVacio, ConfirmarDialogo, FilaClaveValor, ListadoPaginado, FormularioSecciones, VisorQr, PlantillaAuth, PlantillaAdmin, PlantillaPantallaCompleta.
- Breakpoints: compacto < 600 (NavigationBar), medio 600–1023 (NavigationRail), expandido ≥ 1024 (rail extendido, DataTable).
- Todo listado implementa 4 estados: carga (skeleton), vacío (con acción), error (Reintentar), sin conexión (caché + banner).
- Cada widget nuevo lleva un widget test y un golden en claro y oscuro.

## Stack
flutter_riverpod, go_router, dio, freezed + json_serializable, qr_flutter, share_plus, flutter_secure_storage, google_fonts, connectivity_plus.

## Comandos
flutter analyze · flutter test · flutter test --update-goldens · flutter run -d chrome
```

## 3. Estructura sugerida
```
lib/
  core/theme/                    ← tokens según docs/diseno/handoff/tokens.md
  componentes/atomos/ … moleculas/ … organismos/ … plantillas/
  funciones/
    auth/      (bienvenida, ingreso_pin, elegir_rol)
    inicio/    (inicio_usuario, inicio_admin)
    qr/        (emitir_qr, qr_emitido, mis_qr)
    eventos/
    perfil/
    admin/     (puertas, usuarios, pin_generado)
  datos/       (api, repositorios, modelos freezed)
  rutas.dart   (go_router + guardas por rol activo)
  l10n/app_es.arb
test/ y test/goldens/
```

## 4. Plan por etapas (un prompt por etapa)
Cada prompt nombra la etapa, los marcos de referencia y cuándo se considera terminada.

1. **Tema y tokens**
   > Crea el proyecto Flutter con el stack de CLAUDE.md. Crea lib/core/theme/ con los valores de docs/diseno/handoff/tokens.md, aplica Tema.claro/oscuro y crea una pantalla /catalogo que muestre la rampa verde y los semánticos como en "Sistema de Diseño.dc.html". Terminada cuando `flutter analyze` está limpio.
2. **Átomos**
   > Implementa AccesoBoton (primario, secundario, texto, peligro tonal y relleno) con estados normal, hover, foco, deshabilitado y carga; AccesoBadge con las 8 variantes; AccesoCampoTexto; AccesoSelector; AccesoInterruptor. Agrégalos a /catalogo. Goldens en claro y oscuro.
3. **Moléculas y organismos**
   > CampoFormulario, TarjetaIndicador (normal, hero, alerta), EstadoVacio (vacío, error, sin conexión), ConfirmarDialogo, FilaClaveValor. Después ListadoPaginado (tarjetas < 1024 / DataTable ≥ 1024 con los 4 estados de Estados.dc.html), FormularioSecciones y VisorQr.
4. **Plantillas y navegación**
   > PlantillaAuth, PlantillaAdmin (NavigationBar / Rail / Rail extendido según breakpoint, destinos según rol activo de la tabla del README) y PlantillaPantallaCompleta. go_router con guardas por rol.
5. **Auth**
   > Bienvenida (C01/E01), Ingreso con PIN (C02–C02d/E02) con un único TextField y overlay 3 + 4 casillas, errores "PIN incorrecto" y "Demasiados intentos, espera unos minutos." con cuenta regresiva, y Elegir rol (C03/E03). Token de sesión en flutter_secure_storage.
6. **Emitir QR y QR emitido**
   > Stepper C05a–c/E05 y QR emitido C06/E06 con share_plus (PNG desde RepaintBoundary). En web, Web Share API o descarga. Confirmar al cerrar sin compartir (S05). El QR no se puede reabrir.
7. **Mis QR, Eventos, Perfil**
   > C07/C07b/E07, C08/E08, C09/E09 con sus 4 estados.
8. **Administración**
   > Puertas (C10a/E10a), Usuarios (C10b/E10b) y Generar PIN (C10c), que se muestra una sola vez con Copiar.
9. **Pulido**
   > Revisa contraste AA, Semantics (PIN "5 de 7 caracteres"), áreas táctiles de 44, "reducir movimiento" y que no queden valores fuera de tokens (`grep -R "Color(0x" lib/ | grep -v primitivos`).

## 5. Consejos para trabajar con Claude Code
- **Usa las capturas en cada prompt de pantalla**: "Implementa docs/diseño/capturas/compacto/C07_mis_qr.png y expandido/E07_mis_qr.png siguiendo el README §Pantallas 7". La imagen fija el aspecto y el README fija los valores exactos; usa siempre las dos.
- **Compara contra la captura**: tras implementar, pídele un golden test a 360×800 y 1440×900 y que lo compare visualmente con la captura del mismo id.
- **Dale referencias exactas**: "igual que el marco C07 en docs/diseño/diseño/Pantallas Compacto.dc.html" funciona mejor que describir la pantalla.
- **Pide plan primero**: "Primero dime qué archivos vas a crear y qué widgets reutilizas; no escribas código aún." Aprueba y luego ejecuta.
- **Verifica con tests y goldens**: pídele que corra `flutter analyze` y `flutter test` al final de cada etapa y que corrija lo que falle.
- **Prueba los 3 tamaños**: `flutter run -d chrome` y cambia el ancho a 360, 800 y 1440 para ver compacto, medio y expandido.
- **No le dejes inventar colores ni espacios**: si propone un valor nuevo, que lo agregue primero a core/theme/ con un comentario.
- **Datos falsos al inicio**: pide un `RepositorioFalso` con los datos de ejemplo de los diseños (Agroindustrial Norte, AGR, Planta Warnes, etc.) para avanzar sin backend; luego cambia a dio.
- **Seguridad del PIN**: nunca loguear el PIN; bloqueo de intentos del lado del servidor; el PIN generado no se guarda en el cliente.
- **Commits por etapa**: pídele un commit con mensaje claro al cerrar cada etapa, así puedes volver atrás.

## 6. Pendientes de decidir con negocio
- Logo final y versión monocroma para el rail.
- Si "Descargar imagen" (web) y "Repetir último" (Inicio) entran en V1.
- Duración exacta del bloqueo por intentos y cuántos intentos se permiten.
- Formato de la imagen compartida (sugerido: PNG 1080×1350 con QR, etiqueta, puertas y vencimiento).
