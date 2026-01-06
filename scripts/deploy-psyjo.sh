#!/bin/bash
set -e

# Get Netlify token from config
CONFIG_FILE="$HOME/.netlify/config.json"
if [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: No Netlify config found. Run 'netlify login' first."
  exit 1
fi

# Extract token (using Python for reliable JSON parsing)
TOKEN=$(python3 -c "
import json
with open('$CONFIG_FILE') as f:
    config = json.load(f)
# Try different token locations
token = None
if 'users' in config:
    for user in config['users'].values():
        if 'auth' in user and 'token' in user['auth']:
            token = user['auth']['token']
            break
if not token and 'access_token' in config:
    token = config['access_token']
print(token or '')
")

if [ -z "$TOKEN" ]; then
  echo "ERROR: Could not extract token from config"
  exit 1
fi

echo "Token found. Creating new site 'psyjo'..."

# Create new site via API
SITE_RESPONSE=$(curl -s -X POST "https://api.netlify.com/api/v1/sites" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "psyjo"}')

SITE_ID=$(echo "$SITE_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
SITE_URL=$(echo "$SITE_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ssl_url', d.get('url','')))")

if [ -z "$SITE_ID" ]; then
  echo "Site creation failed. Response:"
  echo "$SITE_RESPONSE"
  exit 1
fi

echo "Site created: $SITE_URL (ID: $SITE_ID)"

# Create ZIP of dist
DIST_DIR="/workspaces/abu-abad/apps/frontend/dist"
ZIP_FILE="/tmp/psyjo-dist.zip"

echo "Creating ZIP of $DIST_DIR..."
cd "$DIST_DIR"
rm -f "$ZIP_FILE"
zip -r "$ZIP_FILE" . -x "*.map"

echo "Deploying to Netlify..."

# Deploy via API
DEPLOY_RESPONSE=$(curl -s -X POST \
  "https://api.netlify.com/api/v1/sites/$SITE_ID/deploys" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/zip" \
  --data-binary @"$ZIP_FILE")

DEPLOY_ID=$(echo "$DEPLOY_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
DEPLOY_URL=$(echo "$DEPLOY_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ssl_url', d.get('url','')))")

echo ""
echo "=========================================="
echo "DEPLOYMENT COMPLETE"
echo "=========================================="
echo "Site ID: $SITE_ID"
echo "Deploy ID: $DEPLOY_ID"
echo "Live URL: $SITE_URL"
echo "Deploy URL: $DEPLOY_URL"
echo "=========================================="
