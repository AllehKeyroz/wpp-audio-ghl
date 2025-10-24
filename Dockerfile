#
# Fase 1: Build (Builder)
#
FROM node:20-bookworm-slim AS builder

# Instala o build-essential para compilar dependências nativas como o better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Executa o build de produção
RUN npm run build

#
# Fase 2: Produção (Runner)
#
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Cria um usuário e grupo não-root para executar a aplicação
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Instala as dependências do sistema necessárias para o Playwright (navegador)
# Mesmo que o navegador seja copiado, as libs do sistema são necessárias
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Dependências do Playwright
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libgbm1 \
    libgdk-pixbuf-2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxtst6 \
    # Outras dependências úteis
    ca-certificates \
    fonts-liberation \
    lsb-release \
    xdg-utils \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copia os arquivos de build da fase anterior
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Cria o diretório para o banco de dados e define permissões
RUN mkdir -p /app/db && \
    chown -R nextjs:nodejs /app/db

# Muda para o usuário não-root
USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV NODE_ENV=production

# Comando para iniciar a aplicação
CMD ["npm", "start"]
