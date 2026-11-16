# Imagen de producción de Vidriera Chabás (web + API + base de datos SQLite)
FROM node:24-alpine AS armado
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/datos PORT=3000
COPY --from=armado /app/package.json ./
COPY --from=armado /app/shared ./shared
COPY --from=armado /app/server ./server
COPY --from=armado /app/scripts/clave.ts ./scripts/clave.ts
COPY --from=armado /app/web/dist ./web/dist
COPY --from=armado /app/web/public/assets/img ./web/public/assets/img
RUN mkdir -p /datos && chown node:node /datos
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/salud || exit 1
CMD ["node", "server/index.ts"]
