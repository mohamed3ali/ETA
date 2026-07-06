import bcrypt from 'bcrypt';
import dayjs from 'dayjs';
import { customAlphabet } from 'nanoid';

import { AppDataSource } from '../../database/data-source';
import { HttpError } from '../../common/errors/HttpError';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

import { Company } from '../companies/company.entity';
import { CompanyMembership } from '../companies/company-membership.entity';
import { CompanyInvite, CompanyInviteStatus } from './company-invite.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role';

import {
  AcceptInviteInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
} from './team.dto';

const userRepo = () => AppDataSource.getRepository(User);
const companyRepo = () => AppDataSource.getRepository(Company);
const membershipRepo = () => AppDataSource.getRepository(CompanyMembership);
const inviteRepo = () => AppDataSource.getRepository(CompanyInvite);

const newToken = customAlphabet(
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789',
  40,
);

interface MemberView {
  id: string;
  membershipId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isDefault: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
  joinedAt: Date;
}

interface InviteView {
  id: string;
  email: string;
  role: UserRole;
  status: CompanyInviteStatus;
  token: string;
  inviteUrl: string;
  invitedByName: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  acceptedAt: Date | null;
}

const buildInviteUrl = (token: string) => {
  const base = (env.PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/accept-invite/${token}`;
};

const toMemberView = (
  m: Omit<CompanyMembership, 'user'> & { user?: User | null },
): MemberView => ({
  id: m.user?.id ?? m.userId,
  membershipId: m.id,
  email: m.user?.email ?? '',
  firstName: m.user?.firstName ?? '',
  lastName: m.user?.lastName ?? '',
  role: m.role,
  isDefault: m.isDefault,
  isActive: m.user?.isActive ?? true,
  lastLoginAt: m.user?.lastLoginAt ?? null,
  joinedAt: m.createdAt,
});

const toInviteView = (
  i: CompanyInvite & { invitedBy?: User | null },
): InviteView => ({
  id: i.id,
  email: i.email,
  role: i.role,
  status: i.status,
  token: i.token,
  inviteUrl: buildInviteUrl(i.token),
  invitedByName: i.invitedBy
    ? `${i.invitedBy.firstName} ${i.invitedBy.lastName}`.trim()
    : null,
  expiresAt: i.expiresAt ?? null,
  createdAt: i.createdAt,
  acceptedAt: i.acceptedAt ?? null,
});

const requireManager = async (
  userId: string,
  companyId: string,
): Promise<CompanyMembership> => {
  const m = await membershipRepo().findOne({ where: { userId, companyId } });
  if (!m) throw HttpError.forbidden('You do not have access to this company');
  if (m.role !== UserRole.OWNER && m.role !== UserRole.ADMIN) {
    throw HttpError.forbidden('Only company owners or admins can manage the team');
  }
  return m;
};

export const teamService = {
  async listMembers(companyId: string, callerUserId: string) {
    await requireManager(callerUserId, companyId);
    const rows = await membershipRepo().find({
      where: { companyId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
    return rows.map(toMemberView);
  },

  async listInvites(companyId: string, callerUserId: string) {
    await requireManager(callerUserId, companyId);
    const rows = await inviteRepo().find({
      where: { companyId },
      relations: ['invitedBy'],
      order: { createdAt: 'DESC' },
    });
    // Auto-expire any pending invites whose expiry has passed.
    const now = new Date();
    for (const row of rows) {
      if (
        row.status === CompanyInviteStatus.PENDING &&
        row.expiresAt &&
        row.expiresAt < now
      ) {
        row.status = CompanyInviteStatus.EXPIRED;
        await inviteRepo().save(row);
      }
    }
    return rows.map(toInviteView);
  },

  async invite(
    companyId: string,
    callerUserId: string,
    input: InviteMemberInput,
  ) {
    await requireManager(callerUserId, companyId);
    const company = await companyRepo().findOne({ where: { id: companyId } });
    if (!company) throw HttpError.notFound('Company not found');

    const email = input.email.toLowerCase().trim();

    // If the email already belongs to an active member of this company,
    // just return the existing membership info — re-inviting is a no-op.
    const existingUser = await userRepo()
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email })
      .getOne();
    if (existingUser) {
      const existingMembership = await membershipRepo().findOne({
        where: { userId: existingUser.id, companyId },
      });
      if (existingMembership) {
        throw HttpError.conflict('This user already has access to this company');
      }
    }

    // Reuse / refresh the pending invite if any.
    let invite = await inviteRepo().findOne({
      where: { companyId, email, status: CompanyInviteStatus.PENDING },
    });

    const token = newToken();
    const expiresAt = dayjs().add(input.expiresInDays, 'day').toDate();

    if (invite) {
      invite.role = input.role;
      invite.token = token;
      invite.expiresAt = expiresAt;
      invite.invitedById = callerUserId;
    } else {
      invite = inviteRepo().create({
        companyId,
        email,
        role: input.role,
        token,
        status: CompanyInviteStatus.PENDING,
        invitedById: callerUserId,
        expiresAt,
      });
    }
    await inviteRepo().save(invite);

    // Email/WhatsApp delivery hook — for now we log + surface the URL in the
    // API response so the inviter can copy it manually. Wire up email sending
    // here when SMTP/MailerSend is configured.
    logger.info(
      {
        companyId,
        email,
        inviteUrl: buildInviteUrl(token),
      },
      'Company invite issued',
    );

    return toInviteView({ ...invite, invitedBy: undefined });
  },

  async revokeInvite(companyId: string, callerUserId: string, inviteId: string) {
    await requireManager(callerUserId, companyId);
    const invite = await inviteRepo().findOne({ where: { id: inviteId, companyId } });
    if (!invite) throw HttpError.notFound('Invite not found');
    if (invite.status !== CompanyInviteStatus.PENDING) {
      throw HttpError.badRequest('Only pending invites can be revoked');
    }
    invite.status = CompanyInviteStatus.REVOKED;
    await inviteRepo().save(invite);
    return { id: invite.id, status: invite.status };
  },

  async updateRole(
    companyId: string,
    callerUserId: string,
    targetUserId: string,
    input: UpdateMemberRoleInput,
  ) {
    const callerMembership = await requireManager(callerUserId, companyId);
    if (callerUserId === targetUserId) {
      throw HttpError.badRequest('You cannot change your own role');
    }
    const target = await membershipRepo().findOne({
      where: { userId: targetUserId, companyId },
    });
    if (!target) throw HttpError.notFound('Member not found');
    if (target.role === UserRole.OWNER) {
      throw HttpError.forbidden('Owner role can only be transferred, not edited');
    }
    // Admins can manage accountant/employee, but only owners can manage admins.
    if (target.role === UserRole.ADMIN && callerMembership.role !== UserRole.OWNER) {
      throw HttpError.forbidden('Only the owner can edit an admin role');
    }
    target.role = input.role;
    await membershipRepo().save(target);
    return toMemberView({ ...target, user: undefined });
  },

  async removeMember(companyId: string, callerUserId: string, targetUserId: string) {
    const callerMembership = await requireManager(callerUserId, companyId);
    if (callerUserId === targetUserId) {
      throw HttpError.badRequest('You cannot remove yourself');
    }
    const target = await membershipRepo().findOne({
      where: { userId: targetUserId, companyId },
    });
    if (!target) throw HttpError.notFound('Member not found');
    if (target.role === UserRole.OWNER) {
      throw HttpError.forbidden('Cannot remove the owner');
    }
    if (target.role === UserRole.ADMIN && callerMembership.role !== UserRole.OWNER) {
      throw HttpError.forbidden('Only the owner can remove an admin');
    }
    await membershipRepo().remove(target);
    return { ok: true };
  },

  /** Public lookup so the accept-invite page can render company/role info. */
  async lookupInvite(token: string) {
    const invite = await inviteRepo().findOne({ where: { token } });
    if (!invite) throw HttpError.notFound('Invite not found');
    if (invite.status !== CompanyInviteStatus.PENDING) {
      throw HttpError.badRequest(`Invite is ${invite.status}`);
    }
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      invite.status = CompanyInviteStatus.EXPIRED;
      await inviteRepo().save(invite);
      throw HttpError.badRequest('Invite has expired');
    }
    const company = await companyRepo().findOne({ where: { id: invite.companyId } });
    const existingUser = await userRepo()
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email: invite.email.toLowerCase() })
      .getOne();

    return {
      token: invite.token,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      company: company
        ? { id: company.id, name: company.name, taxRegistrationNumber: company.taxRegistrationNumber }
        : null,
      needsAccount: !existingUser,
    };
  },

  /**
   * Two paths:
   *   1. Logged-in user (their JWT email matches the invite) — just create
   *      the membership and return the existing user.
   *   2. Fresh signup (no account yet) — create the user atomically with
   *      the membership using the firstName/lastName/password supplied.
   *
   * Either way, the caller is returned an auth payload identical to login.
   */
  async accept(input: AcceptInviteInput, currentUserId?: string) {
    return AppDataSource.transaction(async (manager) => {
      const inviteR = manager.getRepository(CompanyInvite);
      const userR = manager.getRepository(User);
      const memR = manager.getRepository(CompanyMembership);

      const invite = await inviteR.findOne({ where: { token: input.token } });
      if (!invite) throw HttpError.notFound('Invite not found');
      if (invite.status !== CompanyInviteStatus.PENDING) {
        throw HttpError.badRequest(`Invite is ${invite.status}`);
      }
      if (invite.expiresAt && invite.expiresAt < new Date()) {
        invite.status = CompanyInviteStatus.EXPIRED;
        await inviteR.save(invite);
        throw HttpError.badRequest('Invite has expired');
      }

      const email = invite.email.toLowerCase();
      let user = await userR
        .createQueryBuilder('u')
        .where('LOWER(u.email) = :email', { email })
        .getOne();

      if (!user) {
        if (!input.firstName || !input.lastName || !input.password) {
          throw HttpError.badRequest(
            'firstName, lastName and password are required when creating a new account',
          );
        }
        const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
        user = userR.create({
          email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          role: invite.role,
          locale: input.locale ?? 'ar',
          companyId: invite.companyId,
        });
        await userR.save(user);
      } else if (currentUserId && currentUserId !== user.id) {
        throw HttpError.forbidden(
          'You are signed in as a different user. Please log out and try again.',
        );
      }

      // Ensure membership exists (idempotent).
      let membership = await memR.findOne({
        where: { userId: user.id, companyId: invite.companyId },
      });
      if (!membership) {
        membership = memR.create({
          userId: user.id,
          companyId: invite.companyId,
          role: invite.role,
          isDefault: false,
        });
        await memR.save(membership);
      } else if (membership.role !== invite.role) {
        // Existing access — upgrade/downgrade role to match invite.
        membership.role = invite.role;
        await memR.save(membership);
      }

      invite.status = CompanyInviteStatus.ACCEPTED;
      invite.acceptedAt = new Date();
      await inviteR.save(invite);

      return {
        userId: user.id,
        companyId: invite.companyId,
        membershipId: membership.id,
        role: membership.role,
      };
    });
  },
};
