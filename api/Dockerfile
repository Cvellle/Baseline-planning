FROM node:20-alpine
WORKDIR /app/api

COPY api/package.json api/package-lock.json* ./
RUN npm install --omit=dev

COPY api/src ./src

ENV PORT=3000
EXPOSE 3000
CMD ["node", "src/server.js"]
