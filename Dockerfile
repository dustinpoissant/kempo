# Production Dockerfile for Kempo
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application code
COPY drizzle.config.js ./
COPY scripts ./scripts
COPY server ./server
COPY public ./public
COPY templates ./templates

# Expose port
EXPOSE 3000

# Start the application
CMD npm start
