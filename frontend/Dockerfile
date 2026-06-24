# ── Stage 1: Dependencies (кэшируется пока не меняется package.json) ──────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Stage 2: Development (Vite dev server с hot reload) ────────────────────────
FROM node:22-alpine AS development
WORKDIR /app
# node_modules придут из volume (docker-compose.override.yml)
# но если volume пустой — ставим сами
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# ── Stage 3: Build ────────────────────────────────────────────────────────────
FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

# ── Stage 4: Production (nginx) ───────────────────────────────────────────────
FROM nginx:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
