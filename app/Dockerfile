# syntax=docker/dockerfile:1
#
# App web de AGROCOM Acceso (ADR 0010). Contexto de build: app/
# El build fija la misma versión de Flutter que el host (FLUTTER_VERSION, clonada
# por tag) y usa la API en el mismo origen (Nginx hace proxy de /api): API_URL vacía.
# Se sirve bajo /app/ (BASE_HREF), porque la raíz del dominio es del panel.

FROM debian:bookworm-slim AS flutter
ARG FLUTTER_VERSION=3.47.4
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git unzip xz-utils \
 && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch "${FLUTTER_VERSION}" https://github.com/flutter/flutter.git /opt/flutter
ENV PATH="/opt/flutter/bin:${PATH}"
# En un contenedor LXC sin privilegios (CT de producción) el uid/gid del tar de Flutter
# no existe en el mapeo y el chown falla; no hace falta conservar el dueño.
ENV TAR_OPTIONS="--no-same-owner"
RUN flutter config --no-analytics --no-cli-animations \
 && flutter precache --web --no-android --no-ios

FROM flutter AS build
WORKDIR /app
COPY pubspec.yaml pubspec.lock l10n.yaml analysis_options.yaml ./
COPY lib/l10n ./lib/l10n
RUN flutter pub get
COPY assets ./assets
COPY lib ./lib
COPY web ./web
ARG API_URL=
# La app vive bajo /app/ del mismo dominio que el panel (que ocupa la raíz): un solo
# subdominio y un solo certificado. Debe empezar y terminar con barra.
ARG BASE_HREF=/app/
RUN flutter build web --release --base-href=${BASE_HREF} --dart-define=API_URL=${API_URL}

FROM nginxinc/nginx-unprivileged:1.29-alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Cabeceras de seguridad (ADR 0033 §2): nginx.conf lo incluye con `include snippets/...`, ruta relativa a /etc/nginx
# (la carpeta de configuración de nginx), así que el snippet debe quedar en /etc/nginx/snippets/.
COPY nginx/cabeceras-seguridad.conf /etc/nginx/snippets/cabeceras-seguridad.conf
ARG BASE_HREF=/app/
COPY --from=build /app/build/web /usr/share/nginx/html${BASE_HREF}
EXPOSE 8080
