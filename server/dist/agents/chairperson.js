"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.synthesizeConsensus = synthesizeConsensus;
const openai_1 = __importDefault(require("openai"));
const database_1 = require("../config/database");
const client = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
async function synthesizeConsensus(reportId, visionAnalysis, technicalAnalysis, empathyAnalysis, originalQuery) {
    const startTime = Date.now();
    try {
        const response = await client.chat.completions.create({
            model: 'gpt-4-turbo',
            messages: [
                {
                    role: 'system',
                    content: `You are the Chairperson of a support triage council.
You have reviewed 3 specialist agents' analyses.
Your job: Synthesize their findings into a single verdict.

REQUIREMENTS:
1. Review all 3 analyses
2. Resolve conflicts using confidence scores
3. Assign priority score (1-10)
4. Identify root cause
5. Recommend action
6. Calculate consensus rate (how much agents agreed)

Output Format:
{
  "priority_score": 7,
  "root_cause": "User cannot upload files due to [specific reason]",
  "recommended_action": "Step 1... Step 2... Step 3...",
  "internal_note": "For support team: [details]",
  "consensus_rate": 0.85,
  "agent_agreement": {
    "vision_vs_technical": 0.8,
    "technical_vs_empathy": 0.9,
    "empathy_vs_vision": 0.75
  }
}

CONFLICT RESOLUTION:
- If 2+ agents agree on severity: use that level
- If agents disagree: weight by confidence score
- If split: escalate priority (favor caution)`
                },
                {
                    role: 'user',
                    content: `
Original Query: ${originalQuery}

Vision Agent Analysis:
${JSON.stringify(visionAnalysis, null, 2)}

Technical Agent Analysis:
${JSON.stringify(technicalAnalysis, null, 2)}

Empathy Agent Analysis:
${JSON.stringify(empathyAnalysis, null, 2)}

Now synthesize these into a consensus verdict.`,
                },
            ],
            response_format: { type: "json_object" }
        });
        const content = response.choices[0].message.content;
        if (!content)
            throw new Error('No content in response');
        const result = JSON.parse(content);
        // Update consensus report with final results
        await (0, database_1.query)(`UPDATE consensus_reports 
       SET status = 'complete',
           priority_score = $1,
           root_cause = $2,
           recommended_action = $3,
           internal_note = $4,
           consensus_rate = $5,
           processing_time_ms = $6,
           total_tokens_used = COALESCE(total_tokens_used, 0) + $7
       WHERE id = $8`, [
            result.priority_score,
            result.root_cause,
            result.recommended_action,
            result.internal_note,
            result.consensus_rate,
            Date.now() - startTime, // Note: this is just synthesis time, total time needs accumulation
            response.usage?.total_tokens || 0,
            reportId,
        ]);
        // Save chairperson response
        await (0, database_1.query)(`INSERT INTO agent_responses 
       (report_id, agent_name, response_json, processing_time_ms, token_usage, confidence_score)
       VALUES ($1, $2, $3, $4, $5, $6)`, [
            reportId,
            'chairperson',
            JSON.stringify(result),
            Date.now() - startTime,
            response.usage?.total_tokens || 0,
            result.consensus_rate,
        ]);
        return result;
    }
    catch (error) {
        console.error('Chairperson error:', error);
        await (0, database_1.query)(`UPDATE consensus_reports SET status = 'error', error_message = $1 WHERE id = $2`, [error.message, reportId]);
        await (0, database_1.query)(`INSERT INTO agent_responses 
       (report_id, agent_name, error_occurred, error_message, processing_time_ms, response_json)
       VALUES ($1, $2, $3, $4, $5, $6)`, [reportId, 'chairperson', true, error.message, Date.now() - startTime, '{}']);
        throw error;
    }
}
