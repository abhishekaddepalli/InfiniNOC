############################################
# InfiniNOC 2.0 Production Dockerfile
# Enterprise ISP & NOC Telemetry SaaS Platform
# Built independently by Infiniforge Technologies
############################################

# Stage 1: Build Layer
FROM node:20-slim AS builder

WORKDIR /app

# Install system build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy package descriptors
COPY package.json package-lock.json ./

# Install npm dependencies
RUN npm ci --no-audit

# Copy application source code
COPY . .

# Compile Vue 3 frontend bundle
RUN npm run build

# Prune dev dependencies for production
RUN npm prune --omit=dev

############################################
# Stage 2: Production Runtime
############################################
FROM node:20-slim AS runner

WORKDIR /app

# Install runtime utilities (curl, ping, iputils)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    iputils-ping \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3001
ENV UPTIME_KUMA_IS_CONTAINER=1

# Copy built application from builder stage
COPY --from=builder /app /app

# Create persistent data directory
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3001

HEALTHCHECK --interval=60s --timeout=30s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3001/api/entry-page || exit 1

CMD ["node", "server/server.js"]
