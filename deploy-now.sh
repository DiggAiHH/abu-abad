#!/bin/bash
set -e

NETLIFY_CONFIG_PRIMARY="$HOME/.config/netlify/config.json"
NETLIFY_CONFIG_FALLBACK="$HOME/.netlify/config.json"

NETLIFY_CONFIG=""
if [ -f "$NETLIFY_CONFIG_PRIMARY" ]; then
  NETLIFY_CONFIG="$NETLIFY_CONFIG_PRIMARY"
elif [ -f "$NETLIFY_CONFIG_FALLBACK" ]; then
  NETLIFY_CONFIG="$NETLIFY_CONFIG_FALLBACK"
fi

TOKEN=$(cat "$NETLIFY_CONFIG" 2>/dev/null | python3 -c "import sys,json; c=json.load(sys.stdin); print(c.get('access_token','') or (list((c.get('users') or {}).values())[0].get('auth',{}).get('token','') if (c.get('users') or {}) else ''))")

if [ -z "$NETLIFY_CONFIG" ]; then
  echo "ERROR: No Netlify config found. Expected $NETLIFY_CONFIG_PRIMARY"
  echo "Fix: Run 'netlify login' once (interactive) and retry."
  exit 1
fi

if [ -z "$TOKEN" ]; then
  echo "ERROR: No Netlify token found in $NETLIFY_CONFIG"
  echo "Fix: Run 'netlify login' once (interactive) and retry."
  exit 1
fi

SITE_NAME_DEFAULT="psyjo"
SITE_NAME="${NETLIFY_SITE_NAME:-${1:-$SITE_NAME_DEFAULT}}"

unique_site_name() {
  # e.g. psyjo-20260116-184530-a1b2c3
  local base="$1"
  printf "%s-%s-%s" "$base" "$(date +%Y%m%d-%H%M%S)" "$(tr -dc 'a-f0-9' </dev/urandom | head -c 6)"
}

cd /workspaces/abu-abad/apps/frontend/dist
zip -r /tmp/deploy.zip . -x "*.DS_Store"
echo "ZIP created: $(ls -lh /tmp/deploy.zip | awk '{print $5}')"

# Try to create site
echo "Creating site '$SITE_NAME'..."
SITE_RESP=$(curl -s -w "\n%{http_code}" -X POST "https://api.netlify.com/api/v1/sites" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$SITE_NAME\"}")

HTTP_CODE=$(echo "$SITE_RESP" | tail -1)
SITE_BODY=$(echo "$SITE_RESP" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
  SITE_ID=$(echo "$SITE_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
  echo "Created new site: $SITE_ID"
elif [ "$HTTP_CODE" = "422" ]; then
  # Name conflict or validation issue. First try to find it in the current account.
  echo "Site name not available or already exists. Trying to find it in your account..."
  SITE_ID=$(curl -s "https://api.netlify.com/api/v1/sites?name=$SITE_NAME" \
    -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; sites=[s for s in json.load(sys.stdin) if s.get('name')=='$SITE_NAME']; print(sites[0]['id'] if sites else '')")
  if [ -n "$SITE_ID" ]; then
    echo "Found existing site in your account: $SITE_ID"
  else
    # Create a unique name and retry.
    SITE_NAME_UNIQUE="$(unique_site_name "$SITE_NAME")"
    echo "Name '$SITE_NAME' is taken. Creating unique site '$SITE_NAME_UNIQUE'..."
    SITE_RESP=$(curl -s -w "\n%{http_code}" -X POST "https://api.netlify.com/api/v1/sites" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"$SITE_NAME_UNIQUE\"}")
    HTTP_CODE=$(echo "$SITE_RESP" | tail -1)
    SITE_BODY=$(echo "$SITE_RESP" | sed '$d')
    if [ "$HTTP_CODE" != "201" ]; then
      echo "ERROR: Could not create site. HTTP $HTTP_CODE"
      echo "$SITE_BODY"
      exit 1
    fi
    SITE_ID=$(echo "$SITE_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
    SITE_NAME="$SITE_NAME_UNIQUE"
    echo "Created new site: $SITE_ID"
  fi
else
  echo "ERROR: Unexpected response from Netlify Sites API: HTTP $HTTP_CODE"
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

SITE_LIVE_URL=$(echo "$DEPLOY_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); site=d.get('site') or {}; print(site.get('ssl_url') or site.get('url') or '')")

echo ""
echo "=================================================="
echo "Deploy state: $DEPLOY_STATE"
if [ -n "$SITE_LIVE_URL" ]; then
  echo "🚀 LIVE URL: $SITE_LIVE_URL"
else
  echo "🚀 DEPLOY URL: $DEPLOY_URL"
  echo "ℹ️  SITE NAME: $SITE_NAME"
fi
echo "=================================================="
