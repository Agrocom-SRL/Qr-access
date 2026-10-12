# Créditos de la multimedia

Los logos, el ícono, el splash y los Lottie son **de AGROCOM Acceso**. Las ilustraciones
y la foto del login son de terceros y se citan abajo. Todo material externo se agrega
aquí con su fuente y su licencia **antes** de mezclarlo.

Las piezas son genéricas a propósito: sirven igual
para ciudades, edificios, parqueos, condominios y haciendas.

Las piezas son genéricas a propósito (puerta, candado, QR, wifi): sirven igual
para ciudades, edificios, parqueos, condominios y haciendas.

| Archivo | Uso | Fuente | Licencia |
|---|---|---|---|
| `app/assets/logo/logo_placa.png` | Splash nativo y animado | `app/assets/imagenes/logo_agrocom.png` (logo oficial a color) sobre placa blanca con sombra | Marca de AGROCOM, uso interno |
| `app/assets/icono/icono.png`, `icono_adaptativo.png` | Ícono de la app (Android, iOS, web) | `app/assets/imagenes/logo_agrocom.png` centrado sobre blanco, por script | Marca de AGROCOM, uso interno |
| `app/assets/logo/logo_android12.png` | Ícono del splash de Android 12+ | `app/assets/imagenes/logo_agrocom.png` con margen para que el círculo no lo recorte | Marca de AGROCOM, uso interno |
| `app/assets/logo/fondo_splash.png`, `fondo_splash_oscuro.png` | Fondo del splash (claro y oscuro) | Degradado generado por script con los verdes de marca | Propietaria del proyecto |
| `app/assets/lottie/splash_logo.json` | Splash animado (≤ 800 ms) | Creación propia | Propietaria del proyecto |
| `app/assets/lottie/qr_emitido.json` | Confirmación al emitir un QR (1 s) | Creación propia | Propietaria del proyecto |
| `app/assets/ilustraciones/vacio_qr.svg` | Mis QR vacío | Storyset (Freepik), «QR Code-pana», descargado a mano y optimizado con svgo | Storyset: gratis con atribución («Illustration by Storyset») |
| `app/assets/ilustraciones/vacio_eventos.svg` | Eventos vacío | Storyset (Freepik), «Schedule-amico», descargado a mano y optimizado con svgo | Storyset: gratis con atribución («Illustration by Storyset») |
| `app/assets/ilustraciones/vacio_puertas.svg` | Puertas vacío | Storyset (Freepik), «Business inequality-pana», descargado a mano y optimizado con svgo | Storyset: gratis con atribución («Illustration by Storyset») |
| `app/assets/ilustraciones/error.svg` | Error | Storyset (Freepik), «Warning-rafiki», descargado a mano y optimizado con svgo | Storyset: gratis con atribución («Illustration by Storyset») |
| `app/assets/ilustraciones/sin_conexion.svg` | Sin conexión | Storyset (Freepik), «Cloud hosting-amico», descargado a mano y optimizado con svgo | Storyset: gratis con atribución («Illustration by Storyset») |
| `app/assets/ilustraciones/bloqueo.svg` | PIN bloqueado | Storyset (Freepik), «Security-pana», descargado a mano y optimizado con svgo | Storyset: gratis con atribución («Illustration by Storyset») |
| `app/assets/imagenes/bienvenida_edificio.jpg` | Bienvenida y panel de marca | Foto de Dany Kosenko en Pexels (`pexels-dany-kosenko-2159773600-38877340`), reducida a 1400 px | Licencia de Pexels: uso comercial sin atribución obligatoria |
| `app/assets/imagenes/ingreso_acceso.jpg` | Cabecera del ingreso (PIN) | Foto de Estrella Bastías en Pexels (`pexels-estrella-bastias-2153724301-33041706`), reducida a 1400 px | Licencia de Pexels: uso comercial sin atribución obligatoria |
| `app/assets/fuentes/IBMPlex*.ttf` | Tipografía | IBM Plex | SIL OFL 1.1 (`OFL-*.txt`) |

## Límites de peso

Lottie < 50 KB y SVG < 150 KB (las ilustraciones de Storyset son más pesadas que las propias; subido desde 30 KB a propósito), verificado por `app/test/multimedia/assets_test.dart`.
