# The Meridian Grand — Express + Prisma API.
#
# Build context: the `backend` directory.
#
#   docker build -t meridian-api .
#
# Runtime configuration is supplied as environment variables, never baked in:
#   DATABASE_URL   (required)  PostgreSQL connection string
#   JWT_SECRET     (required)  signing secret
#   REDIS_URL      (optional)  caching + shared rate limiting
#   CLOUDINARY_*   (optional)  image uploads
#   CORS_ORIGINS   (required in practice) the front end's public origin
#   RUN_MIGRATIONS=true        apply pending migrations on start

# Debian rather than Alpine: Prisma's query engine needs glibc and OpenSSL,
# and the musl builds are a recurring source of "engine not found" failures.
FROM node:22-slim AS builder
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# Full install: the Prisma CLI is a devDependency but is needed to generate the
# client, and again at runtime for `migrate deploy`.
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# -------------------------------------------------------------- runtime
FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app ./

# Copied and made executable while still root: a checkout on Windows carries no
# exec bit, so relying on the file's own mode would fail.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && chown -R node:node /app

# node:22-slim ships an unprivileged `node` account.
USER node

EXPOSE 4000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
