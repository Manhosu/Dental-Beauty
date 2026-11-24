FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Dependências (inclui tsx, que roda o TypeScript direto em runtime)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Código-fonte (rodado via tsx — sem etapa de build no runtime)
COPY tsconfig.json ./
COPY src ./src

EXPOSE 3000
USER node
CMD ["npx", "tsx", "src/main.ts"]
