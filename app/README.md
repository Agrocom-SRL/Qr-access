# app/ — AGROCOM Acceso (Flutter)

App de los usuarios de cada cuenta (Android, iOS y web): inicio de sesión con PIN, emisión y envío de QR, administración y eventos. Mapa y reglas: skill `app-flutter`, ADR 0012 y 0013.

```
flutter pub get                                   # también genera lib/l10n/gen desde app_es.arb
../bin/app-telefono -d <id-del-telefono>          # IP del Mac por la ruta por defecto (cable o WiFi) + flutter run
flutter run -d chrome --dart-define=API_URL=http://localhost:3000
../bin/verify app                                 # formato, análisis, tests y build web
```

El teléfono llega a la API por la WiFi; detalles y problemas comunes en `docs/gestion/entornos.md`.

En Docker, el build web servido por Nginx (con proxy de `/api`): `docker compose --profile web up -d --build`.
