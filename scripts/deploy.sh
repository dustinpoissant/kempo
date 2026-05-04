#!/bin/bash

# Kempo Production Deployment Script
# Run this on your VPS at 145.79.7.251

echo "🚀 Kempo Production Deployment"
echo "================================"

# Configuration
APP_DIR="/opt/kempo"
REPO_URL="https://github.com/dustinpoissant/kempo.git"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Installing dependencies...${NC}"
# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Install Docker Compose if not installed
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

echo -e "${GREEN}✓ Dependencies installed${NC}"

echo -e "${YELLOW}Step 2: Setting up application directory...${NC}"
# Create app directory
mkdir -p $APP_DIR
cd $APP_DIR

# Clone or pull repository
if [ -d ".git" ]; then
    echo "Pulling latest changes..."
    git pull
else
    echo "Cloning repository..."
    git clone $REPO_URL .
fi

echo -e "${GREEN}✓ Code updated${NC}"

echo -e "${YELLOW}Step 3: Configuring environment...${NC}"
# Create production .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.production .env
    
    # Generate random secrets
    DB_PASSWORD=$(openssl rand -hex 16)
    AUTH_SECRET=$(openssl rand -hex 32)
    
    # Update .env with generated secrets
    sed -i "s/CHANGE_THIS_PASSWORD/$DB_PASSWORD/g" .env
    sed -i "s/GENERATE_A_NEW_SECRET_HERE/$AUTH_SECRET/g" .env
    
    echo -e "${YELLOW}⚠️  Please review and update .env file with your actual values${NC}"
    echo "Generated database password and auth secret"
else
    echo ".env file already exists, skipping..."
fi

echo -e "${GREEN}✓ Environment configured${NC}"

echo -e "${YELLOW}Step 4: Building Docker images...${NC}"
docker-compose -f docker-compose.prod.yml build

echo -e "${GREEN}✓ Images built${NC}"

echo -e "${YELLOW}Step 5: Starting containers...${NC}"
docker-compose -f docker-compose.prod.yml up -d

echo -e "${GREEN}✓ Containers started${NC}"

echo -e "${YELLOW}Step 6: Running database migrations...${NC}"
# Wait for database to be ready
sleep 5
docker-compose -f docker-compose.prod.yml exec -T kempo-app npm run db:push || echo "Migration command not found, skipping..."

echo -e "${GREEN}✓ Database ready${NC}"

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Application is running at: http://145.79.7.251:3000"
echo ""
echo "Useful commands:"
echo "  View logs:    cd $APP_DIR && docker-compose -f docker-compose.prod.yml logs -f"
echo "  Stop:         cd $APP_DIR && docker-compose -f docker-compose.prod.yml stop"
echo "  Restart:      cd $APP_DIR && docker-compose -f docker-compose.prod.yml restart"
echo "  Update code:  cd $APP_DIR && git pull && docker-compose -f docker-compose.prod.yml up -d --build"
echo ""
