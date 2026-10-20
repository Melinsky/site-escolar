FROM node:22-alpine AS dependencies
WORKDIR /app/backend
COPY projeto-TCC/backend/package.json projeto-TCC/backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/data DB_DRIVER=postgres DB_LOCAL_MANAGED=false
WORKDIR /app/backend
COPY --from=dependencies --chown=node:node /app/backend/node_modules ./node_modules
COPY --chown=node:node projeto-TCC/backend/ ./
COPY --chown=node:node projeto-TCC/index.html /app/index.html
COPY --chown=node:node projeto-TCC/CSS /app/CSS
COPY --chown=node:node projeto-TCC/js /app/js
COPY --chown=node:node projeto-TCC/imagens /app/imagens
COPY --chown=node:node projeto-TCC/pages /app/pages
COPY --chown=node:node projeto-TCC/admin /app/admin
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD node scripts/healthcheck.js
CMD ["node", "server.js"]
