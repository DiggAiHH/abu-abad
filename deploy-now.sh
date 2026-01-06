#!/bin/bash
set -e

TOKEN=$(cat ~/.netlify/config.json 2>/dev/null | python3 -c "import sys,json; c=json.load(sys.stdin); print(c.get('access_token','') or list(c.get('users',{}).values())[0].get('auth',{}).get('token',''))")

echo "Token found: ${TOKEN:0:20}..."

cd /workspaces/abu-abad/apps/frontend/dist
zip -r /tmp/deploy.zip . -x "*.DS_Store"
echo "ZIP created: $(ls -lh /tmp/deploy.zip | awk '{print $5}')"

# Try to create site
echo "Creating site 'psyjo'..."
SITE_RESP=$(curl -s -w "\n%{http_code}" -X POST "https://api.netlify.com/api/v1/sites" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"psyjo"}')

HTTP_CODE=$(echo "$SITE_RESP" | tail -1)
SITE_BODY=$(echo "$SITE_RESP" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
  SITE_ID=$(echo "$SITE_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
  echo "Created new site: $SITE_ID"
elif [ "$HTTP_CODE" = "422" ]; then
  echo "Site exists, finding it..."
  SITE_ID=$(curl -s "https://api.netlify.com/api/v1/sites?name=psyjo" \
    -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; sites=[s for s in json.load(sys.stdin) if s.get('name')=='psyjo']; print(sites[0]['id'] if sites else '')")
  if [ -z "$SITE_ID" ]; then
    echo "Could not find existing site"
    exit 1
  fi
  echo "Found existing site: $SITE_ID"
else
  echo "Unexpected response: $HTTP_CODE"
  echo "$SITE_BODY"
  exit 1
fi

# Deploy
echo "Deploying..."
DEPLOY_RESP=$(curl -s -X POST "https://api.netlify.com/api/v1/sites/$SITE_ID/deploys" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/zip" \
  --data-binary @/tmp/deploy.zip)

DEPLOY_URL=$(echo "$DEPLOY_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('deploy_ssl_url') or d.get('ssl_url') or d.get('url',''))")
DEPLOY_STATE=$(echo "$DEPLOY_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('state',''))")

echo ""
echo "=================================================="
echo "Deploy state: $DEPLOY_STATE"
echo "🚀 LIVE URL: https://psyjo.netlify.app"
echo "=================================================="
