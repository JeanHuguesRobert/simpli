#!/bin/bash
# Start SimpliWiki with tunnel for GitHub OAuth testing
# Usage: ./start-with-tunnel.sh

echo "🚀 Starting SimpliWiki with tunnel..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSEME_TUNNEL="$SCRIPT_DIR/../inseme/apps/platform/scripts/tunnel.js"

# Check if inseme tunnel script exists
if [ ! -f "$INSEME_TUNNEL" ]; then
    echo "❌ Tunnel script not found at: $INSEME_TUNNEL"
    exit 1
fi

# Start the tunnel in standalone mode
echo "Starting tunnel in standalone mode..."
node "$INSEME_TUNNEL" --standalone --env-file "$SCRIPT_DIR/.env" --port 8080 &
TUNNEL_PID=$!

echo "Tunnel started (PID: $TUNNEL_PID)"

# Wait for tunnel to be ready
sleep 5

# Start SimpliWiki
echo "Starting SimpliWiki..."
cd "$SCRIPT_DIR"
node lib/main.js

# Cleanup on exit
trap "kill $TUNNEL_PID 2>/dev/null" EXIT
