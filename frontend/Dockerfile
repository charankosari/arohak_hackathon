# The Meridian Grand — Next.js front end.
#
# Build context: the `frontend` directory.
#
#   docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t meridian-web .
#
# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so
# they must be passed as build args — setting them at `docker run` has no
# effect on code already compiled into the browser bundle.

# ---------------------------------------------------------------- deps
FROM node:22-alpine AS deps
WORKDIR /app

# Only the manifests, so this layer is cached until dependencies change.
COPY package.json package-lock.json ./
RUN npm ci

# --------------------------------------------------------------- build
FROM node:22-alpine AS builder
WORKDIR /app

# Default keeps a plain `docker build` working; always override it for a real
# deployment or the browser will call the visitor's own machine.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# -------------------------------------------------------------- runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next's standalone server binds to HOSTNAME; 0.0.0.0 is required inside a
# container or the port publish never reaches it.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder /app/public ./public
# `standalone` already contains the pruned node_modules and a server.js.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Railway injects PORT; honour it when present, else fall back to 3000.
CMD ["sh", "-c", "PORT=${PORT:-3000} node server.js"]
