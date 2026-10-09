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
  ipconfig getifaddr en0                 # IP del Mac en la WiFi, p. ej. 192.168.0.3
  flutter devices                        # el teléfono tiene que aparecer (USB o depuración inalámbrica)
  flutter run -d <id-del-telefono> --dart-define=API_URL=http://<ip-del-mac>:3000
  ```
  Prueba desde el navegador del teléfono `http://<ip-del-mac>:3000/api/v1/salud` antes de abrir la app. Si no responde: el teléfono no está en la misma red (o la red aísla a sus clientes), o el firewall de macOS bloquea Docker. La IP la asigna el router y puede cambiar de un día a otro: si la app no conecta, revísala. No se versiona en ningún archivo.

  Para instalar sin cable, activa **Depuración inalámbrica** en el teléfono (Android 11 o superior; *Opciones de desarrollador*) y empareja una sola vez: `adb pair <ip-del-telefono>:<puerto-de-emparejamiento>` y después `adb connect <ip-del-telefono>:<puerto>`. Con cable USB también funciona: solo cambia cómo se instala la app, no cómo llega a la API.

  HTTP sin TLS se permite **solo en debug** (`android/app/src/debug/res/xml/network_security_config.xml`); el APK de release exige HTTPS. En web: `http://localhost:3000`, o `:8080` si la sirve el contenedor `web`.
- **firmware**: credenciales en NVS por aprovisionamiento; `secretos.h` solo para desarrollo en la mesa.
- **CI**: variables del job; firmas y claves de OTA en GitHub Actions secrets.

## Datos de desarrollo: la cuenta demo `DEM`

**Solo desarrollo. Nunca en producción.** Estos PIN y estas claves están publicados en el repositorio: cualquiera puede entrar con ellos. En producción, las cuentas, los PIN y las claves de dispositivo se generan con la API y se muestran una sola vez.

Preparar la base de desarrollo (los datos que cargues se quedan: no se borran, ver skill `verificacion`):

```
cp .env.example .env                    # trae JWT_SECRETO y PIN_PIMIENTA de desarrollo; si ya tenías un .env, copia esas variables
docker compose --profile herramientas run --rm dbmate up
docker compose exec -T db mysql -uqr_access -pqr_access --default-character-set=utf8mb4 qr_access < db/seeds/01_catalogo.sql
docker compose exec -T db mysql -uqr_access -pqr_access --default-character-set=utf8mb4 qr_access < db/seeds/02_demo.sql
docker compose up -d api                # reinicia la API para que lea el .env
```

Los seeds son idempotentes: se pueden correr de nuevo sin duplicar nada. `02_demo.sql` solo funciona con la `PIN_PIMIENTA` de desarrollo de `.env.example` (el índice del PIN es un HMAC con esa pimienta). La API no arranca sin `JWT_SECRETO` (32 caracteres o más) ni `PIN_PIMIENTA`.

| Qué | Valor |
|---|---|
| Cuenta | `DEM` (id 9001), plan y suscripción vigentes hasta 2036 |
| PIN del **administrador** (todos los permisos de cuenta) | `DEMADM1` |
| PIN del **usuario** (emite y ve lo suyo) | `DEMUSR1` |
| Sitio | `Sede demo` (zona `America/La_Paz`) |
| Puertas | `9001` Portón principal, `9002` Puerta trasera (pulso de 5 s) |
| Dispositivo del portón principal | `Authorization: Dispositivo 9001.1vopRZ7ET7vnEN3pMkYtgGFp8RRqZ7AOx7wJtFv01t0` |
| Dispositivo de la puerta trasera | `Authorization: Dispositivo 9002.Zp244bmr-MTP2l5CdQmdjMWcn6ZpltbPVekWSKUmsYM` |

El PIN se escribe sin importar mayúsculas (`demadm1` entra igual).

Probar de punta a punta con `curl` (la app hace lo mismo con la IP del Mac):

```
API=http://localhost:3000/api/v1
ACCESO=$(curl -s -X POST $API/sesiones -H 'content-type: application/json' -d '{"pin":"DEMADM1"}' | jq -r .acceso)
curl -s $API/puertas -H "authorization: Bearer $ACCESO"
TEXTO=$(curl -s -X POST $API/qr-accesos -H "authorization: Bearer $ACCESO" -H 'content-type: application/json' \
  -d '{"puerta_ids":["9001"],"etiqueta":"Prueba"}' | jq -r .texto)
curl -s -X POST $API/dispositivos/validaciones -H 'content-type: application/json' \
  -H 'authorization: Dispositivo 9001.1vopRZ7ET7vnEN3pMkYtgGFp8RRqZ7AOx7wJtFv01t0' -d "{\"token\":\"$TEXTO\"}"
# → {"abrir":true,"segundos":5,...}; la segunda lectura del mismo QR responde "abrir":false,"motivo_code":"qr.usado"
```

Para el firmware en la mesa: la credencial del dispositivo es `9001.<clave>` (la clave de la tabla) y la API se alcanza por la IP del Mac, igual que desde la app. Con 5 PIN erróneos seguidos desde la misma IP y para la misma cuenta, el login se bloquea un minuto (el doble en cada bloqueo siguiente, hasta una hora); reiniciar la API lo limpia, porque el límite vive en memoria.

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
