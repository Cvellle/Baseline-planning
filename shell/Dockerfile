FROM node:20-alpine AS build
WORKDIR /app

COPY shell/package.json ./
RUN npm install

COPY shell/tsconfig.json shell/vite.config.ts shell/index.html ./
COPY shell/src ./src
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY shell/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
