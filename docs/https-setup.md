# HTTPS Setup Guide for MonPetitBiz

This guide explains how to set up HTTPS for your MonPetitBiz application in different environments.

## 🔒 Quick Start (Development)

### 1. Generate Self-Signed Certificates

```bash
# Generate SSL certificates for development
npm run generate:ssl
```

This creates:
- `ssl/private-key.pem` - Private key
- `ssl/certificate.pem` - Self-signed certificate

### 2. Start with HTTPS

```bash
# Start development server with HTTPS
npm run start:https

# Or set environment variable manually
USE_HTTPS=true npm run start:dev
```

### 3. Access Your Application

- **HTTPS URL**: https://localhost:3000
- **API Docs**: https://localhost:3000/api

**Note**: Your browser will show a security warning for self-signed certificates. Click "Advanced" → "Proceed to localhost" to continue.

## 📋 Environment Configuration

Add these variables to your `.env` file:

```env
# Enable HTTPS
USE_HTTPS=true

# SSL Certificate paths (optional - defaults shown)
SSL_KEY_PATH=ssl/private-key.pem
SSL_CERT_PATH=ssl/certificate.pem

# Update CORS origin for HTTPS
FRONTEND_URL=https://localhost:3001
```

## 🏭 Production Setup

### Option 1: Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot

# Generate certificate for your domain
sudo certbot certonly --standalone -d api.monpetitbiz.com

# Certificates will be in:
# /etc/letsencrypt/live/api.monpetitbiz.com/privkey.pem
# /etc/letsencrypt/live/api.monpetitbiz.com/fullchain.pem
```

Update your production `.env`:

```env
USE_HTTPS=true
SSL_KEY_PATH=/etc/letsencrypt/live/api.monpetitbiz.com/privkey.pem
SSL_CERT_PATH=/etc/letsencrypt/live/api.monpetitbiz.com/fullchain.pem
```

### Option 2: Reverse Proxy (Nginx/Apache)

Keep the app running on HTTP and use a reverse proxy for SSL termination:

```nginx
# /etc/nginx/sites-available/monpetitbiz
server {
    listen 443 ssl;
    server_name api.monpetitbiz.com;

    ssl_certificate /path/to/certificate.pem;
    ssl_certificate_key /path/to/private-key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.monpetitbiz.com;
    return 301 https://$server_name$request_uri;
}
```

### Option 3: Cloud Load Balancer

Use cloud services like AWS ALB, Google Cloud Load Balancer, or Cloudflare for SSL termination.

## 🐳 Docker Setup

### Dockerfile with HTTPS

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .
RUN npm run build

# Create SSL directory
RUN mkdir -p ssl

# Expose HTTPS port
EXPOSE 3000

CMD ["npm", "run", "start:prod"]
```

### Docker Compose with SSL

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - USE_HTTPS=true
      - SSL_KEY_PATH=/app/ssl/private-key.pem
      - SSL_CERT_PATH=/app/ssl/certificate.pem
    volumes:
      - ./ssl:/app/ssl:ro
    depends_on:
      - postgres
```

## 🔧 Troubleshooting

### Certificate Not Found

```bash
Error: ENOENT: no such file or directory, open 'ssl/private-key.pem'
```

**Solution**: Generate certificates first:
```bash
npm run generate:ssl
```

### Permission Denied (Production)

```bash
Error: EACCES: permission denied, open '/etc/letsencrypt/live/...'
```

**Solution**: Run with proper permissions or copy certificates:
```bash
# Option 1: Run as root (not recommended)
sudo npm run start:prod

# Option 2: Copy certificates to app directory
sudo cp /etc/letsencrypt/live/domain/privkey.pem ./ssl/
sudo cp /etc/letsencrypt/live/domain/fullchain.pem ./ssl/
sudo chown app:app ./ssl/*.pem
```

### Browser Security Warning

For development with self-signed certificates:

1. **Chrome**: Click "Advanced" → "Proceed to localhost (unsafe)"
2. **Firefox**: Click "Advanced" → "Accept the Risk and Continue"
3. **Safari**: Click "Show Details" → "visit this website"

### WhatsApp Webhook Issues

WhatsApp requires valid SSL certificates. For development:

1. Use ngrok for HTTPS tunneling:
```bash
# Install ngrok
npm install -g ngrok

# Start your app on HTTP
npm run start:dev

# In another terminal, create HTTPS tunnel
ngrok http 3000

# Use the ngrok HTTPS URL for WhatsApp webhook
```

2. Or use a staging domain with valid SSL

## 📱 Mobile App Considerations

If you have a mobile app connecting to your API:

### iOS App Transport Security (ATS)

Add to `Info.plist` for development:
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

### Android Network Security Config

Add to `res/xml/network_security_config.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
    </domain-config>
</network-security-config>
```

## 🔄 Certificate Renewal

### Let's Encrypt Auto-Renewal

```bash
# Add to crontab for automatic renewal
sudo crontab -e

# Add this line (runs twice daily)
0 12 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx
```

### Manual Renewal

```bash
# Renew certificates
sudo certbot renew

# Restart your application
pm2 restart monpetitbiz
# or
sudo systemctl restart monpetitbiz
```

## 🚀 Deployment Scripts

### Production Start Script

```bash
#!/bin/bash
# scripts/start-production.sh

# Check if certificates exist
if [ ! -f "$SSL_CERT_PATH" ] || [ ! -f "$SSL_KEY_PATH" ]; then
    echo "❌ SSL certificates not found!"
    echo "Certificate: $SSL_CERT_PATH"
    echo "Private Key: $SSL_KEY_PATH"
    exit 1
fi

# Start application with HTTPS
USE_HTTPS=true npm run start:prod
```

### Health Check Script

```bash
#!/bin/bash
# scripts/health-check-https.sh

PROTOCOL=${USE_HTTPS:-false}
if [ "$PROTOCOL" = "true" ]; then
    URL="https://localhost:3000/health"
else
    URL="http://localhost:3000/health"
fi

curl -k -f $URL || exit 1
```

## 📊 Monitoring HTTPS

### Certificate Expiry Monitoring

```bash
#!/bin/bash
# scripts/check-cert-expiry.sh

CERT_PATH=${SSL_CERT_PATH:-"ssl/certificate.pem"}
DAYS_UNTIL_EXPIRY=$(openssl x509 -in "$CERT_PATH" -noout -dates | grep notAfter | cut -d= -f2 | xargs -I {} date -d {} +%s)
CURRENT_DATE=$(date +%s)
DAYS_LEFT=$(( ($DAYS_UNTIL_EXPIRY - $CURRENT_DATE) / 86400 ))

echo "Certificate expires in $DAYS_LEFT days"

if [ $DAYS_LEFT -lt 30 ]; then
    echo "⚠️  Certificate expires soon! Please renew."
    exit 1
fi
```

## 🔐 Security Best Practices

1. **Use Strong Ciphers**: The app uses Node.js defaults which are secure
2. **HSTS Headers**: Consider adding Helmet.js for security headers
3. **Certificate Pinning**: For mobile apps in production
4. **Regular Updates**: Keep certificates and dependencies updated
5. **Monitoring**: Set up alerts for certificate expiry

## 📞 Support

If you encounter issues:

1. Check the logs: `npm run start:https` shows detailed error messages
2. Verify certificate files exist and are readable
3. Ensure ports 443/3000 are not blocked by firewall
4. For production issues, check domain DNS and certificate validity

---

**Next Steps**: After setting up HTTPS, update your WhatsApp webhook URL to use the HTTPS endpoint.