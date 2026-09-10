# Build context is the repo root -- see docker-compose.yml -- because this
# app depends on the sibling ../domain package via a "file:" reference.
FROM node:20-alpine AS build

WORKDIR /app/domain
COPY domain/package.json domain/package-lock.json* ./
RUN npm install
COPY domain/tsconfig.json ./
COPY domain/src ./src
RUN npm run build

WORKDIR /app/people
COPY people/package.json ./
RUN npm install
COPY people/tsconfig.json people/vite.config.ts people/index.html ./
COPY people/src ./src
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/people/dist /usr/share/nginx/html
COPY people/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
