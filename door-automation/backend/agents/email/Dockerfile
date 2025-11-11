# Email Worker Agent Dockerfile

FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Copy shared dependencies (db, normalization)
COPY ../shared/ ./shared/

# Copy orchestrator's multi-agent-plan module for plan updates
RUN mkdir -p ./orchestrator/src
COPY ../orchestrator/src/multi-agent-plan.js ./orchestrator/src/
COPY ../orchestrator/src/minio-client.js ./orchestrator/src/

# Set environment
ENV NODE_ENV=production

# Health check (optional - checks if process is running)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Run worker
CMD ["node", "src/worker.js"]
