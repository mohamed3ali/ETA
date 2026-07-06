import bcrypt from 'bcrypt';
import { AppDataSource } from '../../database/data-source';
import { User, UserRole } from '../users/user.entity';
import { Company, CompanyStatus } from '../companies/company.entity';
import { CompanyMembership } from '../companies/company-membership.entity';
import { Subscription, SubscriptionPlan, SubscriptionStatus } from '../subscriptions/subscription.entity';
import { HttpError } from '../../common/errors/HttpError';
import { env } from '../../config/env';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './jwt.service';
import { LoginInput, RegisterInput } from './auth.dto';
import dayjs from 'dayjs';

const userRepo = () => AppDataSource.getRepository(User);
const membershipRepo = () => AppDataSource.getRepository(CompanyMembership);

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const buildTokens = (user: User): AuthTokens => ({
  accessToken: signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
  }),
  refreshToken: signRefreshToken({ sub: user.id, companyId: user.companyId }),
});

const sanitizeUser = (u: User) => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  role: u.role,
  locale: u.locale,
  phone: u.phone,
  companyId: u.companyId,
  isActive: u.isActive,
  lastLoginAt: u.lastLoginAt,
});

export const authService = {
  async register(input: RegisterInput) {
    return AppDataSource.transaction(async (manager) => {
      const existingCompany = await manager
        .getRepository(Company)
        .findOne({ where: { taxRegistrationNumber: input.taxRegistrationNumber } });
      if (existingCompany) {
        throw HttpError.conflict('A company with this tax registration number already exists');
      }

      const emailLc = input.email.toLowerCase();
      const existingUser = await manager
        .getRepository(User)
        .createQueryBuilder('u')
        .where('LOWER(u.email) = :email', { email: emailLc })
        .getOne();
      if (existingUser) {
        throw HttpError.conflict(
          'An account with this email already exists — sign in and use "Add company" instead.',
        );
      }

      const company = manager.getRepository(Company).create({
        name: input.companyName,
        taxRegistrationNumber: input.taxRegistrationNumber,
        email: input.email,
        status: CompanyStatus.TRIAL,
        defaultCurrency: 'EGP',
        etaEnvironment: env.ETA_ENVIRONMENT,
      });
      await manager.getRepository(Company).save(company);

      // 14-day trial subscription
      const sub = manager.getRepository(Subscription).create({
        companyId: company.id,
        plan: SubscriptionPlan.TRIAL,
        status: SubscriptionStatus.ACTIVE,
        startsAt: dayjs().format('YYYY-MM-DD'),
        endsAt: dayjs().add(14, 'day').format('YYYY-MM-DD'),
        invoiceQuota: 100,
        price: 0,
      });
      await manager.getRepository(Subscription).save(sub);

      const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
      const user = manager.getRepository(User).create({
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        role: UserRole.OWNER,
        locale: input.locale ?? 'en',
        companyId: company.id,
      });
      await manager.getRepository(User).save(user);

      const membership = manager.getRepository(CompanyMembership).create({
        userId: user.id,
        companyId: company.id,
        role: UserRole.OWNER,
        isDefault: true,
      });
      await manager.getRepository(CompanyMembership).save(membership);

      return {
        user: sanitizeUser(user),
        company: { id: company.id, name: company.name, status: company.status },
        companies: [
          {
            id: company.id,
            name: company.name,
            status: company.status,
            taxRegistrationNumber: company.taxRegistrationNumber,
            role: UserRole.OWNER,
            isDefault: true,
          },
        ],
        tokens: buildTokens(user),
      };
    });
  },

  async listCompanies(userId: string) {
    const memberships = await membershipRepo().find({
      where: { userId },
      relations: ['company'],
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
    return memberships.map((m) => ({
      id: m.company.id,
      name: m.company.name,
      status: m.company.status,
      taxRegistrationNumber: m.company.taxRegistrationNumber,
      role: m.role,
      isDefault: m.isDefault,
    }));
  },

  async switchCompany(userId: string, targetCompanyId: string) {
    const user = await userRepo().findOne({ where: { id: userId } });
    if (!user || !user.isActive) throw HttpError.unauthorized('User no longer valid');

    const membership = await membershipRepo().findOne({
      where: { userId, companyId: targetCompanyId },
      relations: ['company'],
    });
    if (!membership) throw HttpError.forbidden('You do not have access to this company');

    user.companyId = targetCompanyId;
    user.role = membership.role;
    await userRepo().save(user);

    return {
      user: sanitizeUser(user),
      company: {
        id: membership.company.id,
        name: membership.company.name,
        status: membership.company.status,
        taxRegistrationNumber: membership.company.taxRegistrationNumber,
      },
      tokens: buildTokens(user),
    };
  },

  async login(input: LoginInput) {
    const user = await userRepo().findOne({
      where: { email: input.email },
      relations: ['company'],
    });
    if (!user || !user.isActive) {
      throw HttpError.unauthorized('Invalid credentials');
    }
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw HttpError.unauthorized('Invalid credentials');
    }
    user.lastLoginAt = new Date();

    // If user has memberships, prefer the default one as active company.
    const memberships = await membershipRepo().find({
      where: { userId: user.id },
      relations: ['company'],
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
    if (memberships.length > 0) {
      const def = memberships.find((m) => m.isDefault) ?? memberships[0];
      if (user.companyId !== def.companyId) {
        user.companyId = def.companyId;
        user.role = def.role;
      }
    }
    await userRepo().save(user);

    const activeCompany = memberships.find((m) => m.companyId === user.companyId)?.company
      ?? user.company;

    return {
      user: sanitizeUser(user),
      company: {
        id: activeCompany.id,
        name: activeCompany.name,
        status: activeCompany.status,
        taxRegistrationNumber: activeCompany.taxRegistrationNumber,
      },
      companies: memberships.map((m) => ({
        id: m.company.id,
        name: m.company.name,
        status: m.company.status,
        taxRegistrationNumber: m.company.taxRegistrationNumber,
        role: m.role,
        isDefault: m.isDefault,
      })),
      tokens: buildTokens(user),
    };
  },

  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw HttpError.unauthorized('Invalid refresh token');
    }
    const user = await userRepo().findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive || user.companyId !== payload.companyId) {
      throw HttpError.unauthorized('User no longer valid');
    }
    return { tokens: buildTokens(user) };
  },

  async me(userId: string) {
    const user = await userRepo().findOne({ where: { id: userId }, relations: ['company'] });
    if (!user) throw HttpError.notFound('User not found');
    const memberships = await membershipRepo().find({
      where: { userId },
      relations: ['company'],
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
    return {
      user: sanitizeUser(user),
      company: {
        id: user.company.id,
        name: user.company.name,
        taxRegistrationNumber: user.company.taxRegistrationNumber,
        status: user.company.status,
        defaultCurrency: user.company.defaultCurrency,
      },
      companies: memberships.map((m) => ({
        id: m.company.id,
        name: m.company.name,
        status: m.company.status,
        taxRegistrationNumber: m.company.taxRegistrationNumber,
        role: m.role,
        isDefault: m.isDefault,
      })),
    };
  },
};
