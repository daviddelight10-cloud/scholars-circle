// Security Test Script for Local Development
// Run this while your server is running: node test-security.js

const API_URL = 'http://localhost:4000';
const FRONTEND_URL = 'http://localhost:5173';

console.log('🔒 Testing Security Configuration...\n');

async function testSecurityHeaders() {
  console.log('1️⃣ Testing Security Headers...');
  try {
    const response = await fetch(`${API_URL}/health`);
    const headers = response.headers;
    
    const checks = {
      'X-Frame-Options': headers.get('x-frame-options'),
      'X-Content-Type-Options': headers.get('x-content-type-options'),
      'X-XSS-Protection': headers.get('x-xss-protection'),
      'Content-Security-Policy': headers.get('content-security-policy'),
      'Strict-Transport-Security': headers.get('strict-transport-security'),
    };
    
    console.log('   Security Headers:');
    for (const [header, value] of Object.entries(checks)) {
      if (value) {
        console.log(`   ✅ ${header}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
      } else {
        console.log(`   ❌ ${header}: Missing`);
      }
    }
    console.log('');
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }
}

async function testCORS() {
  console.log('2️⃣ Testing CORS Configuration...');
  try {
    // Test allowed origin
    const allowedResponse = await fetch(`${API_URL}/health`, {
      headers: {
        'Origin': FRONTEND_URL
      }
    });
    const allowedCORS = allowedResponse.headers.get('access-control-allow-origin');
    
    if (allowedCORS === FRONTEND_URL || allowedCORS === '*') {
      console.log(`   ✅ Allowed origin (${FRONTEND_URL}): ${allowedCORS}`);
    } else {
      console.log(`   ❌ Allowed origin blocked: ${allowedCORS}`);
    }
    
    // Test blocked origin
    const blockedResponse = await fetch(`${API_URL}/health`, {
      headers: {
        'Origin': 'https://malicious-site.com'
      }
    });
    const blockedCORS = blockedResponse.headers.get('access-control-allow-origin');
    
    if (!blockedCORS || blockedCORS === 'null') {
      console.log(`   ✅ Blocked origin (malicious-site.com): Correctly blocked`);
    } else {
      console.log(`   ⚠️  Blocked origin allowed: ${blockedCORS} (should be blocked)`);
    }
    console.log('');
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }
}

async function testBodySizeLimit() {
  console.log('3️⃣ Testing Request Body Size Limit...');
  try {
    // Create a large payload (11MB - should be rejected)
    const largePayload = 'x'.repeat(11 * 1024 * 1024);
    
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: largePayload })
    });
    
    if (response.status === 413 || response.status === 400) {
      console.log(`   ✅ Large payload (11MB) rejected: ${response.status}`);
    } else {
      console.log(`   ⚠️  Large payload accepted: ${response.status} (should reject >10MB)`);
    }
    console.log('');
  } catch (error) {
    if (error.message.includes('body')) {
      console.log(`   ✅ Large payload rejected: ${error.message}`);
    } else {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log('');
  }
}

async function testErrorHandling() {
  console.log('4️⃣ Testing Error Handling...');
  try {
    const response = await fetch(`${API_URL}/nonexistent-endpoint`);
    const data = await response.json();
    
    // Check if error message leaks details
    if (data.stack || data.details) {
      console.log(`   ⚠️  Error leaks details (OK in development):`);
      console.log(`      Stack trace: ${data.stack ? 'Present' : 'Hidden'}`);
    } else {
      console.log(`   ✅ Error handling secure (no stack traces leaked)`);
    }
    console.log('');
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }
}

async function testNoSQLInjection() {
  console.log('5️⃣ Testing NoSQL Injection Protection...');
  try {
    // Attempt NoSQL injection
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        login: { $ne: null },
        password: { $ne: null }
      })
    });
    
    const data = await response.json();
    
    if (response.status === 401 || response.status === 400) {
      console.log(`   ✅ NoSQL injection attempt blocked: ${response.status}`);
    } else if (data.token) {
      console.log(`   ❌ NoSQL injection successful (CRITICAL VULNERABILITY)`);
    } else {
      console.log(`   ✅ NoSQL injection prevented`);
    }
    console.log('');
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   SCHOLAR\'S CIRCLE - SECURITY TEST SUITE');
  console.log('═══════════════════════════════════════════════════════\n');
  
  await testSecurityHeaders();
  await testCORS();
  await testBodySizeLimit();
  await testErrorHandling();
  await testNoSQLInjection();
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('   TEST COMPLETE');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('✅ = Pass | ❌ = Fail | ⚠️  = Warning\n');
}

runAllTests().catch(console.error);
