"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeDocumentation = analyzeDocumentation;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const database_1 = require("../config/database");
const client = new sdk_1.default({
    apiKey: process.env.ANTHROPIC_API_KEY,
});
async function analyzeDocumentation(reportId, query, docs // Pre-loaded documentation
) {
    const startTime = Date.now();
    try {
        const docContext = docs.join('\n---\n');
        const response = await client.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1000,
            messages: [{
                    role: 'user',
                    content: `You are the Technical Librarian Agent in a support triage council.
Your job: Search documentation for solutions to technical problems.

STRICT REQUIREMENTS:
1. Return ONLY valid JSON
2. Analyze the query for specific error codes, symptoms, or technical issues
3. Match against known documentation
4. Return step-by-step solution if found
5. Format output as:
{
  "solution_found": true|false,
  "step_by_step": ["Step 1: ...", "Step 2: ..."],
  "related_knowledge_bases": ["KB-123"],
  "related_issues": ["Similar issue X", "Similar issue Y"],
  "known_limitations": ["Limitation 1"],
  "confidence": 0.92
}

Documentation:
${docContext}

Query: ${query}`,
                }],
        });
        const content = response.content[0];
        if (content.type !== 'text') {
            throw new Error('Unexpected response type');
        }
        // Strip markdown
        const cleanJson = content.text.replace(/```json\n?|```/g, '');
        const result = JSON.parse(cleanJson);
        // Save to database
        await (0, database_1.query)(`INSERT INTO agent_responses 
       (report_id, agent_name, response_json, processing_time_ms, token_usage, confidence_score)
       VALUES ($1, $2, $3, $4, $5, $6)`, [
            reportId,
            'technical',
            JSON.stringify(result),
            Date.now() - startTime,
            (response.usage.input_tokens + response.usage.output_tokens),
            result.confidence,
        ]);
        return result;
    }
    catch (error) {
        console.error('Technical agent error:', error);
        await (0, database_1.query)(`INSERT INTO agent_responses 
       (report_id, agent_name, error_occurred, error_message, processing_time_ms, response_json)
       VALUES ($1, $2, $3, $4, $5, $6)`, [
            reportId,
            'technical',
            true,
            error.message,
            Date.now() - startTime,
            '{}'
        ]);
        throw error;
    }
}
