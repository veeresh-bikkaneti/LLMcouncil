"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOCK_CONSENSUS_REPORT = exports.MOCK_QUERY = exports.MOCK_CHAIRPERSON_RESPONSE = exports.MOCK_EMPATHY_RESPONSE = exports.MOCK_TECHNICAL_RESPONSE = exports.MOCK_VISION_RESPONSE = void 0;
exports.MOCK_VISION_RESPONSE = `Vision Agent Analysis:
- UI element appears to be a button with inconsistent styling
- Error code suggests authentication failure
- Visual inspection shows missing icon in top-right corner`;
exports.MOCK_TECHNICAL_RESPONSE = `Technical Librarian Analysis:
- Error code AUTH_001 indicates expired session token
- Solution: Clear browser cache and re-authenticate
- Documentation: https://docs.example.com/auth-troubleshooting`;
exports.MOCK_EMPATHY_RESPONSE = `Empathy Analyst Analysis:
- User frustration level: HIGH (repeated attempts visible)
- Urgency: MEDIUM (blocking workflow but not critical)
- Sentiment: Frustrated but professional in communication`;
exports.MOCK_CHAIRPERSON_RESPONSE = `Chairperson Synthesis:
Priority Level: 7/10

Root Cause: Expired authentication session (AUTH_001)

Recommended Actions:
1. Clear browser cache and cookies
2. Re-authenticate with fresh credentials
3. If issue persists, check system time synchronization

Consensus Rate: 92% - All agents agree on authentication root cause`;
exports.MOCK_QUERY = "I'm getting an AUTH_001 error when trying to access the dashboard. The login button appears grayed out.";
exports.MOCK_CONSENSUS_REPORT = {
    comprehensiveAnswer: exports.MOCK_CHAIRPERSON_RESPONSE,
    agentOutputs: [
        {
            role: 'Vision',
            prompt: exports.MOCK_QUERY,
            analysis: exports.MOCK_VISION_RESPONSE,
            status: 'done',
            modelName: 'copilot-gpt-4'
        },
        {
            role: 'Technical',
            prompt: exports.MOCK_QUERY,
            analysis: exports.MOCK_TECHNICAL_RESPONSE,
            status: 'done',
            modelName: 'copilot-gpt-4'
        },
        {
            role: 'Empathy',
            prompt: exports.MOCK_QUERY,
            analysis: exports.MOCK_EMPATHY_RESPONSE,
            status: 'done',
            modelName: 'copilot-gpt-4'
        }
    ],
    consensusRate: 0.92,
    processingTime: 2500
};
//# sourceMappingURL=mockResponses.js.map