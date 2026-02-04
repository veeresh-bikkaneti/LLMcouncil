export const MOCK_VISION_RESPONSE = `Vision Agent Analysis:
- UI element appears to be a button with inconsistent styling
- Error code suggests authentication failure
- Visual inspection shows missing icon in top-right corner`;

export const MOCK_TECHNICAL_RESPONSE = `Technical Librarian Analysis:
- Error code AUTH_001 indicates expired session token
- Solution: Clear browser cache and re-authenticate
- Documentation: https://docs.example.com/auth-troubleshooting`;

export const MOCK_EMPATHY_RESPONSE = `Empathy Analyst Analysis:
- User frustration level: HIGH (repeated attempts visible)
- Urgency: MEDIUM (blocking workflow but not critical)
- Sentiment: Frustrated but professional in communication`;

export const MOCK_CHAIRPERSON_RESPONSE = `Chairperson Synthesis:
Priority Level: 7/10

Root Cause: Expired authentication session (AUTH_001)

Recommended Actions:
1. Clear browser cache and cookies
2. Re-authenticate with fresh credentials
3. If issue persists, check system time synchronization

Consensus Rate: 92% - All agents agree on authentication root cause`;

export const MOCK_QUERY = "I'm getting an AUTH_001 error when trying to access the dashboard. The login button appears grayed out.";

export const MOCK_CONSENSUS_REPORT = {
    comprehensiveAnswer: MOCK_CHAIRPERSON_RESPONSE,
    agentOutputs: [
        {
            role: 'Vision',
            prompt: MOCK_QUERY,
            analysis: MOCK_VISION_RESPONSE,
            status: 'done' as const,
            modelName: 'copilot-gpt-4'
        },
        {
            role: 'Technical',
            prompt: MOCK_QUERY,
            analysis: MOCK_TECHNICAL_RESPONSE,
            status: 'done' as const,
            modelName: 'copilot-gpt-4'
        },
        {
            role: 'Empathy',
            prompt: MOCK_QUERY,
            analysis: MOCK_EMPATHY_RESPONSE,
            status: 'done' as const,
            modelName: 'copilot-gpt-4'
        }
    ],
    consensusRate: 0.92,
    processingTime: 2500
};
