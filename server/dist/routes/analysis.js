"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const orchestration_1 = require("../services/orchestration");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});
// ============= POST /api/analyze =============
router.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        const { query } = req.body;
        const image = req.file?.buffer;
        // Mock User ID for now since Auth middleware not fully wired in request yet context
        // In production, use req.user.userId from auth middleware
        const userId = req.user?.userId || '00000000-0000-0000-0000-000000000000';
        // Create report record (status = pending)
        const reportResult = await (0, database_1.query)(`INSERT INTO consensus_reports (user_id, original_query, status)
         VALUES ($1, $2, 'pending')
         RETURNING id`, [userId, query]);
        const reportId = reportResult.rows[0].id;
        // Start analysis in background (don't wait)
        (0, orchestration_1.conductCouncil)(reportId, userId, query, image).catch(err => {
            console.error(`Analysis failed for report ${reportId}:`, err);
            (0, database_1.query)('UPDATE consensus_reports SET status = $1, error_message = $2 WHERE id = $3', ['error', err.message, reportId]);
        });
        // Return immediately with reportId for polling
        res.json({
            status: 'processing',
            reportId,
            message: 'Analysis started. Poll /api/results/{reportId} for updates.',
        });
    }
    catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message,
        });
    }
});
// ============= GET /api/results/:reportId =============
router.get('/results/:reportId', async (req, res) => {
    try {
        const { reportId } = req.params;
        const result = await (0, database_1.query)(`SELECT * FROM consensus_reports
         WHERE id = $1`, [reportId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Report not found' });
        }
        const report = result.rows[0];
        // If complete, also fetch agent responses
        if (report.status === 'complete') {
            const agentResults = await (0, database_1.query)(`SELECT * FROM agent_responses WHERE report_id = $1`, [reportId]);
            report.agentOutputs = agentResults.rows;
        }
        res.json({
            status: report.status,
            report,
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
        });
    }
});
exports.default = router;
