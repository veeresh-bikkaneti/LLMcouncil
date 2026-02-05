import { Router, Request, Response } from 'express';

const router = Router();

router.get('/history', (req: Request, res: Response) => {
  res.json({ status: 'success', data: [] });
});

export default router;
