import { Router } from 'express';
import { z } from 'zod';
import { aiService } from './ai.service';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { requireAuth } from '../auth/auth.middleware';

const askSchema = z.object({
  question: z.string().min(1).max(500),
});

export const aiRouter = Router();
aiRouter.use(requireAuth);

aiRouter.post(
  '/ask',
  validate(askSchema),
  asyncHandler(async (req, res) => {
    const data = await aiService.ask(req.user!.companyId, req.body.question);
    res.json({ success: true, data });
  }),
);
