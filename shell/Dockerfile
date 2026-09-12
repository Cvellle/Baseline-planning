FROM node:20-alpine AS build
WORKDIR /app
COPY shell/package.json ./
RUN npm install
COPY shell/tsconfig.json shell/vite.config.ts shell/index.html ./
COPY shell/src ./src
COPY shell/public ./public
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache gettext # provides envsubst
COPY --from=build /app/dist /usr/share/nginx/html
COPY shell/nginx.conf.template /etc/nginx/templates/nginx.conf.template
COPY shell/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
