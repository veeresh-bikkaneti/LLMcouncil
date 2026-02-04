import rateLimit from 'express-rate-limit';

const rateLimitMiddleware = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { error: 'Too many requests, please try again later.' }
});

export default rateLimitMiddleware;
