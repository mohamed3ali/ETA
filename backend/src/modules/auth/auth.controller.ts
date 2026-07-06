import { Router } from 'express';
import { authService } from './auth.service';
import { loginSchema, refreshSchema, registerSchema, switchCompanySchema } from './auth.dto';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { requireAuth } from './auth.middleware';

export const authRouter = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new company + owner user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [companyName, taxRegistrationNumber, firstName, lastName, email, password]
 *             properties:
 *               companyName: { type: string }
 *               taxRegistrationNumber: { type: string }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       201: { description: Account created }
 */
authRouter.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res.status(201).json({ success: true, data: result });
  }),
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email + password
 */
authRouter.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    res.json({ success: true, data: result });
  }),
);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange a refresh token for a new access token
 */
authRouter.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.refresh(req.body.refreshToken);
    res.json({ success: true, data: result });
  }),
);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Current authenticated user
 *     security: [{ bearerAuth: [] }]
 */
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await authService.me(req.user!.sub);
    res.json({ success: true, data: result });
  }),
);

/**
 * @openapi
 * /auth/companies:
 *   get:
 *     tags: [Auth]
 *     summary: List all companies the current user has access to
 *     security: [{ bearerAuth: [] }]
 */
authRouter.get(
  '/companies',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = await authService.listCompanies(req.user!.sub);
    res.json({ success: true, data });
  }),
);

/**
 * @openapi
 * /auth/switch-company:
 *   post:
 *     tags: [Auth]
 *     summary: Switch the active company for the current user
 *     security: [{ bearerAuth: [] }]
 */
authRouter.post(
  '/switch-company',
  requireAuth,
  validate(switchCompanySchema),
  asyncHandler(async (req, res) => {
    const result = await authService.switchCompany(req.user!.sub, req.body.companyId);
    res.json({ success: true, data: result });
  }),
);
