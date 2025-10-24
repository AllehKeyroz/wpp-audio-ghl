# Usamos uma imagem base completa do Debian (Bookworm) com Node.js 20.
# Isso garante a compatibilidade com todas as dependências do Playwright.
FROM node:20-bookworm

# Define o diretório de trabalho dentro do contêiner.
WORKDIR /app

# Atualiza os pacotes e instala as dependências do sistema necessárias para o Playwright/Chromium.
RUN apt-get update && apt-get install -y \
    # Dependências do Chromium
    libgbm1 \
    libnss3 \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxtst6 \
    # Dependências para compilar `better-sqlite3`
    build-essential \
    python3 \
    # Limpa o cache do apt para manter a imagem menor.
    && rm -rf /var/lib/apt/lists/*

# Copia os arquivos de definição de dependência.
COPY package.json package-lock.json* ./

# Instala as dependências do projeto a partir do package-lock.json.
RUN npm ci

# Instala o navegador Chromium para o Playwright.
# O Playwright saberá onde encontrá-lo, pois é instalado no mesmo ambiente.
RUN npx playwright install chromium

# Copia todo o restante do código da aplicação para o diretório de trabalho.
COPY . .

# Executa o build de produção do Next.js.
RUN npm run build

# Expõe a porta que o Next.js usará.
EXPOSE 3000

# Define a porta como variável de ambiente.
ENV PORT 3000

# O comando para iniciar a aplicação em modo de produção.
CMD ["npm", "start"]
