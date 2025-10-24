#
# Fase 1: Instalação das dependências e Build da Aplicação
#
FROM node:20-bookworm AS deps

# Instala as dependências de sistema necessárias para o Playwright rodar o Chromium
# A flag --with-deps tentaria fazer isso, mas fazer manualmente é mais explícito e confiável.
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    --no-install-recommends

WORKDIR /app

# Copia os arquivos de manifesto de dependência e instala
COPY package.json package-lock.json* ./
RUN npm ci

#
# Fase 2: Build da Aplicação
#
FROM node:20-bookworm AS builder
WORKDIR /app

# Copia as dependências da fase anterior
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Instala os navegadores do Playwright. Não usamos --with-deps porque já instalamos na fase anterior.
RUN npx playwright install --with-deps chromium

# Executa o build de produção
RUN npm run build

#
# Fase 3: Imagem Final de Produção
#
FROM node:20-bookworm AS runner
WORKDIR /app

ENV NODE_ENV=production

# Cria um usuário e grupo não-root para segurança
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia os artefatos da fase de build
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

# Define o usuário para executar a aplicação
USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["npm", "start"]
