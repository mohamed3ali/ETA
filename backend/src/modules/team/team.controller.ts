import { Router } from 'express';

import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { requireAuth } from '../auth/auth.middleware';
import { authService } from '../auth/auth.service';

import { teamService } from './team.service';
import {
  acceptInviteSchema,
  inviteLookupSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from './team.dto';

export const teamRouter = Router();
teamRouter.use(requireAuth);

/**
 * @openapi
 * /team/members:
 *   get:
 *     tags: [Team]
 *     summary: List members of the current active company
 *     security: [{ bearerAuth: [] }]
 */
teamRouter.get(
  '/members',
  asyncHandler(async (req, res) => {
    const data = await teamService.listMembers(req.user!.companyId, req.user!.sub);
    res.json({ success: true, data });
  }),
);

/**
 * @openapi
 * /team/invites:
 *   get:
 *     tags: [Team]
 *     summary: List invites issued for the current active company
 *     security: [{ bearerAuth: [] }]
 */
teamRouter.get(
  '/invites',
  asyncHandler(async (req, res) => {
    const data = await teamService.listInvites(req.user!.companyId, req.user!.sub);
    res.json({ success: true, data });
  }),
);

/**
 * @openapi
 * /team/invites:
 *   post:
 *     tags: [Team]
 *     summary: Invite a new member to the current active company
 *     security: [{ bearerAuth: [] }]
 */
teamRouter.post(
  '/invites',
  validate(inviteMemberSchema),
  asyncHandler(async (req, res) => {
    const data = await teamService.invite(
      req.user!.companyId,
      req.user!.sub,
      req.body,
    );
    res.status(201).json({ success: true, data });
  }),
);

teamRouter.post(
  '/invites/:id/revoke',
  asyncHandler(async (req, res) => {
    const data = await teamService.revokeInvite(
      req.user!.companyId,
      req.user!.sub,
      req.params.id,
    );
    res.json({ success: true, data });
  }),
);

teamRouter.patch(
  '/members/:userId/role',
  validate(updateMemberRoleSchema),
  asyncHandler(async (req, res) => {
    const data = await teamService.updateRole(
      req.user!.companyId,
      req.user!.sub,
      req.params.userId,
      req.body,
    );
    res.json({ success: true, data });
  }),
);

teamRouter.delete(
  '/members/:userId',
  asyncHandler(async (req, res) => {
    const data = await teamService.removeMember(
      req.user!.companyId,
      req.user!.sub,
      req.params.userId,
    );
    res.json({ success: true, data });
  }),
);

/**
 * Public router for accept-invite flow. Mounted under /api/public/invites
 * by the router index so unauthenticated visitors can preview & accept.
 */
export const publicInviteRouter = Router();

publicInviteRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const data = await teamService.lookupInvite(req.params.token);
    res.json({ success: true, data });
  }),
);

/**
 * Accept an invite. If the email has no account, the body must include
 * firstName/lastName/password and we will create one atomically. On success
 * we return a full auth payload (user, company, tokens, companies) — same
 * shape as POST /auth/login — and the frontend can drop the user straight
 * into the dashboard for the newly joined company.
 */
publicInviteRouter.post(
  '/accept',
  validate(acceptInviteSchema),
  asyncHandler(async (req, res) => {
    const { userId, companyId } = await teamService.accept(req.body);
    // Activate the joined company for this user, then return a fresh
    // session payload identical to login.
    const result = await authService.switchCompany(userId, companyId);
    res.json({ success: true, data: result });
  }),
);

publicInviteRouter.get(
  '/:token/preview',
  validate(inviteLookupSchema, 'params'),
  asyncHandler(async (req, res) => {
    const data = await teamService.lookupInvite(req.params.token);
    res.json({ success: true, data });
  }),
);
