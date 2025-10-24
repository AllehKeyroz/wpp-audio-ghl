# Estágio 1: Build da Aplicação
# Usamos a imagem oficial do Playwright que já vem com as dependências do navegador.
# Escolhemos a versão que corresponde à do seu package.json para garantir compatibilidade.
FROM mcr.microsoft.com/playwright:v1.45.1-jammy AS builder

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia os arquivos de gerenciamento de pacotes
COPY package.json ./

# Instala as dependências do projeto
# O --force é usado para contornar possíveis conflitos de dependências com o ambiente.
RUN npm install --force

# Copia o restante do código da aplicação
COPY . .

# Remove o comando de instalação do Playwright do script de build,
# pois os navegadores já estão na imagem base.
# Isso evita erros de permissão e downloads desnecessários.
RUN sed -i 's/npx playwright install && //' package.json

# Executa o build da aplicação Next.js
RUN npm run build

# Estágio 2: Produção
# Usamos uma imagem Node.js mais leve para a execução
FROM node:18-slim

WORKDIR /app

# Define o ambiente como produção
ENV NODE_ENV=production
# Define a porta que será exposta
ENV PORT=3000
EXPOSE 3000

# Copia os artefatos do build do estágio anterior
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# O diretório 'temp' e 'public/screenshots' precisam ser criáveis pelo usuário 'nextjs'
RUN mkdir -p temp public/screenshots
RUN chown -R nextjs:nodejs temp public/screenshots ./.next

# Cria um usuário não-root para executar a aplicação por segurança
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

# O comando para iniciar a aplicação Next.js
CMD ["npm", "start", "--", "-p", "3000"]
