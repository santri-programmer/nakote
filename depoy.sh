#!/bin/bash

# Jimpitan PWA Deployment Script
echo "🚀 Starting Jimpitan PWA Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PRODUCTION_API_URL="https://your-cloudflare-tunnel-url.trycloudflare.com/api"
BACKUP_DIR="./backups"

# Create backup directory
mkdir -p $BACKUP_DIR

echo -e "${YELLOW}📦 Creating backup of current files...${NC}"
tar -czf "$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).tar.gz" ./*

echo -e "${YELLOW}🔧 Updating configuration for production...${NC}"

# Update API URLs in JavaScript files
echo "Updating API URLs to production..."
sed -i.tmp 's|http://localhost:8080/api|'"$PRODUCTION_API_URL"'|g' script.js
sed -i.tmp 's|http://localhost:8080/api|'"$PRODUCTION_API_URL"'|g' admin/admin.js
sed -i.tmp 's|https://your-cloudflare-tunnel-url.trycloudflare.com/api|'"$PRODUCTION_API_URL"'|g' config.js

# Clean up backup files
rm -f *.tmp admin/*.tmp

echo -e "${YELLOW}📝 Checking for required files...${NC}"

# Check if required files exist
required_files=("index.html" "config.js" "script.js" "admin/dashboard.html" "manifest.json")
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file found${NC}"
    else
        echo -e "${RED}❌ $file missing${NC}"
        exit 1
    fi
done

echo -e "${YELLOW}🔍 Validating configuration...${NC}"

# Validate config.js
if grep -q "$PRODUCTION_API_URL" config.js; then
    echo -e "${GREEN}✅ Production API URL configured correctly${NC}"
else
    echo -e "${RED}❌ Production API URL not found in config.js${NC}"
    exit 1
fi

echo -e "${YELLOW}🌐 Testing production API...${NC}"

# Test API connection (optional)
if command -v curl &> /dev/null; then
    response=$(curl -s -o /dev/null -w "%{http_code}" "$PRODUCTION_API_URL/health" || echo "000")
    if [ "$response" -eq 200 ]; then
        echo -e "${GREEN}✅ Production API is reachable${NC}"
    else
        echo -e "${YELLOW}⚠️  Production API returned status: $response${NC}"
        read -p "Continue deployment? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${RED}Deployment cancelled${NC}"
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}⚠️  curl not available, skipping API test${NC}"
fi

echo -e "${YELLOW}📁 Preparing files for GitHub Pages...${NC}"

# Create CNAME file for custom domain (if needed)
if [ -n "$CUSTOM_DOMAIN" ]; then
    echo "$CUSTOM_DOMAIN" > CNAME
    echo -e "${GREEN}✅ CNAME file created for $CUSTOM_DOMAIN${NC}"
fi

echo -e "${YELLOW}🚀 Deploying to GitHub Pages...${NC}"

# Git operations
if git status &> /dev/null; then
    echo "Staging files..."
    git add .
    
    echo "Committing changes..."
    git commit -m "Deploy to GitHub Pages - Production build $(date '+%Y-%m-%d %H:%M:%S')"
    
    echo "Pushing to GitHub..."
    git push origin main
    
    echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
    echo -e "${GREEN}🌐 Your app will be available at: https://$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')${NC}"
else
    echo -e "${YELLOW}⚠️  Not a git repository, skipping git operations${NC}"
    echo -e "${YELLOW}📁 Please manually upload files to your web server${NC}"
fi

echo -e "${GREEN}🎉 Deployment process completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Wait for GitHub Pages build to complete (2-10 minutes)"
echo "2. Visit your GitHub repository Settings > Pages to check status"
echo "3. Test the production application thoroughly"
echo "4. Monitor for any issues in the browser console"