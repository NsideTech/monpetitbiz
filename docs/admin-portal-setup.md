# Admin Portal Setup Guide

This guide explains how to set up and deploy the MonPetitBiz Admin Portal as a separate application.

## Overview

The Admin Portal is a Next.js web application that provides a dashboard interface for business owners to manage their MonPetitBiz account. It is deployed separately from the main API backend and communicates with it via REST API calls.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│  Admin Portal   │────────▶│  MonPetitBiz API │
│  (Next.js)      │  HTTP   │  (NestJS)        │
│                 │  + JWT  │                  │
└─────────────────┘         └──────────────────┘
```

- **Admin Portal**: Frontend application (Next.js, React, TypeScript)
- **MonPetitBiz API**: Backend API (NestJS, PostgreSQL)
- **Communication**: REST API with JWT authentication

## Prerequisites

1. **Backend API**: The MonPetitBiz API must be deployed and accessible
2. **Repository**: Clone the admin portal repository
3. **Node.js**: Version 18 or higher
4. **Deployment Platform**: Vercel, Netlify, or similar (optional)

## Backend Configuration

### 1. Configure CORS

The backend must be configured to accept requests from the admin portal URL.

#### Environment Variable

Set the `FRONTEND_URL` environment variable in your backend deployment:

```bash
FRONTEND_URL=https://admin.monpetitbiz.com
```

For development, you can use:
```bash
FRONTEND_URL=http://localhost:3001
```

#### CORS Configuration

The backend CORS is already configured in `src/bootstrap.ts` and `src/main.ts` to:
- Allow requests from `FRONTEND_URL` in production
- Allow all origins in development (for easier testing)
- Support credentials (cookies, authorization headers)

No code changes are needed - just set the `FRONTEND_URL` environment variable.

### 2. Verify API Endpoints

Ensure the following API endpoints are available and working:

- `POST /auth/send-otp` - Send OTP to phone number
- `POST /auth/verify-otp` - Verify OTP and get JWT token
- `POST /auth/complete-registration` - Complete user registration
- `GET /dashboard/:businessId` - Get dashboard data (requires JWT)
- `GET /dashboard/:businessId/summary` - Get summary statistics (requires JWT)
- `GET /dashboard/:businessId/metrics` - Get metrics (requires JWT)

Test these endpoints using the Swagger documentation at `/api` on your backend.

## Admin Portal Setup

### 1. Clone and Install

```bash
git clone <admin-portal-repository-url>
cd monpetitbiz-admin-portal
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file:

```bash
# Development
NEXT_PUBLIC_API_URL=http://localhost:3000

# Production
NEXT_PUBLIC_API_URL=https://api.monpetitbiz.com
```

### 3. Development

Run the development server:

```bash
npm run dev
```

The admin portal will be available at `http://localhost:3000` (or the port specified by Next.js).

### 4. Build for Production

```bash
npm run build
npm start
```

## Deployment

### Option 1: Vercel (Recommended)

1. **Connect Repository**
   - Go to [Vercel Dashboard](https://vercel.com)
   - Import your admin portal repository

2. **Configure Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add `NEXT_PUBLIC_API_URL` with your API backend URL
   - Set for Production, Preview, and Development environments

3. **Deploy**
   - Vercel will automatically deploy on every push to main branch
   - You'll get a URL like `https://monpetitbiz-admin-portal.vercel.app`

4. **Update Backend CORS**
   - Set `FRONTEND_URL` in your backend to the Vercel URL
   - Redeploy the backend if needed

### Option 2: Netlify

1. **Connect Repository**
   - Go to [Netlify Dashboard](https://app.netlify.com)
   - Add new site from Git

2. **Build Settings**
   - Build command: `npm run build`
   - Publish directory: `.next`

3. **Environment Variables**
   - Add `NEXT_PUBLIC_API_URL` in Site settings → Environment variables

4. **Deploy**
   - Netlify will deploy automatically

### Option 3: Self-Hosted

1. **Build the Application**
   ```bash
   npm run build
   ```

2. **Start the Server**
   ```bash
   npm start
   ```

3. **Use a Reverse Proxy** (Nginx example):
   ```nginx
   server {
       listen 80;
       server_name admin.monpetitbiz.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## Testing the Integration

### 1. Test Authentication Flow

1. Open the admin portal in your browser
2. Enter a phone number that has an account
3. Check WhatsApp for OTP code
4. Enter the OTP code
5. Verify you're redirected to the dashboard

### 2. Test Dashboard

1. After authentication, verify the dashboard loads
2. Check that summary cards show correct data
3. Verify recent transactions are displayed
4. Check stock warnings if applicable

### 3. Test CORS

If you see CORS errors in the browser console:

1. Verify `FRONTEND_URL` is set correctly in backend
2. Check that the admin portal URL matches `FRONTEND_URL` exactly
3. In development, CORS should allow all origins

## Troubleshooting

### CORS Errors

**Error**: `Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**Solutions**:
1. Verify `FRONTEND_URL` environment variable in backend matches admin portal URL
2. Check backend logs for CORS configuration
3. In development, ensure backend allows all origins (default behavior)
4. Verify credentials are enabled in CORS config

### Authentication Issues

**Error**: `401 Unauthorized` or `Invalid token`

**Solutions**:
1. Verify JWT token is being stored in cookies
2. Check that token is included in Authorization header
3. Verify token hasn't expired (default: 7 days)
4. Check backend JWT_SECRET is configured correctly

### API Connection Errors

**Error**: `Network error` or `Failed to fetch`

**Solutions**:
1. Verify `NEXT_PUBLIC_API_URL` is correct
2. Check backend is running and accessible
3. Verify network connectivity
4. Check browser console for detailed errors

### OTP Not Received

**Solutions**:
1. Verify phone number format (include country code, e.g., +226701234567)
2. Check Twilio configuration in backend
3. Verify WhatsApp number is registered in Twilio
4. Check backend logs for OTP sending errors

## Security Considerations

1. **HTTPS**: Always use HTTPS in production for both frontend and backend
2. **JWT Tokens**: Tokens are stored in secure, httpOnly cookies (recommended) or localStorage
3. **CORS**: Only allow specific origins in production
4. **Environment Variables**: Never commit `.env` files to version control
5. **API Keys**: Keep API URLs and secrets secure

## Monitoring

### Frontend Monitoring

- Monitor page load times
- Track JavaScript errors (e.g., Sentry)
- Monitor API response times
- Track user authentication success/failure rates

### Backend Monitoring

- Monitor API endpoint response times
- Track authentication attempts
- Monitor CORS errors in logs
- Track dashboard data query performance

## Maintenance

### Updating the Admin Portal

1. Pull latest changes from repository
2. Update dependencies: `npm install`
3. Test locally: `npm run dev`
4. Build: `npm run build`
5. Deploy to production

### Updating Backend API

When backend API changes:
1. Update API client in `src/lib/api.ts` if endpoints change
2. Update TypeScript types if response formats change
3. Test integration thoroughly
4. Deploy both frontend and backend

## Support

For issues:
1. Check this guide first
2. Review backend API documentation
3. Check browser console for errors
4. Review backend logs
5. Contact support: support@monpetitbiz.com

## Related Documentation

- [Environment Variables Guide](./environment-variables.md)
- [MonPetitBiz API README](../README.md)
- [Dashboard API Documentation](../openapi.yaml)

