# Environment Variables Reference

This document provides a comprehensive reference for all environment variables used in the MonPetitBiz WhatsApp Bot application.

## Core Application Configuration

### Database Configuration
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_HOST` | ✅ | localhost | PostgreSQL database host |
| `DATABASE_PORT` | ✅ | 5432 | PostgreSQL database port |
| `DATABASE_USERNAME` | ✅ | postgres | Database username |
| `DATABASE_PASSWORD` | ✅ | - | Database password |
| `DATABASE_NAME` | ✅ | monpetitbiz | Database name |

### JWT Authentication
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | ✅ | - | Secret key for JWT token signing |
| `JWT_EXPIRES_IN` | ❌ | 7d | JWT token expiration time |

### Admin Portal Integration
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SERVICE_TOKEN` | ✅ | - | Service token for admin portal authentication. This token allows the admin portal to access any business data without ownership checks. Must match `BACKEND_SERVICE_TOKEN` in the admin portal configuration. |

### Application Settings
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | ❌ | 9000 | Application port |
| `NODE_ENV` | ❌ | development | Environment: development, production, test |
| `FRONTEND_URL` | ❌ | http://localhost:3001 | Admin portal URL for CORS configuration (e.g., https://admin.monpetitbiz.com) |

## WhatsApp Integration (Twilio - Primary)

### Core Twilio Configuration
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TWILIO_ACCOUNT_SID` | ✅ | - | Twilio Account SID (starts with AC) |
| `TWILIO_AUTH_TOKEN` | ✅ | - | Twilio Auth Token |
| `TWILIO_WHATSAPP_NUMBER` | ✅ | - | Twilio WhatsApp number (whatsapp:+1234567890) |

### Twilio Security & Configuration
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TWILIO_WEBHOOK_SECRET` | ⚠️ | - | Webhook signature verification secret |
| `TWILIO_ENVIRONMENT` | ❌ | production | Environment: 'production' or 'sandbox' |
| `TWILIO_RETRY_ATTEMPTS` | ❌ | 3 | Number of retry attempts for failed API calls |
| `TWILIO_TIMEOUT` | ❌ | 30000 | API timeout in milliseconds |

### Provider Configuration
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WHATSAPP_PRIMARY_PROVIDER` | ✅ | twilio | Primary provider: 'twilio' or 'meta' |
| `WHATSAPP_ENABLE_TWILIO_SENDING` | ✅ | true | Enable Twilio for sending messages |
| `WHATSAPP_ENABLE_TWILIO_WEBHOOKS` | ✅ | true | Enable Twilio webhook processing |
| `WHATSAPP_FALLBACK_ENABLED` | ❌ | false | Enable fallback to secondary provider |
| `WHATSAPP_HEALTH_CHECK_INTERVAL` | ❌ | 300000 | Health check interval in milliseconds |

## WhatsApp Integration (Meta - Optional Fallback)

### Meta API Configuration
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WHATSAPP_ACCESS_TOKEN` | ❌ | - | Meta WhatsApp Cloud API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | ❌ | - | Meta WhatsApp phone number ID |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | ❌ | - | Meta webhook verification token |
| `WHATSAPP_APP_SECRET` | ❌ | - | Meta app secret for webhook signature verification |
| `WHATSAPP_ENABLE_META_FALLBACK` | ❌ | false | Enable Meta API as fallback provider |

## HTTPS Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `USE_HTTPS` | ❌ | false | Enable HTTPS server |
| `SSL_KEY_PATH` | ❌ | ssl/private-key.pem | Path to SSL private key |
| `SSL_CERT_PATH` | ❌ | ssl/certificate.pem | Path to SSL certificate |

## AWS Configuration (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | ❌ | - | AWS access key for S3 operations |
| `AWS_SECRET_ACCESS_KEY` | ❌ | - | AWS secret key for S3 operations |
| `AWS_REGION` | ❌ | us-east-1 | AWS region for S3 bucket |
| `AWS_S3_BUCKET` | ❌ | - | S3 bucket name for file storage |

## Redis Configuration (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | ❌ | - | Redis connection URL for message queue |

## Logging Configuration (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOG_LEVEL` | ❌ | info | Logging level: debug, info, warn, error |
| `LOG_FILE` | ❌ | - | Log file path (logs to console if not set) |

## Rate Limiting (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_TTL` | ❌ | 60 | Rate limit time window in seconds |
| `RATE_LIMIT_LIMIT` | ❌ | 100 | Maximum requests per time window |

## Webhook Security (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WEBHOOK_TIMEOUT` | ❌ | 30000 | Webhook processing timeout in milliseconds |
| `MAX_WEBHOOK_RETRIES` | ❌ | 3 | Maximum webhook retry attempts |

## Environment Variable Validation

The application validates environment variables on startup and will fail to start if required variables are missing or invalid.

### Validation Rules

#### Twilio Configuration
- `TWILIO_ACCOUNT_SID` must start with "AC" and be 34 characters long
- `TWILIO_AUTH_TOKEN` must be 32 characters long
- `TWILIO_WHATSAPP_NUMBER` must be in format "whatsapp:+[country][number]"
- `TWILIO_WEBHOOK_SECRET` should be a strong, random string (recommended 32+ characters)

#### Database Configuration
- `DATABASE_PORT` must be a valid port number (1-65535)
- `DATABASE_HOST` must be a valid hostname or IP address

#### JWT Configuration
- `JWT_SECRET` must be at least 32 characters long for security
- `JWT_EXPIRES_IN` must be a valid time string (e.g., "7d", "24h", "3600s")

## Configuration Examples

### Production Configuration
```bash
# Database
DATABASE_HOST=prod-db.example.com
DATABASE_PORT=5432
DATABASE_USERNAME=app_user
DATABASE_PASSWORD=secure_password_here
DATABASE_NAME=monpetitbiz_prod

# JWT
JWT_SECRET=your-super-secure-jwt-secret-key-at-least-32-characters-long
JWT_EXPIRES_IN=7d

# Twilio (Primary)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
TWILIO_WEBHOOK_SECRET=your-strong-webhook-secret-32-chars-min
TWILIO_ENVIRONMENT=production

# Provider Configuration
WHATSAPP_PRIMARY_PROVIDER=twilio
WHATSAPP_ENABLE_TWILIO_SENDING=true
WHATSAPP_ENABLE_TWILIO_WEBHOOKS=true
WHATSAPP_FALLBACK_ENABLED=false

# Application
PORT=3000
NODE_ENV=production
USE_HTTPS=true
SSL_KEY_PATH=/etc/ssl/private/app.key
SSL_CERT_PATH=/etc/ssl/certs/app.crt

# AWS (for PDF reports)
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1
AWS_S3_BUCKET=monpetitbiz-reports-prod

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/monpetitbiz/app.log

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=100
```

### Development Configuration
```bash
# Database (local)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=dev_password
DATABASE_NAME=monpetitbiz_dev

# JWT
JWT_SECRET=dev-jwt-secret-key-change-in-production
JWT_EXPIRES_IN=24h

# Twilio (Sandbox)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
TWILIO_WEBHOOK_SECRET=dev-webhook-secret
TWILIO_ENVIRONMENT=sandbox

# Provider Configuration
WHATSAPP_PRIMARY_PROVIDER=twilio
WHATSAPP_ENABLE_TWILIO_SENDING=true
WHATSAPP_ENABLE_TWILIO_WEBHOOKS=true

# Application
PORT=3000
NODE_ENV=development
USE_HTTPS=false

# Logging
LOG_LEVEL=debug
```

### Testing Configuration
```bash
# Use in-memory database for tests
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=test_user
DATABASE_PASSWORD=test_password
DATABASE_NAME=monpetitbiz_test

# JWT
JWT_SECRET=test-jwt-secret-key-for-testing-only
JWT_EXPIRES_IN=1h

# Twilio (Test credentials)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=test_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+15005550006
TWILIO_ENVIRONMENT=sandbox

# Provider Configuration
WHATSAPP_PRIMARY_PROVIDER=twilio
WHATSAPP_ENABLE_TWILIO_SENDING=false  # Disable actual sending in tests
WHATSAPP_ENABLE_TWILIO_WEBHOOKS=true

# Application
PORT=3001
NODE_ENV=test
LOG_LEVEL=error  # Reduce log noise in tests
```

## Security Best Practices

### Credential Management
1. **Never commit credentials to version control**
2. **Use environment-specific .env files**
3. **Rotate credentials regularly**
4. **Use strong, random secrets for JWT and webhooks**
5. **Limit access to production credentials**

### Environment Separation
1. **Use different credentials for each environment**
2. **Separate databases for dev/staging/production**
3. **Use Twilio sandbox for development**
4. **Implement proper access controls**

### Monitoring
1. **Monitor for configuration errors on startup**
2. **Set up alerts for credential expiration**
3. **Log configuration validation results**
4. **Monitor webhook signature verification failures**

## Troubleshooting

### Common Configuration Issues

#### Twilio Authentication Errors
```
Error: Authentication failed - check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN
```
**Solution**: Verify credentials in Twilio Console under Account > API Keys & Tokens

#### Webhook Signature Verification Failed
```
Error: Invalid webhook signature
```
**Solution**: Ensure `TWILIO_WEBHOOK_SECRET` matches the value configured in Twilio Console

#### Database Connection Failed
```
Error: Connection refused - check DATABASE_HOST and DATABASE_PORT
```
**Solution**: Verify database is running and accessible from application server

#### JWT Token Issues
```
Error: JWT secret must be at least 32 characters long
```
**Solution**: Generate a stronger JWT secret with at least 32 characters

### Configuration Validation
Use the built-in configuration validation endpoint:
```bash
curl http://localhost:3000/health
```

This will return the status of all configuration components and help identify issues.

## Migration from Meta API

If migrating from Meta WhatsApp Cloud API, see the [Twilio Guide](./twilio-guide.md#migration-from-meta-api) for detailed instructions.

### Key Changes
- Replace Meta API credentials with Twilio credentials
- Update webhook endpoints from `/whatsapp/webhook` to `/whatsapp/twilio/webhook`
- Change provider configuration to use Twilio as primary
- Optional: Keep Meta credentials for fallback during transition

## Support

For configuration issues:
1. Check application startup logs for validation errors
2. Use health check endpoints to verify configuration
3. Consult the troubleshooting section above
4. Review the example configurations for your environment type