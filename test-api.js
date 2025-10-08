#!/usr/bin/env node

/**
 * MonPetitBiz API Test Script
 * 
 * This script demonstrates how to interact with the MonPetitBiz WhatsApp Bot API.
 * It shows examples of authentication, message testing, and health checks.
 * 
 * Usage:
 *   node test-api.js
 * 
 * Make sure the server is running on http://localhost:3000
 */

const https = require('http');

const API_BASE = 'http://localhost:3000';

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = {
            status: res.statusCode,
            headers: res.headers,
            data: body ? JSON.parse(body) : null
          };
          resolve(response);
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: body
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test functions
async function testHealthCheck() {
  console.log('\n🏥 Testing Health Check...');
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    console.log(`Status: ${response.status}`);
    if (response.data) {
      console.log(`System Status: ${response.data.status}`);
      console.log(`Uptime: ${response.data.uptime} seconds`);
      console.log(`Components: ${Object.keys(response.data.components || {}).join(', ')}`);
    }
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}

async function testWhatsAppHealth() {
  console.log('\n📱 Testing WhatsApp Health...');
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/whatsapp/health',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    console.log(`Status: ${response.status}`);
    if (response.data) {
      console.log(`WhatsApp Status: ${response.data.status}`);
      console.log(`Queue Size: ${response.data.queue?.queueSize || 0}`);
      console.log(`Bot Status: ${response.data.bot?.status || 'unknown'}`);
    }
  } catch (error) {
    console.error('WhatsApp health check failed:', error.message);
  }
}

async function testWebhookVerification() {
  console.log('\n🔗 Testing Webhook Verification...');
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/whatsapp/webhook?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=test_token',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    console.log(`Status: ${response.status}`);
    if (response.status === 200) {
      console.log('✅ Webhook verification endpoint is working');
      console.log(`Challenge response: ${response.data}`);
    } else {
      console.log('❌ Webhook verification failed (expected - need valid token)');
    }
  } catch (error) {
    console.error('Webhook verification test failed:', error.message);
  }
}

async function testMessageProcessing() {
  console.log('\n💬 Testing Message Processing (Development Mode)...');
  
  const testMessages = [
    { from: '221123456789', message: 'vente 1000' },
    { from: '221123456789', message: 'vente pain 1500' },
    { from: '221123456789', message: 'dépense 500 marchandise' },
    { from: '221123456789', message: 'stock pain 50' },
    { from: '221123456789', message: 'stock pain' },
    { from: '221123456789', message: 'bilan jour' },
    { from: '221123456789', message: 'rapport PDF' }
  ];

  for (const testMessage of testMessages) {
    try {
      console.log(`\nTesting: "${testMessage.message}"`);
      
      const response = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/whatsapp/test',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, testMessage);

      console.log(`Status: ${response.status}`);
      if (response.data) {
        console.log(`Success: ${response.data.success}`);
        console.log(`Message: ${response.data.message}`);
      }
    } catch (error) {
      console.error(`Test message failed: ${error.message}`);
    }
  }
}

async function testAuthFlow() {
  console.log('\n🔐 Testing Authentication Flow...');
  
  // Test OTP sending
  try {
    console.log('Sending OTP...');
    const otpResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/auth/send-otp',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { phoneNumber: '+221123456789' });

    console.log(`OTP Status: ${otpResponse.status}`);
    if (otpResponse.data) {
      console.log(`OTP Message: ${otpResponse.data.message || otpResponse.data}`);
    }
  } catch (error) {
    console.error('OTP test failed:', error.message);
  }

  // Test user registration
  try {
    console.log('\nTesting user registration...');
    const registerResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      phoneNumber: '+221987654321',
      businessName: 'Test Boutique',
      role: 'owner',
      language: 'fr'
    });

    console.log(`Registration Status: ${registerResponse.status}`);
    if (registerResponse.data) {
      if (registerResponse.status === 201) {
        console.log('✅ User registration successful');
        console.log(`User ID: ${registerResponse.data.id}`);
        console.log(`Business: ${registerResponse.data.business?.name}`);
      } else {
        console.log(`Registration response: ${JSON.stringify(registerResponse.data, null, 2)}`);
      }
    }
  } catch (error) {
    console.error('Registration test failed:', error.message);
  }
}

async function testMetrics() {
  console.log('\n📊 Testing Metrics Endpoint...');
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/health/metrics',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    console.log(`Status: ${response.status}`);
    if (response.data) {
      console.log(`Uptime: ${response.data.uptime} seconds`);
      console.log(`Memory Usage: ${Math.round(response.data.memory?.heapUsed / 1024 / 1024)}MB`);
      console.log(`Process PID: ${response.data.process?.pid}`);
      console.log(`Node Version: ${response.data.process?.version}`);
    }
  } catch (error) {
    console.error('Metrics test failed:', error.message);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 MonPetitBiz API Test Suite');
  console.log('================================');
  console.log('Testing API endpoints at:', API_BASE);
  
  // Check if server is running
  try {
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/health/live',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('✅ Server is running');
  } catch (error) {
    console.error('❌ Server is not running. Please start the server with: npm run start:dev');
    process.exit(1);
  }

  // Run all tests
  await testHealthCheck();
  await testWhatsAppHealth();
  await testWebhookVerification();
  await testAuthFlow();
  await testMessageProcessing();
  await testMetrics();

  console.log('\n🎉 Test suite completed!');
  console.log('\n📚 Additional Resources:');
  console.log('- API Documentation: http://localhost:3000/api');
  console.log('- Health Dashboard: http://localhost:3000/health');
  console.log('- OpenAPI Spec: ./openapi.yaml');
  console.log('\n💡 Tips:');
  console.log('- Use Postman or Insomnia to import the OpenAPI spec');
  console.log('- Check the Swagger UI for interactive API testing');
  console.log('- Monitor health endpoints for system status');
}

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testHealthCheck, testMessageProcessing };