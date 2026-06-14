FROM node:22-alpine AS builder

WORKDIR /app

ARG NPM_TOKEN

COPY package.json package-lock.json ./
RUN echo "@bopacorp:registry=https://npm.pkg.github.com" > .npmrc && \
    echo "//npm.pkg.github.com/:_authToken=${NPM_TOKEN}" >> .npmrc && \
    npm ci && \
    rm -f .npmrc

COPY tsconfig.json ./
COPY src/ src/

RUN npm run build

FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/dist dist/
COPY drizzle/ drizzle/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
