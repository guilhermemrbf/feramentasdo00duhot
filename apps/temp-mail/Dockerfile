FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@11.25.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM build AS app
USER node
CMD ["node", "src/api.mjs"]

FROM nginx:stable-alpine AS web
COPY --from=build /app/dist /usr/share/nginx/html
COPY infrastructure/nginx/dev.conf /etc/nginx/conf.d/default.conf
COPY infrastructure/nginx/site.inc /etc/nginx/site.inc
