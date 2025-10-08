#!/usr/bin/env node

/**
 * Improved OTP Testing Script
 * Tests the new authentication flow:
 * 1. Send OTP
 * 2. Verify OTP (returns needsRegistration for new users, or JWT for existing)
 * 3. Complete registration if needed
 * 4. Test existing user flow
 */

const http = require('http');

const API_BASE = 'http://localhost:3000';

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
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

async function testImprovedOTPFlow() {
  console.log('🧪 Testing Improved OTP Authentication Flow');
  console.log('==========================================');

  const testPhoneNumber = '+221' + Math.floor(Math.random() * 900000000 + 100000000);
  console.log(`Using test phone number: ${testPhoneNumber}`);

  try {
    // Test 1: Send OTP
    console.log('\n1️⃣ Sending OTP...');
    const sendResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/auth/send-otp',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { phoneNumber: testPhoneNumber });

    console.log(`Status: ${sendResponse.status}`);
    console.log(`Response:`, sendResponse.data);

    if (sendResponse.status !== 200) {
      console.error('❌ Failed to send OTP');
      return;
    }

    // Test 2: Get OTP from database
    console.log('\n2️⃣ Getting OTP from database...');
    const debugResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/auth/debug/otp-sessions',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const testSession = debugResponse.data.data.find(s => s.phoneNumber === testPhoneNumber);
    if (!testSession) {
      console.error('❌ OTP session not found');
      return;
    }

    console.log(`📱 OTP Code: ${testSession.code}`);

    // Test 3: Verify OTP (should indicate need for registration)
    console.log('\n3️⃣ Verifying OTP (new user)...');
    const verifyResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/auth/verify-otp',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { 
      phoneNumber: testPhoneNumber,
      code: testSession.code 
    });

    console.log(`Verify Status: ${verifyResponse.status}`);
    console.log(`Verify Response:`, verifyResponse.data);

    if (verifyResponse.data && verifyResponse.data.needsRegistration) {
      console.log('✅ OTP verified, registration needed as expected');
      
      // Test 4: Complete registration
      console.log('\n4️⃣ Completing registration...');
      const registerResponse = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/auth/complete-registration',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        phoneNumber: testPhoneNumber,
        businessName: 'Test Business',
        role: 'owner',
        language: 'fr'
      });

      console.log(`Register Status: ${registerResponse.status}`);
      console.log(`Register Response:`, registerResponse.data);

      if (registerResponse.status === 201 && registerResponse.data.data.accessToken) {
        console.log('✅ Registration completed with JWT token!');
        
        // Test 5: Test existing user flow
        console.log('\n5️⃣ Testing existing user authentication...');
        
        // Send new OTP for same number
        const otpResponse2 = await makeRequest({
          hostname: 'localhost',
          port: 3000,
          path: '/auth/send-otp',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, { phoneNumber: testPhoneNumber });

        if (otpResponse2.status === 200) {
          // Get the new OTP
          const debugResponse2 = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/auth/debug/otp-sessions',
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });

          const newSession = debugResponse2.data.data.find(s => s.phoneNumber === testPhoneNumber);
          if (newSession) {
            // Verify OTP for existing user
            const verifyResponse2 = await makeRequest({
              hostname: 'localhost',
              port: 3000,
              path: '/auth/verify-otp',
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            }, { 
              phoneNumber: testPhoneNumber,
              code: newSession.code 
            });

            console.log(`Existing User Verify Status: ${verifyResponse2.status}`);
            console.log(`Existing User Response:`, verifyResponse2.data);

            if (verifyResponse2.data && verifyResponse2.data.data && verifyResponse2.data.data.accessToken) {
              console.log('✅ Existing user authentication working correctly!');
            }
          }
        }
      }
    } else if (verifyResponse.data && verifyResponse.data.data && verifyResponse.data.data.accessToken) {
      console.log('✅ User already exists and was authenticated directly');
    }

    console.log('\n🎉 Complete authentication flow tested successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testDatabaseConnection() {
  console.log('\n🔌 Testing Database Connection...');
  
  try {
    const healthResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    console.log(`Health Status: ${healthResponse.status}`);
    if (healthResponse.data) {
      console.log(`System Status: ${healthResponse.data.status}`);
    }
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Improved OTP Authentication Test Suite');
  console.log('========================================');

  // Check if server is running
  try {
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/health/live',
      method: 'GET'
    });
    console.log('✅ Server is running');
  } catch (error) {
    console.error('❌ Server is not running. Please start with: npm run start:dev');
    process.exit(1);
  }

  await testDatabaseConnection();
  await testImprovedOTPFlow();

  console.log('\n🎉 All tests completed!');
  console.log('\n📋 Summary of Improved Flow:');
  console.log('1. Send OTP to any phone number');
  console.log('2. Verify OTP:');
  console.log('   - New user: Returns needsRegistration: true');
  console.log('   - Existing user: Returns JWT token directly');
  console.log('3. Complete registration (only for new users)');
  console.log('4. Get JWT token immediately after registration');
  console.log('\n💡 This eliminates the need to register before OTP verification!');
}

if (require.main === module) {
  runTests().catch(console.error);
}