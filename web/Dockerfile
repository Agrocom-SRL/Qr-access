# syntax=docker/dockerfile:1
#
# Panel web de administración de AGROCOM Acceso (ADR 0010, 0021 y 0022). Contexto de build: web/.
# Se compila con Node y se sirve como estáticos con Nginx, que además hace de proxy de /api hacia
# la API: el panel y la API comparten origen, así que no hace falta CORS.

FROM node:22-alpine AS build
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Cabeceras de seguridad (ADR 0033 §2): el snippet se incluye desde nginx.conf por ruta absoluta.
COPY nginx/cabeceras-seguridad.conf /etc/nginx/snippets/cabeceras-seguridad.conf
COPY --from=build /web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
