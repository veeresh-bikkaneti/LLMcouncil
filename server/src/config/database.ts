import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DATABASE_POOL_SIZE || '20'),
    idleTimeoutMillis: parseInt(process.env.DATABASE_TIMEOUT || '30000'),
    connectionTimeoutMillis: 2000,
});

// Helper for single query execution
export const query = (text: string, params?: any[]) => pool.query(text, params);
