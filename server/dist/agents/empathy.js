"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeSentiment = analyzeSentiment;
const generative_ai_1 = require("@google/generative-ai");
const database_1 = require("../config/database");
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
async function analyzeSentiment(reportId, userQuery, metadata) {
    const startTime = Date.now();
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
        const prompt = `You are the Empathy Analyst Agent in a support triage council.
Your job: Analyze user sentiment, tone, frustration level, and urgency.

STRICT REQUIREMENTS:
1. Return ONLY valid JSON
2. Analyze ONLY the text provided
3. Assess urgency level (1-10)
4. Identify emotional keywords
5. Format output as:
{
  "sentiment": "positive|neutral|negative|frustrated",
  "urgency_level": 7,
  "frustration_level": 1-10,
  "emotional_keywords": ["keyword1", "keyword2"],
  "suggested_response_tone": "empathetic|technical|urgent|reassuring",
  "user_needs": ["need1", "need2"],
  "confidence": 0.88
}

Query: ${userQuery}
${metadata ? `User: ${metadata.userName}, Ticket age: ${metadata.ticketAge}h` : ''}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        // Strip markdown
        const cleanJson = text.replace(/```json\n?|```/g, '');
        const analysis = JSON.parse(cleanJson);
        // Save to database
        await (0, database_1.query)(`INSERT INTO agent_responses 
       (report_id, agent_name, response_json, processing_time_ms, confidence_score, token_usage)
       VALUES ($1, $2, $3, $4, $5, $6)`, [
            reportId,
            'empathy',
            JSON.stringify(analysis),
            Date.now() - startTime,
            analysis.confidence, // Gemini doesn't always return token usage easily in all SDRs, falling back or using dummy
            0
        ]);
        return analysis;
    }
    catch (error) {
        console.error('Empathy agent error:', error);
        await (0, database_1.query)(`INSERT INTO agent_responses 
       (report_id, agent_name, error_occurred, error_message, processing_time_ms, response_json)
       VALUES ($1, $2, $3, $4, $5, $6)`, [reportId, 'empathy', true, error.message, Date.now() - startTime, '{}']);
        throw error;
    }
}
