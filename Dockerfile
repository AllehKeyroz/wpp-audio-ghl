#
# FASE 1: BUILD (Instala dependências Node/Playwright)
#
FROM node:20-alpine AS build

# --- CORREÇÃO 1: Definir o caminho do Playwright ANTES da instalação
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright/

# Instala as dependências de sistema (Chromium) para Alpine Linux
RUN apk add --no-cache chromium

# Define o diretório de trabalho
WORKDIR /app

# Copia e instala as dependências do Node.js
COPY package.json package-lock.json* ./
RUN npm ci

# Instala os binários do navegador no caminho definido (/ms-playwright/)
RUN npx playwright install chromium

# Copia o restante do código da aplicação
COPY . .

# Executa o build da aplicação Next.js
RUN npm run build

#
# FASE 2: RUNNER (Ambiente de Execução Final)
#
# Use uma imagem com Node e Python, ou instale Python
FROM node:20-alpine AS runner

# Instalar Python e Pip no ambiente de execução (Alpine)
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Cria um usuário e grupo não-root para executar a aplicação
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# --- CORREÇÃO 2: Copia o caminho completo do cache do Playwright
# Copia o cache do Playwright da fase de build para o mesmo local na fase runner
COPY --from=build /ms-playwright/ /ms-playwright/

# --- CORREÇÃO 3: Copiar o código Python e instalar as dependências Python
COPY requirements.txt .
COPY ghl_robot_local.py .
RUN pip3 install -r requirements.txt

# Copia os arquivos de build da fase anterior
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/public ./public

# Define as permissões corretas para os diretórios
RUN mkdir -p /tmp/ghl-robot-screenshots && \
    chown -R nextjs:nodejs /tmp/ghl-robot-screenshots && \
    chown -R nextjs:nodejs ./.next

# Define o usuário não-root para executar a aplicação
USER nextjs

EXPOSE 3000

# Define a variável de ambiente para que o Playwright encontre o navegador em tempo de execução
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright/

# --- CORREÇÃO 4: Comando para iniciar a aplicação Flask/Python
# Como você tem um robô Flask, este deve ser o comando principal.
# Recomenda-se um servidor WSGI (como Gunicorn ou Hypercorn) para produção.
# Assumindo que você pode instalar Gunicorn em requirements.txt:
# CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:3000", "ghl_robot_local:app"] 
# 
# Se for rodar a aplicação Flask diretamente (não recomendado para produção):
CMD ["python3", "ghl_robot_local.py"]