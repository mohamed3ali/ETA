import dayjs from 'dayjs';
import { AppDataSource } from '../../database/data-source';
import { Company, CompanyStatus } from './company.entity';
import { CompanyMembership } from './company-membership.entity';
import { UserRole } from '../users/user.entity';
import { Subscription, SubscriptionPlan, SubscriptionStatus } from '../subscriptions/subscription.entity';
import { HttpError } from '../../common/errors/HttpError';
import {
  CreateCompanyInput,
  UpdateCompanyInput,
  UpdateEtaCredentialsInput,
} from './company.dto';
import { env } from '../../config/env';

const repo = () => AppDataSource.getRepository(Company);
const membershipRepo = () => AppDataSource.getRepository(CompanyMembership);

export const companyService = {
  async getMine(companyId: string) {
    const c = await repo().findOne({ where: { id: companyId } });
    if (!c) throw HttpError.notFound('Company not found');
    return c;
  },

  async updateMine(companyId: string, input: UpdateCompanyInput) {
    const c = await this.getMine(companyId);
    Object.assign(c, input);
    return repo().save(c);
  },

  async updateEtaCredentials(companyId: string, input: UpdateEtaCredentialsInput) {
    const c = await this.getMine(companyId);
    c.etaClientId = input.etaClientId;
    c.etaClientSecret = input.etaClientSecret;
    c.etaEnvironment = input.etaEnvironment;
    return repo().save(c);
  },

  /**
   * Create a new company under an existing user account. The caller becomes
   * the OWNER of the new company via a CompanyMembership row. A trial
   * subscription is provisioned for the new company.
   */
  async createForUser(userId: string, input: CreateCompanyInput) {
    return AppDataSource.transaction(async (manager) => {
      const exists = await manager
        .getRepository(Company)
        .findOne({ where: { taxRegistrationNumber: input.taxRegistrationNumber } });
      if (exists) {
        throw HttpError.conflict('A company with this tax registration number already exists');
      }

      const hasEta =
        !!input.etaClientId?.trim() && !!input.etaClientSecret?.trim();

      const company = manager.getRepository(Company).create({
        name: input.name,
        nameEn: input.nameEn,
        taxRegistrationNumber: input.taxRegistrationNumber,
        email: input.email,
        phone: input.phone,
        address: input.address,
        defaultCurrency: input.defaultCurrency ?? 'EGP',
        status: CompanyStatus.TRIAL,
        etaClientId: hasEta ? input.etaClientId!.trim() : undefined,
        etaClientSecret: hasEta ? input.etaClientSecret!.trim() : undefined,
        etaEnvironment: hasEta
          ? (input.etaEnvironment ?? env.ETA_ENVIRONMENT)
          : env.ETA_ENVIRONMENT,
      });
      await manager.getRepository(Company).save(company);

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

      const membership = manager.getRepository(CompanyMembership).create({
        userId,
        companyId: company.id,
        role: UserRole.OWNER,
        isDefault: false,
      });
      await manager.getRepository(CompanyMembership).save(membership);

      return {
        id: company.id,
        name: company.name,
        nameEn: company.nameEn,
        status: company.status,
        taxRegistrationNumber: company.taxRegistrationNumber,
        role: UserRole.OWNER,
        isDefault: false,
      };
    });
  },

  async listForUser(userId: string) {
    const memberships = await membershipRepo().find({
      where: { userId },
      relations: ['company'],
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
    return memberships.map((m) => ({
      id: m.company.id,
      name: m.company.name,
      nameEn: m.company.nameEn,
      status: m.company.status,
      taxRegistrationNumber: m.company.taxRegistrationNumber,
      role: m.role,
      isDefault: m.isDefault,
    }));
  },
};
