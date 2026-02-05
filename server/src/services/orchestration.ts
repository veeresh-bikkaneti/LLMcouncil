import { analyzeVisual } from '../agents/vision';
import { analyzeDocumentation } from '../agents/technical';
import { analyzeSentiment } from '../agents/empathy';
import { synthesizeConsensus } from '../agents/chairperson';
import { query as dbQuery } from '../config/database';

const ANALYSIS_TIMEOUT = parseInt(process.env.ANALYSIS_TIMEOUT_MS || '20000');

export async function conductCouncil(
    reportId: string,
    userId: string,
    query: string,
    imageBuffer?: Buffer
): Promise<void> {
    const councilStartTime = Date.now();

    try {
        // Load documentation (pre-fetch or lazy-load as needed)
        const docs = await loadDocumentation();

        // Set timeout for entire analysis
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(
                () => reject(new Error('Analysis timeout (>20s)')),
                ANALYSIS_TIMEOUT
            )
        );

        // Run all 3 agents in parallel
        const analysesPromise = Promise.all([
            analyzeVisual(reportId, imageBuffer || Buffer.from(''), query).catch(err => ({
                error: err.message,
                visual_issues: [],
                confidence: 0,
                // Add other required fields with defaults to satisfy type if needed, 
                // or ensure Synthesizer handles partials.
                // For now, Synthesizer expects JSON, so we return valid error JSON
                agent_name: 'vision',
                status: 'failed'
            })),
            analyzeDocumentation(reportId, query, docs).catch(err => ({
                error: err.message,
                solution_found: false,
                confidence: 0,
                agent_name: 'technical',
                status: 'failed'
            })),
            analyzeSentiment(reportId, query, { userName: 'user', ticketAge: 0 }).catch(err => ({
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
        ]) as any[];

        // Chairperson synthesizes (even if some agents failed)
        await synthesizeConsensus(
            reportId,
            visionResult,
            technicalResult,
            empathyResult,
            query
        );

        // Track usage
        await trackUsage(userId);
    } catch (error: any) {
        console.error('Council orchestration failed:', error);
        await dbQuery(
            `UPDATE consensus_reports SET status = 'error', error_message = $1 WHERE id = $2`,
            [error.message, reportId]
        );
    }
}

async function loadDocumentation(): Promise<string[]> {
    // TODO: Load from vector DB or file system
    return [
        'System Documentation: Error 500 usually means backend timeout.',
        'Knowledge Base: Check valid API keys in headers.',
        'User Guide: Reset password via /forgot-password endpoint.',
    ];
}

async function trackUsage(userId: string): Promise<void> {
    // Insert into usage_metrics
    const now = new Date();
    // Round to hour
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);

    await dbQuery(
        `INSERT INTO usage_metrics (user_id, date_hour, request_count, token_count, estimated_cost)
     VALUES ($1, $2, 1, 0, 0)
     ON CONFLICT (user_id, date_hour) 
     DO UPDATE SET request_count = usage_metrics.request_count + 1`,
        [userId, hourStart]
    );
}
