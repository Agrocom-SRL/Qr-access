# Entornos y gestión de configuración

## Entornos

| Entorno | Dónde vive | Base de datos | Propósito |
|---|---|---|---|
| **local** | `docker compose up -d` (db + api); `--profile web` suma la app web en :8080 | `qr_access` en el contenedor `db` (volumen `qr-access-db-data`, puerto 3307) | Desarrollo |
| **tests local** | El mismo contenedor `db` | `qr_access_testing` (la fuerza el setup de Vitest) | `bin/verify`. Los tests la vacían: **nunca** apuntan a la de desarrollo |
| **verificación** | Proyecto compose descartable `-p qr-access-verif` | Propia, efímera | Probar migraciones contra MySQL limpio (skill `verificacion`) |
| **CI** | GitHub Actions (`ci.yml`) | Servicio `mysql:8.4` efímero | Lint, tipos, fronteras, tests y builds |
| **producción** | Por definir (D-13): VPS con Docker Compose + Nginx + TLS en `acceso.agrocom.com.bo` | Contenedor `db` propio, sin puerto publicado | — |

## Regla única

**Ningún secreto real se versiona.** `.env.example` es la plantilla de la API y de compose; `firmware/include/secretos.example.h`, la del firmware de desarrollo; `app/android/key.properties` (firma) no se versiona. Los guardarraíles de `.claude/hooks/` impiden leerlos o escribirlos por herramienta.

- **local**: `cp .env.example .env` (con la API en el host: `DB_HOST=127.0.0.1`, `DB_PORT=3307`).
- **app**: la URL de la API entra por `--dart-define=API_URL=…`. No se usa emulador: la app corre en un **teléfono Android en la misma WiFi que el Mac** y llega a la API por la IP local del Mac.
  ```
  flutter devices                                  # el teléfono tiene que aparecer (USB o depuración inalámbrica)
  bin/app-telefono -d <id-del-telefono>            # calcula la IP y corre: flutter run --dart-define=API_URL=http://<ip>:3000
  ```
  `bin/app-telefono` toma la IP de la interfaz de la **ruta por defecto** del Mac, así sirve tanto con cable (`en6`) como con WiFi (`en0`). Los argumentos extra van a `flutter run` (`--release`, `-d`, etc.). Si quieres la IP a mano, el mismo cálculo es:
  ```
  ipconfig getifaddr $(route -n get default | awk '/interface/{print $2}')
  ```
  No uses `ipconfig getifaddr en0` fijo: con cable la IP está en otra interfaz y el comando sale vacío.

  Prueba desde el navegador del teléfono `http://<ip-del-mac>:3000/api/v1/salud` antes de abrir la app. Si no responde: el teléfono no está en la misma red (o la red aísla a sus clientes), el Mac tiene una VPN activa que cambia la ruta por defecto, o el firewall de macOS bloquea Docker. La IP la asigna el router y puede cambiar de un día a otro: el script la recalcula cada vez. No se versiona en ningún archivo.

  Para instalar sin cable, activa **Depuración inalámbrica** en el teléfono (Android 11 o superior; *Opciones de desarrollador*) y empareja una sola vez: `adb pair <ip-del-telefono>:<puerto-de-emparejamiento>` y después `adb connect <ip-del-telefono>:<puerto>`. Con cable USB también funciona: solo cambia cómo se instala la app, no cómo llega a la API.

  HTTP sin TLS se permite **solo en debug** (`android/app/src/debug/res/xml/network_security_config.xml`); el APK de release exige HTTPS. En web: `http://localhost:3000`, o `:8080` si la sirve el contenedor `web`.
- **firmware**: credenciales en NVS por aprovisionamiento; `secretos.h` solo para desarrollo en la mesa.
- **CI**: variables del job; firmas y claves de OTA en GitHub Actions secrets.

## La base de tests en un volumen existente

`docker/mysql/01-base-testing.sql` crea `qr_access_testing` solo al inicializar el volumen. Si el volumen ya existía:

```
docker compose exec db mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS qr_access_testing; GRANT ALL ON qr_access_testing.* TO 'qr_access'@'%';"
```

## Herramientas del host

| Herramienta | Para qué | Instalación |
|---|---|---|
| Docker Desktop | MySQL, dbmate, API, app web, compilación y tests del firmware | — |
| Node 22 LTS | API fuera del contenedor, `bin/verify api` | `nvm install 22` (la API fija `engines` y `.nvmrc`) |
| Flutter 3.47.4 | App en el teléfono, `bin/verify app` | ya instalado (`~/flutter`); `app/Dockerfile` fija la misma versión |
| PlatformIO Core | IntelliSense del firmware en el editor (las cabeceras de Arduino y ESP32 salen de su framework), compilar y flashear por USB (`pio run -t upload`), `pio test -e native`. Sin él, `bin/verify firmware` usa el contenedor `firmware` | `pipx install platformio` (fija la versión 6.2.0 de `firmware/Dockerfile`). No uses `brew install platformio`: su entorno de Python viene sin pip y `pio run` falla con `No module named pip.__main__`. La primera `pio run` baja el framework Arduino ESP32 (varios cientos de MB) |
| Extensión **PlatformIO IDE** (VS Code, `platformio.platformio-ide`) | Abre `firmware/` como proyecto PlatformIO: barra inferior (compilar, subir, monitor) y genera `firmware/.vscode/c_cpp_properties.json` con las rutas de Arduino.h y Preferences.h. Requiere `ms-vscode.cpptools` (ya en las recomendaciones) | Recomendada por `.vscode/extensions.json`; VS Code la ofrece al abrir el workspace |
| Driver USB-serie | Flashear el ESP32 | CP210x o CH340 según la placa |
| Android platform-tools (`adb`) | Instalar y depurar en el teléfono | viene con Android Studio (`~/Library/Android/sdk/platform-tools`); agrégalo al `PATH` |

**Editor (VS Code):** abre `qr-access.code-workspace` (File › Open Workspace from File…), no la carpeta raíz. Es un workspace multi-root con `api/`, `app/` y `firmware/`, para que PlatformIO reconozca `firmware/platformio.ini`. VS Code ofrece instalar las extensiones de `.vscode/extensions.json` al abrirlo. Si IntelliSense del firmware sigue marcando `Arduino.h` o `Preferences.h` como no encontrados: en `firmware/`, `pio project init --ide vscode` regenera `firmware/.vscode/c_cpp_properties.json` (local, ignorado por git) y luego recarga la ventana.
