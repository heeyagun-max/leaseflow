FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/demo-data/package.json packages/demo-data/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY apps/admin-web apps/admin-web
COPY packages packages
COPY data/demo data/demo
RUN npm run build -w @leaseflow/admin-web

FROM node:20-alpine AS runtime

ENV NODE_ENV=production \
    DEMO_MODE=true \
    SANDBOX_EMAIL_MODE=true \
    OPENAI_STORE=false \
    LEASEFLOW_DEMO_STATE_PATH=/app/data/demo/.runtime/state.v1.json

WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/admin-web ./apps/admin-web
COPY --from=build /app/packages ./packages
COPY --from=build /app/data/demo ./data/demo
RUN mkdir -p /app/data/demo/.runtime && chown -R node:node /app/data/demo/.runtime

USER node
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@leaseflow/admin-web", "--", "--hostname", "0.0.0.0", "--port", "3000"]
