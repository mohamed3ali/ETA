import { customAlphabet } from 'nanoid';
import dayjs from 'dayjs';

import { AppDataSource } from '../../database/data-source';
import { env } from '../../config/env';
import { HttpError } from '../../common/errors/HttpError';
import { logger } from '../../config/logger';

import { Company, CompanyStatus } from '../companies/company.entity';
import { User } from '../users/user.entity';
import { paymobAdapter } from '../payment-links/paymob.adapter';

import { Subscription, SubscriptionPlan, SubscriptionStatus } from './subscription.entity';
import {
  SubscriptionCheckout,
  SubscriptionCheckoutProvider,
  SubscriptionCheckoutStatus,
  BillingPeriod,
} from './subscription-checkout.entity';
import { PLAN_CATALOG, isPaidPlanId, planPrice } from './plans';

const subRepo = () => AppDataSource.getRepository(Subscription);
const coRepo = () => AppDataSource.getRepository(SubscriptionCheckout);

const newToken = customAlphabet(
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789',
  32,
);

interface StartCheckoutInput {
  plan: SubscriptionPlan;
  billingPeriod: BillingPeriod;
}

export const subscriptionService = {
  /**
   * Returns the active subscription for a company (or null if none).
   */
  async getActive(companyId: string) {
    return subRepo().findOne({
      where: { companyId, status: SubscriptionStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  },

  /**
   * Returns the public plan catalog (prices + quotas). Safe to expose
   * unauthenticated so the landing page can stay in sync with the backend.
   */
  catalog() {
    return PLAN_CATALOG;
  },

  /**
   * Create a new checkout session for the current company + user. Returns a
   * `checkoutUrl` the frontend should immediately redirect to. When Paymob
   * is configured, this is the hosted Paymob URL; otherwise it points at
   * our public `/checkout/complete?token=...` page where the user can
   * confirm the mock payment.
   */
  async startCheckout(companyId: string, userId: string, input: StartCheckoutInput) {
    if (!isPaidPlanId(input.plan)) {
      throw HttpError.badRequest('Trial plans cannot be purchased — they are auto-assigned.');
    }

    const company = await AppDataSource.getRepository(Company).findOne({
      where: { id: companyId },
    });
    if (!company) throw HttpError.notFound('Company not found');

    const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId } });

    const amount = planPrice(input.plan, input.billingPeriod);
    const catalog = PLAN_CATALOG[input.plan];
    const token = newToken();

    const publicBase = (env.PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const fallbackUrl = `${publicBase}/checkout/complete?token=${token}`;
    const webhookBase = (env.PUBLIC_API_URL || `http://localhost:${env.API_PORT}${env.API_PREFIX}`).replace(
      /\/$/,
      '',
    );
    const webhookUrl = `${webhookBase}/public/subscription/${token}/webhook`;

    let checkoutUrl = fallbackUrl;
    let providerRef: string | null = null;
    let provider: SubscriptionCheckoutProvider = SubscriptionCheckoutProvider.MOCK;

    if (paymobAdapter.isConfigured()) {
      try {
        const intention = await paymobAdapter.createIntention({
          amountMinor: Math.round(amount * 100),
          currency: catalog.currency,
          redirectionUrl: fallbackUrl,
          webhookUrl,
          reference: `SUB-${input.plan.toUpperCase()}-${token.slice(0, 6)}`,
          billing: {
            name: user ? `${user.firstName} ${user.lastName}`.trim() : company.name,
            email: user?.email ?? company.email ?? undefined,
            phone: user?.phone ?? company.phone ?? undefined,
          },
        });
        checkoutUrl = intention.checkoutUrl;
        providerRef = intention.providerRef;
        provider = intention.mock
          ? SubscriptionCheckoutProvider.MOCK
          : SubscriptionCheckoutProvider.PAYMOB;
      } catch (err) {
        logger.error({ err }, 'Paymob subscription intention failed — falling back to mock');
        provider = SubscriptionCheckoutProvider.MOCK;
      }
    }

    const checkout = coRepo().create({
      companyId,
      createdById: userId,
      token,
      plan: input.plan,
      billingPeriod: input.billingPeriod,
      amount,
      currency: catalog.currency,
      status: SubscriptionCheckoutStatus.PENDING,
      provider,
      providerRef,
      checkoutUrl,
      expiresAt: dayjs().add(1, 'day').toDate(),
    });
    await coRepo().save(checkout);

    return checkout;
  },

  /**
   * Public-safe payload describing a checkout session. Used by the
   * post-payment "complete" page so customers can see what they bought.
   */
  async getCheckoutPublic(token: string) {
    const co = await coRepo().findOne({ where: { token } });
    if (!co) throw HttpError.notFound('Checkout session not found');
    const company = await AppDataSource.getRepository(Company).findOne({
      where: { id: co.companyId },
    });

    if (
      co.status === SubscriptionCheckoutStatus.PENDING &&
      co.expiresAt &&
      co.expiresAt < new Date()
    ) {
      co.status = SubscriptionCheckoutStatus.EXPIRED;
      await coRepo().save(co);
    }

    const catalog = PLAN_CATALOG[co.plan as keyof typeof PLAN_CATALOG];

    return {
      token: co.token,
      plan: co.plan,
      planName: catalog?.name ?? co.plan,
      invoiceQuota: catalog?.invoiceQuota ?? null,
      billingPeriod: co.billingPeriod,
      amount: Number(co.amount),
      currency: co.currency,
      status: co.status,
      provider: co.provider,
      checkoutUrl: co.checkoutUrl,
      paidAt: co.paidAt,
      expiresAt: co.expiresAt,
      company: company
        ? { name: company.name, logoUrl: company.logoUrl }
        : { name: '—', logoUrl: undefined },
    };
  },

  async getCheckoutByToken(token: string) {
    return coRepo().findOne({ where: { token } });
  },

  /**
   * Finalize a checkout: mark paid, activate (or create) the matching
   * Subscription row, expire the company's TRIAL, and bump the company's
   * status to ACTIVE. Idempotent — calling twice for the same token is a
   * no-op after the first success.
   */
  async markCheckoutPaid(token: string, source: { providerRef?: string; mock?: boolean }) {
    return AppDataSource.transaction(async (manager) => {
      const co = await manager
        .getRepository(SubscriptionCheckout)
        .findOne({ where: { token } });
      if (!co) throw HttpError.notFound('Checkout session not found');
      if (co.status === SubscriptionCheckoutStatus.PAID) return co;
      if (co.status !== SubscriptionCheckoutStatus.PENDING) {
        throw HttpError.badRequest('Checkout session is not payable');
      }

      const catalog = PLAN_CATALOG[co.plan as keyof typeof PLAN_CATALOG];
      const months = co.billingPeriod === 'yearly' ? 12 : 1;
      const startsAt = dayjs().format('YYYY-MM-DD');
      const endsAt = dayjs().add(months, 'month').format('YYYY-MM-DD');

      // Expire any existing active subscription for this company
      await manager
        .getRepository(Subscription)
        .createQueryBuilder()
        .update()
        .set({ status: SubscriptionStatus.EXPIRED, endsAt })
        .where('companyId = :cid AND status = :s', {
          cid: co.companyId,
          s: SubscriptionStatus.ACTIVE,
        })
        .execute();

      const sub = manager.getRepository(Subscription).create({
        companyId: co.companyId,
        plan: co.plan,
        status: SubscriptionStatus.ACTIVE,
        startsAt,
        endsAt,
        invoiceQuota: catalog?.invoiceQuota ?? 100,
        invoicesUsed: 0,
        price: Number(co.amount),
        currency: co.currency,
      });
      await manager.getRepository(Subscription).save(sub);

      await manager
        .getRepository(Company)
        .update(co.companyId, { status: CompanyStatus.ACTIVE });

      co.status = SubscriptionCheckoutStatus.PAID;
      co.paidAt = new Date();
      if (source.providerRef) co.providerRef = source.providerRef;
      await manager.getRepository(SubscriptionCheckout).save(co);

      logger.info(
        { companyId: co.companyId, plan: co.plan, billingPeriod: co.billingPeriod },
        'Subscription activated',
      );

      return co;
    });
  },

  async cancelCheckout(companyId: string, id: string) {
    const co = await coRepo().findOne({ where: { id, companyId } });
    if (!co) throw HttpError.notFound('Checkout session not found');
    if (co.status !== SubscriptionCheckoutStatus.PENDING) {
      throw HttpError.badRequest('Only pending checkout sessions can be cancelled');
    }
    co.status = SubscriptionCheckoutStatus.CANCELLED;
    await coRepo().save(co);
    return co;
  },
};
