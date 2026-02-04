"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeVisual = analyzeVisual;
const openai_1 = __importDefault(require("openai"));
const database_1 = require("../config/database");
const client = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
async function analyzeVisual(reportId, imageBuffer, context) {
    const startTime = Date.now();
    try {
        const base64Image = imageBuffer.toString('base64');
        const response = await client.chat.completions.create({
            model: 'gpt-4-vision-preview', // or gpt-4o depending on account access
            max_tokens: 300,
            messages: [
                {
                    role: 'system',
                    content: `You are the Visual Analyst Agent in a support triage council.
Your job: Analyze screenshots and images to identify visual issues, error codes, UI bugs, and visual anomalies.

STRICT REQUIREMENTS:
1. Return ONLY valid JSON (no markdown, no explanations)
2. Analyze ONLY the image provided - don't make assumptions
3. Keep response under 500 characters
4. Format output as:
{
  "visual_issues": ["issue1", "issue2"],
  "error_codes_found": ["ERR-123", "ERR-456"],
  "severity": "low|medium|high",
  "ui_elements_analyzed": 3,
  "confidence": 0.85
}`
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`,
                            },
                        },
                        {
                            type: 'text',
                            text: `Context: ${context}`,
                        },
                    ],
                },
            ],
        });
        const content = response.choices[0].message.content;
        if (!content) {
            throw new Error('No content in response');
        }
        // Strip markdown if present
        const cleanJson = content.replace(/```json\n?|```/g, '');
        const result = JSON.parse(cleanJson);
        // Save to database
        await (0, database_1.query)(`INSERT INTO agent_responses 
       (report_id, agent_name, response_json, processing_time_ms, token_usage, confidence_score)
       VALUES ($1, $2, $3, $4, $5, $6)`, [
            reportId,
            'vision',
            JSON.stringify(result),
            Date.now() - startTime,
            response.usage?.total_tokens || 0,
            result.confidence,
        ]);
        return result;
    }
    catch (error) {
        console.error('Vision agent error:', error);
        // Save error to database
        await (0, database_1.query)(`INSERT INTO agent_responses 
       (report_id, agent_name, response_json, processing_time_ms, error_occurred, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)`, [
            reportId,
            'vision',
            '{}',
            Date.now() - startTime,
            true,
            error.message,
        ]);
        throw error;
    }
}
