# Dockerfile para Hugging Face Spaces o Render
FROM node:20-alpine

# Directorio de trabajo
WORKDIR /app

# Copiar dependencias
COPY package*.json ./
RUN npm install --production

# Copiar código del servidor y la interfaz web pública
COPY . .

# Exponer el puerto requerido por Hugging Face (7860)
EXPOSE 7860

# Definir variables de entorno
ENV PORT=7860
ENV NODE_ENV=production

# Comando para iniciar el servidor
CMD ["node", "server.js"]
