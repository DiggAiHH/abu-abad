#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   CF_TUNNEL_NAME=abu-abad-doctor CF_HOSTNAME=doctor.example.com ./scripts/doctor-tunnel-setup.sh

: "${CF_TUNNEL_NAME:?Set CF_TUNNEL_NAME}"
: "${CF_HOSTNAME:?Set CF_HOSTNAME (e.g. doctor.example.com)}"

command -v cloudflared >/dev/null 2>&1 || { echo "cloudflared not installed" >&2; exit 1; }

# 1) Login (opens browser)
cloudflared tunnel login

# 2) Create named tunnel (idempotent-ish: if exists, command will error; user can reuse)
set +e
create_out=$(cloudflared tunnel create "$CF_TUNNEL_NAME" 2>&1)
rc=$?
set -e

if [[ $rc -ne 0 ]]; then
  echo "$create_out" >&2
  echo "If tunnel already exists, continuing..." >&2
fi

# 3) Resolve tunnel UUID
uuid=$(cloudflared tunnel list --output json | node -e "const fs=require('fs');const s=fs.readFileSync(0,'utf8');const arr=JSON.parse(s);const name=process.env.CF_TUNNEL_NAME;const t=arr.find(x=>x.name===name);if(!t){process.exit(2)};process.stdout.write(t.id);")

# 4) Write config template
mkdir -p cloudflared
cfg=cloudflared/config.yml
sed -e "s/TUNNEL_UUID/$uuid/g" -e "s/HOSTNAME/$CF_HOSTNAME/g" cloudflared/config.yml.example > "$cfg"

echo "Wrote $cfg"

# 5) Route DNS
cloudflared tunnel route dns "$CF_TUNNEL_NAME" "$CF_HOSTNAME"

echo "DONE"
echo "Next: docker compose -f docker-compose.doctor.yml up -d --build"
