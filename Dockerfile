# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json ./
RUN npm install -g pnpm
RUN pnpm i

# ---- Build ----
FROM base AS build
WORKDIR /app
COPY . .
RUN pnpm i
# Instala os binários do navegador para o Playwright. A pasta será copiada para a imagem final.
RUN pnpm exec playwright install --with-deps chromium
RUN pnpm build

# ---- Release ----
FROM node:20-alpine AS release
WORKDIR /app

ENV NODE_ENV=production

# Cria um usuário não-root para executar a aplicação por segurança
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copia os binários do Playwright da etapa de build
COPY --from=build /app/node_modules/.pnpm/playwright-core*/**/chromium-*/ /app/node_modules/.pnpm/playwright-core/chromium/
# Copia os artefatos de build
COPY --from=build /app/next.config.ts ./
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next ./.next
COPY --from=build /app/package.json ./

# O diretório 'temp' precisa ser criável pelo usuário 'nextjs'
RUN mkdir -p /tmp && chown -R nextjs:nodejs /tmp

USER nextjs

EXPOSE 3000

CMD ["pnpm", "start"]
