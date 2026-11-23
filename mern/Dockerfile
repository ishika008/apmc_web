# ── Stage 1: build React frontend ────────────────────────────────────────────
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json ./
RUN npm install
COPY client/ ./
# Build Vite app; VITE_API_URL='' means all /api calls are same-origin (served by Express)
ENV VITE_API_URL=""
RUN npm run build

# ── Stage 2: production Express server ───────────────────────────────────────
FROM node:20-alpine AS server
WORKDIR /app/server
COPY server/package.json ./
RUN npm install --omit=dev
COPY server/ ./
# Copy built React app into server/public so Express can serve it
COPY --from=client-build /app/client/dist ./public

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "src/index.js"]
