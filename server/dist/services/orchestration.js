"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conductCouncil = conductCouncil;
const vision_1 = require("../agents/vision");
const technical_1 = require("../agents/technical");
const empathy_1 = require("../agents/empathy");
const chairperson_1 = require("../agents/chairperson");
const database_1 = require("../config/database");
const ANALYSIS_TIMEOUT = parseInt(process.env.ANALYSIS_TIMEOUT_MS || '20000');
async function conductCouncil(reportId, userId, query, imageBuffer) {
    const councilStartTime = Date.now();
    try {
        // Load documentation (pre-fetch or lazy-load as needed)
        const docs = await loadDocumentation();
        // Set timeout for entire analysis
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Analysis timeout (>20s)')), ANALYSIS_TIMEOUT));
        // Run all 3 agents in parallel
        const analysesPromise = Promise.all([
            (0, vision_1.analyzeVisual)(reportId, imageBuffer || Buffer.from(''), query).catch(err => ({
                error: err.message,
                visual_issues: [],
                confidence: 0,
                // Add other required fields with defaults to satisfy type if needed, 
                // or ensure Synthesizer handles partials.
                // For now, Synthesizer expects JSON, so we return valid error JSON
                agent_name: 'vision',
                status: 'failed'
            })),
            (0, technical_1.analyzeDocumentation)(reportId, query, docs).catch(err => ({
                error: err.message,
                solution_found: false,
                confidence: 0,
                agent_name: 'technical',
                status: 'failed'
            })),
            (0, empathy_1.analyzeSentiment)(reportId, query, { userName: 'user', ticketAge: 0 }).catch(err => ({
                error: err.message,
                sentiment: 'neutral',
                confidence: 0,
                agent_name: 'empathy',
                status: 'failed'
            })),
        ]);
        const [visionResult, technicalResult, empathyResult] = await Promise.race([
            analysesPromise,
            timeoutPromise,
        ]);
        // Chairperson synthesizes (even if some agents failed)
        await (0, chairperson_1.synthesizeConsensus)(reportId, visionResult, technicalResult, empathyResult, query);
        // Track usage
        await trackUsage(userId);
    }
    catch (error) {
        console.error('Council orchestration failed:', error);
        await (0, database_1.query)(`UPDATE consensus_reports SET status = 'error', error_message = $1 WHERE id = $2`, [error.message, reportId]);
    }
}
async function loadDocumentation() {
    // TODO: Load from vector DB or file system
    return [
        'System Documentation: Error 500 usually means backend timeout.',
        'Knowledge Base: Check valid API keys in headers.',
        'User Guide: Reset password via /forgot-password endpoint.',
    ];
}
async function trackUsage(userId) {
    // Insert into usage_metrics
    const now = new Date();
    // Round to hour
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);
    await (0, database_1.query)(`INSERT INTO usage_metrics (user_id, date_hour, request_count, token_count, estimated_cost)
     VALUES ($1, $2, 1, 0, 0)
     ON CONFLICT (user_id, date_hour) 
     DO UPDATE SET request_count = usage_metrics.request_count + 1`, [userId, hourStart]);
}
