#
# Fase 1: Build da aplicação Next.js
#
FROM node:20-alpine AS build

# Instala as dependências necessárias para o Playwright no Alpine Linux
# Apenas o Chromium é necessário
RUN apk add --no-cache chromium

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos de definição de dependência
COPY package.json package-lock.json* ./

# Instala as dependências
RUN npm ci

# Instala os binários do navegador para o Playwright sem dependências de sistema (já instaladas com apk)
RUN npx playwright install chromium

# Copia o restante do código da aplicação
COPY . .

# Executa o build da aplicação
RUN npm run build

#
# Fase 2: Execução da aplicação
#
FROM node:20-alpine AS runner

WORKDIR /app

# Cria um usuário e grupo não-root para executar a aplicação
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copia as dependências do Playwright instaladas na fase de build
COPY --from=build /ms-playwright/ /ms-playwright/

# Copia os arquivos de build da fase anterior
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/public ./public

# Define as permissões corretas para os diretórios
# O usuário 'nextjs' precisa ter permissão para escrever no diretório temporário
RUN mkdir -p /tmp/ghl-robot-screenshots && \
    chown -R nextjs:nodejs /tmp/ghl-robot-screenshots && \
    chown -R nextjs:nodejs ./.next

# Define o usuário não-root para executar a aplicação
USER nextjs

EXPOSE 3000

ENV PORT 3000

# Comando para iniciar a aplicação
CMD ["npm", "start"]
