# Production Dockerfile for Kempo
FROM node:18-alpine

# Install sendmail for email functionality
RUN apk add --no-cache postfix

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

# Start postfix and the application
CMD postfix start && node server/index.js || npm start
