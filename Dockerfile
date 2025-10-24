#
# Fase 1: Build da aplicação (Builder)
#
FROM node:20-bookworm-slim AS builder

# Define o diretório de trabalho
WORKDIR /app

# Instala as dependências necessárias para `better-sqlite3` e `playwright`
# A flag --no-install-recommends evita a instalação de pacotes desnecessários
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential python3 && \
    rm -rf /var/lib/apt/lists/*

# Copia os arquivos de definição de dependência
COPY package.json package-lock.json* ./

# Instala as dependências de produção primeiro
RUN npm ci --omit=dev

# Instala as dependências de desenvolvimento (necessárias para o build)
COPY . .
RUN npm install

# Executa o build de produção
RUN npm run build

# Remove as dependências de desenvolvimento para diminuir o tamanho da imagem final
RUN npm prune --omit=dev


#
# Fase 2: Execução da aplicação (Runner)
#
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# Cria um usuário e grupo não-root para executar a aplicação
# Sintaxe para Debian (addgroup/adduser)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --ingroup nodejs nextjs

# Instala as dependências de sistema para o Chromium rodar
# Isso é mais leve do que copiar todo o diretório do Playwright
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Copia os artefatos da fase de build
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Cria o diretório para o banco de dados e define as permissões
# O usuário 'nextjs' precisa ter permissão para escrever neste diretório
RUN mkdir -p /app/db && \
    chown -R nextjs:nodejs /app/db

# Define as permissões para o diretório .next
RUN chown -R nextjs:nodejs ./.next

# Define o usuário não-root para executar a aplicação
USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV NODE_ENV production
# Aponta para o executável do Chromium instalado via apt-get
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin

# Comando para iniciar a aplicação
CMD ["npm", "start"]
