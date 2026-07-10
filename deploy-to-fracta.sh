#!/bin/bash
# Deploy SimpliWiki to fracta VPS
# Usage: ./deploy-to-fracta.sh

set -e

FRACTA_USER="ubuntu"
FRACTA_HOST="fracta"
FRACTA_DEPLOY_DIR="/srv/simpli"
NODE_VERSION="26.5.0"

echo "🚀 Deploying SimpliWiki to fracta..."

# Copy files to fracta
echo "📦 Copying files..."
copy_with_tar() {
  ssh ${FRACTA_USER}@${FRACTA_HOST} "mkdir -p ${FRACTA_DEPLOY_DIR}"
  tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='.env' \
    --exclude='*.log' \
    --exclude='.tmp' \
    --exclude='*.sqlite*' \
    -czf - . | ssh ${FRACTA_USER}@${FRACTA_HOST} "tar -xzf - -C ${FRACTA_DEPLOY_DIR}"
}

if command -v rsync >/dev/null 2>&1; then
  if ! rsync -av --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.env' \
    --exclude '*.log' \
    --exclude '.tmp' \
    --exclude '*.sqlite*' \
    ./ ${FRACTA_USER}@${FRACTA_HOST}:${FRACTA_DEPLOY_DIR}/; then
    echo "⚠️ rsync failed, falling back to tar-over-ssh..."
    copy_with_tar
  fi
else
  copy_with_tar
fi

# Install dependencies on fracta
echo "📦 Installing Node.js v${NODE_VERSION}..."
ssh ${FRACTA_USER}@${FRACTA_HOST} "set -e; \
  arch=\$(uname -m); \
  case \"\$arch\" in \
    x86_64) node_arch=x64 ;; \
    aarch64|arm64) node_arch=arm64 ;; \
    *) echo \"Unsupported Node.js architecture: \$arch\" >&2; exit 1 ;; \
  esac; \
  cd /tmp; \
  curl -fsSLO https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-\${node_arch}.tar.xz; \
  sudo rm -rf /usr/local/node-v${NODE_VERSION}; \
  sudo tar -xJf node-v${NODE_VERSION}-linux-\${node_arch}.tar.xz -C /usr/local; \
  sudo mv /usr/local/node-v${NODE_VERSION}-linux-\${node_arch} /usr/local/node-v${NODE_VERSION}; \
  sudo ln -sfn /usr/local/node-v${NODE_VERSION}/bin/node /usr/local/bin/node; \
  sudo ln -sfn /usr/local/node-v${NODE_VERSION}/bin/npm /usr/local/bin/npm; \
  sudo ln -sfn /usr/local/node-v${NODE_VERSION}/bin/npx /usr/local/bin/npx; \
  /usr/local/bin/node -v"

echo "📦 Installing dependencies..."
ssh ${FRACTA_USER}@${FRACTA_HOST} "cd ${FRACTA_DEPLOY_DIR} && /usr/local/bin/npm install --production"

# Setup systemd service
echo "⚙️  Setting up systemd service..."
scp simpliwiki.service simpli-js.service ${FRACTA_USER}@${FRACTA_HOST}:/tmp/
ssh ${FRACTA_USER}@${FRACTA_HOST} "sudo mv /tmp/simpliwiki.service /tmp/simpli-js.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable simpliwiki simpli-js"

# Update Caddyfile
echo "🌐 Updating Caddy configuration..."
ssh ${FRACTA_USER}@${FRACTA_HOST} "if ! sudo grep -q '^simpliwiki.fractavolta.com {' /etc/caddy/Caddyfile; then sudo tee -a /etc/caddy/Caddyfile > /dev/null << 'EOF'
# SimpliWiki
simpliwiki.fractavolta.com {
    reverse_proxy 127.0.0.1:8081
}
EOF
fi"

# Restart services
echo "🔄 Restarting services..."
ssh ${FRACTA_USER}@${FRACTA_HOST} "sudo systemctl reload caddy && sudo systemctl restart simpli-js && sudo systemctl stop simpliwiki || true; sudo pkill -u ${FRACTA_USER} -f '^/usr/bin/node /srv/simpli/src/main.js$' || true; sudo pkill -u ${FRACTA_USER} -f '^/usr/local/bin/node /srv/simpli/src/main.js$' || true; sudo systemctl restart simpliwiki"

echo "✅ Done! SimpliWiki should be available at https://simpliwiki.fractavolta.com"
