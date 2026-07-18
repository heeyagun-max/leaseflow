FROM node:20-alpine AS build

ARG EXPO_PUBLIC_LEASEFLOW_API_URL=http://localhost:3000
ENV EXPO_PUBLIC_LEASEFLOW_API_URL=${EXPO_PUBLIC_LEASEFLOW_API_URL}

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/demo-data/package.json packages/demo-data/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY apps/mobile apps/mobile
COPY packages packages
RUN cd apps/mobile && npx expo export --platform web --output-dir dist

FROM nginx:1.27-alpine AS runtime
COPY deploy/mobile-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/mobile/dist /usr/share/nginx/html
EXPOSE 8081
