# Dockerfile para GHL Robot Dashboard

# -----------------
# Estágio de Build
# -----------------
FROM node:20-alpine AS build

WORKDIR /app

# Instala pnpm
RUN npm install -g pnpm

# Instala as dependências do Playwright para Alpine
# O comando `playwright install --with-deps` tenta usar 'apt-get', que não existe no Alpine.
# Por isso, instalamos manualmente as dependências do Chromium com 'apk'.
RUN apk add --no-cache udev ttf-freefont chromium

# Copia os arquivos de dependência e instala usando pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm i

# Instala os binários do navegador para o Playwright (sem --with-deps)
RUN pnpm exec playwright install chromium

# Copia o resto do código da aplicação
COPY . .

# Constrói a aplicação Next.js
RUN pnpm build

# Remove dependências de desenvolvimento para diminuir o tamanho da imagem final
RUN pnpm prune --prod


# -----------------
# Estágio de Produção
# -----------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Instala as dependências do Chromium necessárias para a execução
RUN apk add --no-cache udev ttf-freefont chromium

# A imagem base 'alpine' cria um usuário 'node' por padrão.
# Vamos usar este usuário para executar a aplicação por segurança.
USER node

# Copia os artefatos do estágio de build
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

# As capturas de tela e sessão são salvas no diretório temporário do sistema (/tmp),
# que já possui as permissões corretas para o usuário 'node'.

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]
