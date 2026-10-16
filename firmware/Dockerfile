# syntax=docker/dockerfile:1
#
# PlatformIO en un contenedor (ADR 0010): compila el firmware y corre los tests
# nativos sin instalar nada en el host. Flashear por USB sigue siendo desde el host.
#   docker compose run --rm firmware                  pio run && pio test -e native
#   docker compose run --rm firmware pio run -e esp32

FROM python:3.12-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential git \
 && rm -rf /var/lib/apt/lists/*
ARG PLATFORMIO_VERSION=6.2.0
RUN pip install --no-cache-dir "platformio==${PLATFORMIO_VERSION}"
WORKDIR /repo/firmware
CMD ["sh", "-c", "pio run && pio test -e native"]
