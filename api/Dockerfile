# syntax=docker/dockerfile:1
#
# API de AGROCOM Acceso (ADR 0010). Contexto de build: api/
#   desarrollo  docker compose up api (el repo se monta como volumen y corre tsx watch)
#   produccion  imagen sin dev-dependencies, usuario no root (target por defecto)

FROM node:22-alpine AS base
WORKDIR /repo/api

FROM base AS desarrollo
ENV NODE_ENV=development
CMD ["sh", "-c", "npm ci --no-audit --no-fund && npm run dev"]

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM base AS produccion
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /repo/api/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/v1/salud || exit 1
CMD ["node", "dist/server.js"]
