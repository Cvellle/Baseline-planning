# Build context is the repo root (see docker-compose.yml), because this
# service depends on the sibling ../domain package via a "file:" reference.
FROM node:20-alpine AS build

WORKDIR /app/domain
COPY domain/package.json domain/package-lock.json* ./
RUN npm install
COPY domain/tsconfig.json ./
COPY domain/src ./src
RUN npm run build

WORKDIR /app/api
COPY api/package.json ./
RUN npm install --omit=dev
COPY api/src ./src
COPY api/data ./data

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/domain/package.json /app/domain/package.json
COPY --from=build /app/domain/dist /app/domain/dist
COPY --from=build /app/api /app/api
WORKDIR /app/api
ENV PORT=3000
EXPOSE 3000
CMD ["node", "src/server.js"]
