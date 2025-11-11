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

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "src/index.js"]
