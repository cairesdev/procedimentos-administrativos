# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# O nome do app entra no bundle no build (variável NEXT_PUBLIC_*).
# Sem --build-arg, vale o default de shared/config/app.ts.
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_APP_SHORT_NAME
ARG NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME} \
    NEXT_PUBLIC_APP_SHORT_NAME=${NEXT_PUBLIC_APP_SHORT_NAME} \
    NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}

# AUTH_SECRET só é exigido em runtime; o build precisa de um valor qualquer.
ENV AUTH_SECRET=build-time-placeholder
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apk add --no-cache tini

COPY --from=build /app/public ./public
# O standalone traz server.js e só as dependências que o app realmente usa.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
