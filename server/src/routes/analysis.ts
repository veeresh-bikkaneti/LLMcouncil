import { Router, Request, Response } from 'express';
import multer from 'multer';
import { conductCouncil } from '../services/orchestration';
import { query as dbQuery } from '../config/database';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// ============= POST /api/analyze =============
router.post(
    '/analyze',
    upload.single('image'),
    async (req: Request, res: Response) => {
        try {
            const { query } = req.body;
            const image = req.file?.buffer;
            // Mock User ID for now since Auth middleware not fully wired in request yet context
            // In production, use req.user.userId from auth middleware
            const userId = (req as any).user?.userId || '00000000-0000-0000-0000-000000000000';

            // Create report record (status = pending)
            const reportResult = await dbQuery(
                `INSERT INTO consensus_reports (user_id, original_query, status)
         VALUES ($1, $2, 'pending')
         RETURNING id`,
                [userId, query]
            );
            const reportId = reportResult.rows[0].id;

            // Start analysis in background (don't wait)
            conductCouncil(reportId, userId, query, image).catch(err => {
                console.error(`Analysis failed for report ${reportId}:`, err);
                dbQuery(
                    'UPDATE consensus_reports SET status = $1, error_message = $2 WHERE id = $3',
                    ['error', err.message, reportId]
                );
            });

            // Return immediately with reportId for polling
            res.json({
                status: 'processing',
                reportId,
                message: 'Analysis started. Poll /api/results/{reportId} for updates.',
            });
        } catch (error: any) {
            res.status(400).json({
                status: 'error',
                message: error.message,
            });
        }
    }
);

// ============= GET /api/results/:reportId =============
router.get(
    '/results/:reportId',
    async (req: Request, res: Response) => {
        try {
            const { reportId } = req.params;

            const result = await dbQuery(
                `SELECT * FROM consensus_reports
         WHERE id = $1`,
                [reportId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Report not found' });
            }

            const report = result.rows[0];

            // If complete, also fetch agent responses
            if (report.status === 'complete') {
                const agentResults = await dbQuery(
                    `SELECT * FROM agent_responses WHERE report_id = $1`,
                    [reportId]
                );
                report.agentOutputs = agentResults.rows;
            }

            res.json({
                status: report.status,
                report,
            });
        } catch (error: any) {
            res.status(500).json({
                status: 'error',
                message: error.message,
            });
        }
    }
);

export default router;
