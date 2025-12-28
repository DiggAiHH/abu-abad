# 🚀 Deployment-Anleitung

## Übersicht

Diese Anleitung beschreibt die Schritte für ein produktionsreifes Deployment der Therapeuten-Plattform.

## ⚠️ Pre-Deployment Checkliste

### Sicherheit
- [ ] Alle Secrets rotiert (JWT_SECRET, ENCRYPTION_KEY)
- [ ] Stripe Production Keys eingefügt
- [ ] HTTPS/TLS-Zertifikat konfiguriert (Let's Encrypt)
- [ ] Firewall-Regeln konfiguriert
- [ ] Database Backup-Strategie implementiert
- [ ] Rate Limiting getestet
- [ ] Security Audit durchgeführt

### DSGVO
- [ ] Datenschutzerklärung aktualisiert
- [ ] Impressum vorhanden
- [ ] AV-Vertrag mit Hosting-Provider
- [ ] Löschkonzept implementiert
- [ ] Audit-Logs aktiviert
- [ ] Incident Response Plan dokumentiert

### Performance
- [ ] Load Testing durchgeführt
- [ ] CDN für statische Assets (optional)
- [ ] Monitoring (Sentry, Grafana) eingerichtet
- [ ] Log-Aggregation (ELK Stack) konfiguriert

---

## Option 1: Docker Compose (Empfohlen für kleine Setups)

### 1. Server vorbereiten

```bash
# Update System
sudo apt update && sudo apt upgrade -y

# Docker installieren
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose installieren
sudo apt install docker-compose-plugin -y
```

### 2. Repository klonen

```bash
git clone <repository-url> /var/www/therapist-platform
cd /var/www/therapist-platform
```

### 3. Production .env konfigurieren

```bash
cp .env.example .env
nano .env
```

**Wichtige Änderungen:**
```bash
# Starke Secrets generieren
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Production URLs
FRONTEND_URL=https://ihre-domain.de
CORS_ORIGIN=https://ihre-domain.de

# Production Stripe Keys
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx

# NODE_ENV auf production setzen
NODE_ENV=production
```

### 4. SSL-Zertifikat mit Let's Encrypt

```bash
# Certbot installieren
sudo apt install certbot python3-certbot-nginx -y

# Zertifikat generieren
sudo certbot --nginx -d ihre-domain.de
```

### 5. Deployment starten

```bash
docker-compose up -d --build
```

### 6. Logs prüfen

```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

---

## Option 2: Kubernetes (für Skalierung)

### 1. Cluster vorbereiten

```bash
# kubectl installieren
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

### 2. Secrets erstellen

```bash
kubectl create secret generic app-secrets \
  --from-literal=JWT_SECRET=$(openssl rand -base64 32) \
  --from-literal=ENCRYPTION_KEY=$(openssl rand -base64 32) \
  --from-literal=STRIPE_SECRET_KEY=sk_live_xxxxx \
  --from-literal=DATABASE_URL=postgresql://user:pass@postgres:5432/db
```

### 3. Deployment anwenden

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml
```

---

## Option 3: Managed Services (AWS/Azure/GCP)

### AWS Beispiel

**Services:**
- **RDS PostgreSQL** - Managed Database
- **ECS Fargate** - Container Orchestration
- **Application Load Balancer** - HTTPS Termination
- **CloudFront** - CDN für Frontend
- **S3** - Static Assets
- **CloudWatch** - Logging & Monitoring

**Deployment:**
```bash
# AWS CLI konfigurieren
aws configure

# ECR Repositories erstellen
aws ecr create-repository --repository-name therapist-backend
aws ecr create-repository --repository-name therapist-frontend

# Images bauen und pushen
docker build -t therapist-backend:latest -f apps/backend/Dockerfile .
docker tag therapist-backend:latest <account-id>.dkr.ecr.<region>.amazonaws.com/therapist-backend:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/therapist-backend:latest

# ECS Task Definition & Service erstellen
aws ecs create-cluster --cluster-name therapist-cluster
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json
aws ecs create-service --cluster therapist-cluster --service-name backend --task-definition therapist-backend
```

---

## Monitoring Setup

### 1. Health Checks

**Backend Health Endpoint** hinzufügen:
```typescript
// apps/backend/src/index.ts
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

### 2. Sentry für Error Tracking

```bash
npm install @sentry/node @sentry/react
```

**Backend:**
```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

**Frontend:**
```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
});
```

### 3. Prometheus Metrics (optional)

```bash
npm install prom-client
```

---

## Backup-Strategie

### Automatisches PostgreSQL Backup

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/var/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATABASE="therapist_platform"

# Backup erstellen
pg_dump -U postgres $DATABASE | gzip > $BACKUP_DIR/backup_$TIMESTAMP.sql.gz

# Alte Backups löschen (älter als 30 Tage)
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

# Zu S3 hochladen (optional)
aws s3 cp $BACKUP_DIR/backup_$TIMESTAMP.sql.gz s3://ihr-backup-bucket/
```

**Cronjob einrichten:**
```bash
crontab -e
# Täglich um 2 Uhr nachts
0 2 * * * /path/to/backup.sh
```

---

## SSL/TLS-Konfiguration

### nginx SSL-Konfiguration

```nginx
server {
    listen 443 ssl http2;
    server_name ihre-domain.de;

    # SSL Zertifikate
    ssl_certificate /etc/letsencrypt/live/ihre-domain.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ihre-domain.de/privkey.pem;

    # SSL Konfiguration (A+ Rating)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# HTTP -> HTTPS Redirect
server {
    listen 80;
    server_name ihre-domain.de;
    return 301 https://$server_name$request_uri;
}
```

---

## Post-Deployment Tests

### 1. Smoke Tests

```bash
# Backend Health Check
curl https://ihre-domain.de/health

# Frontend lädt
curl -I https://ihre-domain.de

# API erreichbar
curl https://ihre-domain.de/api/auth/me
```

### 2. Load Testing mit k6

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
};

export default function() {
  let res = http.get('https://ihre-domain.de/api/appointments');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

### 3. Security Scan

```bash
# OWASP ZAP Scan
docker run -t owasp/zap2docker-stable zap-baseline.py -t https://ihre-domain.de

# SSL Test
curl https://www.ssllabs.com/ssltest/analyze.html?d=ihre-domain.de
```

---

## Rollback-Prozedur

### Docker Compose

```bash
# Vorherige Version wiederherstellen
git checkout <previous-commit>
docker-compose down
docker-compose up -d --build

# Oder: Tagged Images verwenden
docker-compose down
docker pull therapist-backend:v1.0.0
docker-compose up -d
```

### Database Rollback

```bash
# Backup wiederherstellen
gunzip < backup_20240101_020000.sql.gz | psql -U postgres therapist_platform
```

---

## Kosten-Beispiel (AWS)

**Kleine Praxis (10-50 Patienten):**
- RDS PostgreSQL (db.t3.micro): ~$15/Monat
- ECS Fargate (2 vCPU, 4GB): ~$50/Monat
- ALB: ~$20/Monat
- CloudFront: ~$5/Monat
- **Total: ~$90/Monat**

**Mittlere Praxis (100-500 Patienten):**
- RDS PostgreSQL (db.t3.medium): ~$60/Monat
- ECS Fargate (4 vCPU, 8GB): ~$120/Monat
- ALB: ~$20/Monat
- CloudFront: ~$15/Monat
- **Total: ~$215/Monat**

---

## Support & Wartung

**Regelmäßige Aufgaben:**
- [ ] Dependency Updates (monatlich)
- [ ] Security Patches (sofort)
- [ ] Backup Tests (wöchentlich)
- [ ] Log-Review (täglich)
- [ ] Performance Monitoring (kontinuierlich)

**Incident Response:**
1. Logs prüfen
2. Sentry Errors analysieren
3. Rollback wenn nötig
4. Hotfix deployen
5. Post-Mortem dokumentieren
