# syntax=docker/dockerfile:1
#
# App web de AGROCOM Acceso (ADR 0010). Contexto de build: app/
# El build fija la misma versión de Flutter que el host (FLUTTER_VERSION, clonada
# por tag) y usa la API en el mismo origen (Nginx hace proxy de /api): API_URL vacía.

FROM debian:bookworm-slim AS flutter
ARG FLUTTER_VERSION=3.47.4
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git unzip xz-utils \
 && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch "${FLUTTER_VERSION}" https://github.com/flutter/flutter.git /opt/flutter
ENV PATH="/opt/flutter/bin:${PATH}"
RUN flutter config --no-analytics --no-cli-animations \
 && flutter precache --web --no-android --no-ios

FROM flutter AS build
WORKDIR /app
COPY pubspec.yaml pubspec.lock l10n.yaml analysis_options.yaml ./
COPY lib/l10n ./lib/l10n
RUN flutter pub get
COPY lib ./lib
COPY web ./web
ARG API_URL=
RUN flutter build web --release --dart-define=API_URL=${API_URL}

FROM nginxinc/nginx-unprivileged:1.29-alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build/web /usr/share/nginx/html
EXPOSE 8080
