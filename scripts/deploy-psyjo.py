#!/usr/bin/env python3
"""Deploy to new Netlify site 'psyjo' via REST API."""
import json
import os
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

def get_token():
    """Extract Netlify token from config."""
    config_path = Path.home() / '.netlify' / 'config.json'
    if not config_path.exists():
        raise RuntimeError("No Netlify config found. Run 'netlify login' first.")
    
    with open(config_path) as f:
        config = json.load(f)
    
    # Try different token locations
    if 'users' in config:
        for user in config['users'].values():
            if 'auth' in user and 'token' in user['auth']:
                return user['auth']['token']
    if 'access_token' in config:
        return config['access_token']
    
    raise RuntimeError("Could not extract token from config")

def api_request(method, endpoint, token, data=None, content_type='application/json'):
    """Make Netlify API request."""
    url = f"https://api.netlify.com/api/v1/{endpoint}"
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': content_type,
    }
    
    if data and content_type == 'application/json':
        data = json.dumps(data).encode('utf-8')
    
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        raise RuntimeError(f"API error {e.code}: {body}")

def create_zip(dist_dir, zip_path):
    """Create ZIP of dist directory."""
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(dist_dir):
            for file in files:
                if file.endswith('.map'):
                    continue  # Skip source maps
                file_path = Path(root) / file
                arcname = file_path.relative_to(dist_dir)
                zf.write(file_path, arcname)
    return zip_path

def main():
    print("=== Deploying to new Netlify site 'psyjo' ===\n")
    
    # Get token
    print("1. Getting Netlify token...")
    token = get_token()
    print("   Token found ✓\n")
    
    # Create new site
    print("2. Creating new site 'psyjo'...")
    site = api_request('POST', 'sites', token, {'name': 'psyjo'})
    site_id = site['id']
    site_url = site.get('ssl_url') or site.get('url', '')
    print(f"   Site created: {site_url}")
    print(f"   Site ID: {site_id}\n")
    
    # Create ZIP
    dist_dir = Path('/workspaces/abu-abad/apps/frontend/dist')
    zip_path = Path('/tmp/psyjo-dist.zip')
    
    print("3. Creating ZIP of dist...")
    create_zip(dist_dir, zip_path)
    zip_size = zip_path.stat().st_size / 1024 / 1024
    print(f"   ZIP created: {zip_size:.2f} MB\n")
    
    # Deploy
    print("4. Deploying to Netlify...")
    with open(zip_path, 'rb') as f:
        zip_data = f.read()
    
    deploy = api_request('POST', f'sites/{site_id}/deploys', token, zip_data, 'application/zip')
    deploy_id = deploy.get('id', '')
    deploy_url = deploy.get('ssl_url') or deploy.get('url', '')
    
    print(f"   Deploy ID: {deploy_id}")
    print(f"   Deploy URL: {deploy_url}\n")
    
    # Summary
    print("=" * 50)
    print("DEPLOYMENT COMPLETE")
    print("=" * 50)
    print(f"Site Name: psyjo")
    print(f"Site ID: {site_id}")
    print(f"Live URL: {site_url}")
    print(f"Deploy URL: {deploy_url}")
    print("=" * 50)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
