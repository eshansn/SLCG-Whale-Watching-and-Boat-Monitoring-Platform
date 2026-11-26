FROM node:22-alpine AS build
WORKDIR /src/apps/web

COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/ ./
# Browser requests use the same-origin Nginx proxy; no server secrets enter the bundle.
ENV VITE_API_BASE_URL=""
RUN npm run build

FROM nginx:stable-alpine AS runtime
COPY docker/web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
