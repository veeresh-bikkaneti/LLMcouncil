import { Router, Request, Response } from 'express';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
    res.json({ status: 'success', token: 'fake-jwt-token' });
});

export default router;
