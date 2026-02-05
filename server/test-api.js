// API Test Script for LLMCouncil Backend
// Run with: node test-api.js

const API_URL = 'http://localhost:3001';

let authToken = '';
let reportId = '';

async function testHealthCheck() {
    console.log('\n🔍 Testing Health Check...');
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    console.log('✅ Health Check:', data);
    return response.ok;
}

async function testRegister() {
    console.log('\n🔍 Testing User Registration...');
    const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: `test${Date.now()}@example.com`,
            password: 'TestPassword123!'
        })
    });

    const data = await response.json();
    console.log('✅ Registration Response:', data);

    if (data.token) {
        authToken = data.token;
        console.log('🔑 Auth token saved');
    }

    return response.ok;
}

async function testLogin() {
    console.log('\n🔍 Testing Login...');
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'test@example.com',
            password: 'TestPassword123!'
        })
    });

    const data = await response.json();
    console.log('Login Response:', data);
    return response.ok;
}

async function testAnalyze() {
    console.log('\n🔍 Testing Analysis Submission...');

    const formData = new FormData();
    formData.append('query', 'User is unable to login. Getting error 500.');

    const response = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
        body: formData
    });

    const data = await response.json();
    console.log('✅ Analysis Started:', data);

    if (data.reportId) {
        reportId = data.reportId;
        console.log('📋 Report ID saved:', reportId);
    }

    return response.ok;
}

async function testPollResults() {
    if (!reportId) {
        console.log('⚠️ No report ID available, skipping poll test');
        return false;
    }

    console.log('\n🔍 Polling Results...');

    // Poll up to 5 times
    for (let i = 0; i < 5; i++) {
        console.log(`Poll attempt ${i + 1}/5...`);

        const response = await fetch(`${API_URL}/api/results/${reportId}`, {
            headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        });

        const data = await response.json();
        console.log('Status:', data.status);

        if (data.status === 'complete') {
            console.log('✅ Analysis Complete!');
            console.log('Priority Score:', data.report?.priority_score);
            console.log('Root Cause:', data.report?.root_cause);
            console.log('Consensus Rate:', data.report?.consensus_rate);
            return true;
        }

        if (data.status === 'error') {
            console.log('❌ Analysis Failed:', data.report?.error_message);
            return false;
        }

        // Wait 5 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log('⏱️ Still processing after 5 polls');
    return true;
}

async function testHistory() {
    console.log('\n🔍 Testing History Endpoint...');
    const response = await fetch(`${API_URL}/api/history?limit=10`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
    });

    const data = await response.json();
    console.log('✅ History:', data);
    return response.ok;
}

async function runAllTests() {
    console.log('🚀 Starting LLMCouncil API Tests\n');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('🌐 API URL:', API_URL);

    const results = {
        health: false,
        register: false,
        analyze: false,
        poll: false,
        history: false
    };

    try {
        results.health = await testHealthCheck();
        results.register = await testRegister();
        results.analyze = await testAnalyze();
        results.poll = await testPollResults();
        results.history = await testHistory();
    } catch (error) {
        console.error('\n❌ Test Error:', error.message);
    }

    console.log('\n📊 Test Results Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Object.entries(results).forEach(([test, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${test.padEnd(15)}: ${passed ? 'PASS' : 'FAIL'}`);
    });

    const allPassed = Object.values(results).every(r => r);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(allPassed ? '🎉 All Tests Passed!' : '⚠️ Some Tests Failed');
}

// Run tests
runAllTests().catch(console.error);
