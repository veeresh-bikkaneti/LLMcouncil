import { Request, Response, NextFunction } from 'express';

export default function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    console.error('[ERROR]', err);
    const status = err.statusCode || 500;
    res.status(status).json({
        status: 'error',
        message: err.message || 'Internal Server Error',
    });
}
