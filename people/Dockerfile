FROM node:20-alpine AS build
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
