"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("./config/database");
const requestLogger_1 = __importDefault(require("./middleware/requestLogger"));
const errorHandler_1 = __importDefault(require("./middleware/errorHandler"));
const rateLimit_1 = __importDefault(require("./middleware/rateLimit"));
const analysis_1 = __importDefault(require("./routes/analysis"));
const auth_1 = __importDefault(require("./routes/auth"));
const history_1 = __importDefault(require("./routes/history"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
// ============= DATABASE CONNECTION TEST =============
database_1.pool.query('SELECT 1')
    .then(() => console.log('✅ Database connected'))
    .catch(err => {
    console.error('❌ Database connection failed:', err);
    // process.exit(1); // Don't crash for now, just log
});
// ============= SECURITY MIDDLEWARE =============
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    optionsSuccessStatus: 200,
}));
// ============= BODY PARSING =============
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ limit: '10mb', extended: true }));
// ============= REQUEST LOGGING =============
app.use(requestLogger_1.default);
// ============= RATE LIMITING =============
app.use('/api/', rateLimit_1.default);
// ============= HEALTH CHECK =============
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
    });
});
// ============= ROUTES =============
app.use('/auth', auth_1.default);
app.use('/api', analysis_1.default);
app.use('/api', history_1.default);
// ============= 404 HANDLER =============
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path,
    });
});
// ============= ERROR HANDLER (MUST BE LAST) =============
app.use(errorHandler_1.default);
// ============= START SERVER =============
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║   LLMCouncil Backend Started           ║
║   🚀 Running on http://localhost:${PORT}  ║
║   📊 Environment: ${process.env.NODE_ENV}           ║
╚════════════════════════════════════════╝
  `);
});
// ============= GRACEFUL SHUTDOWN =============
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await database_1.pool.end();
    process.exit(0);
});
exports.default = app;
