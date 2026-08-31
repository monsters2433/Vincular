FROM node:20-alpine

WORKDIR /app

# Copiar archivos de configuración
COPY package.json package-lock.json tsconfig.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY src/ src/

# Compilar TypeScript
RUN npm run build

# Copiar ejemplos (opcional)
COPY examples/ examples/

# Directorio para datos
VOLUME ["/data"]

# Environment variables por defecto
ENV NODE_ENV=production
ENV DATA_PATH=/data

# Health check
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# Comando por defecto: ejecutar dashboard sync
CMD ["node", "dist/examples/homelab-dashboard.js"]
