FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY src ./src

# Note: Shared modules are mounted as volume in docker-compose.yml
# Volume mount: ./backend/shared:/app/shared

# Start worker
CMD ["node", "src/worker.js"]
