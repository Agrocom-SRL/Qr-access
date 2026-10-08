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
- **app**: la URL de la API entra por `--dart-define=API_URL=…`. No se usa emulador: la app corre en un **teléfono Android conectado por USB** (depuración USB activada).
  ```
  adb reverse tcp:3000 tcp:3000          # el localhost:3000 del teléfono llega a la API del Mac
  flutter devices                        # el teléfono tiene que aparecer
  flutter run -d <id-del-telefono> --dart-define=API_URL=http://localhost:3000
  ```
  `adb reverse` se pierde al desconectar el cable: hay que repetirlo. HTTP sin TLS se permite **solo en debug y solo hacia `localhost`** (`android/app/src/debug/res/xml/network_security_config.xml`); el APK de release exige HTTPS. En web: `http://localhost:3000`, o `:8080` si la sirve el contenedor `web`.
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
| Flutter 3.47.4 | App en el teléfono por USB, `bin/verify app` | ya instalado (`~/flutter`); `app/Dockerfile` fija la misma versión |
| PlatformIO Core | Solo para flashear por USB; sin él, `bin/verify` usa el contenedor `firmware` | `pipx install platformio` |
| Driver USB-serie | Flashear el ESP32 | CP210x o CH340 según la placa |
| Android platform-tools (`adb`) | Instalar y depurar en el teléfono | viene con Android Studio (`~/Library/Android/sdk/platform-tools`); agrégalo al `PATH` |
