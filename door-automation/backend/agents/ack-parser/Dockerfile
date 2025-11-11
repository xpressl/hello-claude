FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY src ./src

# Copy shared modules
COPY --from=shared /app/shared /app/shared

# Start worker
CMD ["node", "src/worker.js"]
