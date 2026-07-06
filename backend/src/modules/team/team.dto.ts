import { z } from 'zod';
import { UserRole } from '../users/user-role';

const roleValues = [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.EMPLOYEE] as const;

/**
 * Owners can only be promoted by another owner via the dedicated transfer
 * flow — invites cannot create new owners directly.
 */
export const inviteMemberSchema = z.object({
  email: z.string().email().max(255).toLowerCase(),
  role: z.enum(roleValues).default(UserRole.ACCOUNTANT),
  expiresInDays: z.coerce.number().int().min(1).max(60).default(14),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum([UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.EMPLOYEE]),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(8).max(64),
  // Optional fields for the case where the invited email does not yet
  // have an account — frontend will collect name + password and we'll
  // create the user atomically with the membership.
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().min(1).max(120).optional(),
  password: z.string().min(8).max(72).optional(),
  locale: z.enum(['ar', 'en']).optional(),
});

export const inviteLookupSchema = z.object({
  token: z.string().min(8).max(64),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
