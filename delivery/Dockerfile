FROM node:20-alpine AS build
WORKDIR /app/delivery

COPY delivery/package.json ./
RUN npm install

COPY delivery/tsconfig.json delivery/vite.config.ts delivery/index.html ./
COPY delivery/src ./src
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/delivery/dist /usr/share/nginx/html
COPY delivery/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
