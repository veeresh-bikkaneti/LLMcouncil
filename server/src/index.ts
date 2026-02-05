import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { pool } from './config/database';
import requestLogger from './middleware/requestLogger';
import errorHandler from './middleware/errorHandler';
import rateLimitMiddleware from './middleware/rateLimit';
import analysisRouter from './routes/analysis';
import authRouter from './routes/auth';
import historyRouter from './routes/history';

// Load environment variables
dotenv.config();

const app: Express = express();

// ============= DATABASE CONNECTION TEST =============
pool.query('SELECT 1')
    .then(() => console.log('✅ Database connected'))
    .catch(err => {
        console.error('❌ Database connection failed:', err);
        // process.exit(1); // Don't crash for now, just log
    });

// ============= SECURITY MIDDLEWARE =============
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    optionsSuccessStatus: 200,
}));

// ============= BODY PARSING =============
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ============= REQUEST LOGGING =============
app.use(requestLogger);

// ============= RATE LIMITING =============
app.use('/api/', rateLimitMiddleware);

// ============= HEALTH CHECK =============
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
    });
});

// ============= ROUTES =============
app.use('/auth', authRouter);
app.use('/api', analysisRouter);
app.use('/api', historyRouter);

// ============= 404 HANDLER =============
app.use((req: Request, res: Response) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path,
    });
});

// ============= ERROR HANDLER (MUST BE LAST) =============
app.use(errorHandler);

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
    await pool.end();
    process.exit(0);
});

export default app;
