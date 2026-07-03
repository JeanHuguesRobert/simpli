#!/bin/bash
# Deploy SimpliWiki to fracta VPS
# Usage: ./deploy-to-fracta.sh

set -e

FRACTA_USER="ubuntu"
FRACTA_HOST="fractavolta.com"
FRACTA_DEPLOY_DIR="/srv/simpli"

echo "🚀 Deploying SimpliWiki to fracta..."

# Copy files to fracta
echo "📦 Copying files..."
rsync -av --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '*.log' \
  ./ ${FRACTA_USER}@${FRACTA_HOST}:${FRACTA_DEPLOY_DIR}/

# Install dependencies on fracta
echo "📦 Installing dependencies..."
ssh ${FRACTA_USER}@${FRACTA_HOST} "cd ${FRACTA_DEPLOY_DIR} && npm install --production"

# Setup systemd service
echo "⚙️  Setting up systemd service..."
scp simpliwiki.service ${FRACTA_USER}@${FRACTA_HOST}:/tmp/
ssh ${FRACTA_USER}@${FRACTA_HOST} "sudo mv /tmp/simpliwiki.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable simpliwiki"

# Update Caddyfile
echo "🌐 Updating Caddy configuration..."
ssh ${FRACTA_USER}@${FRACTA_HOST} "sudo tee -a /etc/caddy/Caddyfile > /dev/null << 'EOF'
# SimpliWiki
simpliwiki.fractavolta.com {
    reverse_proxy 127.0.0.1:8080
}
EOF"

# Restart services
echo "🔄 Restarting services..."
ssh ${FRACTA_USER}@${FRACTA_HOST} "sudo systemctl reload caddy && sudo systemctl start simpliwiki"

echo "✅ Done! SimpliWiki should be available at https://simpliwiki.fractavolta.com"
