import dayjs from 'dayjs';
import { EntityManager, LessThan } from 'typeorm';

import { AppDataSource } from '../../database/data-source';
import { HttpError } from '../../common/errors/HttpError';
import { logger } from '../../config/logger';

import { Subscription, SubscriptionStatus } from './subscription.entity';

export interface SubscriptionUsage {
  hasSubscription: boolean;
  active: boolean;
  plan: string | null;
  status: SubscriptionStatus | null;
  startsAt: string | null;
  endsAt: string | null;
  daysRemaining: number | null;
  invoiceQuota: number;
  invoicesUsed: number;
  invoicesRemaining: number;
  isUnlimited: boolean;
}

const subRepo = (manager?: EntityManager) =>
  (manager ?? AppDataSource.manager).getRepository(Subscription);

const daysBetween = (endsAt?: string | null) => {
  if (!endsAt) return null;
  return dayjs(endsAt).startOf('day').diff(dayjs().startOf('day'), 'day');
};

/**
 * Returns the company's currently effective subscription (most recent ACTIVE).
 * Does NOT auto-expire — that's the daily cron's job ({@link expireOverdueSubscriptions}).
 */
const getActive = (companyId: string, manager?: EntityManager) =>
  subRepo(manager).findOne({
    where: { companyId, status: SubscriptionStatus.ACTIVE },
    order: { createdAt: 'DESC' },
  });

/**
 * Build a usage snapshot for the dashboard / settings page.
 */
export const getUsage = async (companyId: string): Promise<SubscriptionUsage> => {
  const sub = await getActive(companyId);
  if (!sub) {
    return {
      hasSubscription: false,
      active: false,
      plan: null,
      status: null,
      startsAt: null,
      endsAt: null,
      daysRemaining: null,
      invoiceQuota: 0,
      invoicesUsed: 0,
      invoicesRemaining: 0,
      isUnlimited: false,
    };
  }
  const quota = sub.invoiceQuota ?? 0;
  const used = sub.invoicesUsed ?? 0;
  return {
    hasSubscription: true,
    active: sub.status === SubscriptionStatus.ACTIVE,
    plan: sub.plan,
    status: sub.status,
    startsAt: sub.startsAt,
    endsAt: sub.endsAt ?? null,
    daysRemaining: daysBetween(sub.endsAt),
    invoiceQuota: quota,
    invoicesUsed: used,
    invoicesRemaining: Math.max(0, quota - used),
    isUnlimited: quota <= 0,
  };
};

/**
 * Throws if the company has no active subscription or it has passed `endsAt`.
 * Used by the gate middleware on write/billable endpoints.
 */
export const assertActiveSubscription = async (companyId: string): Promise<Subscription> => {
  const sub = await getActive(companyId);
  if (!sub) {
    throw new HttpError(
      402,
      'No active subscription — please subscribe to continue.',
      'SUBSCRIPTION_REQUIRED',
    );
  }
  if (sub.endsAt && dayjs(sub.endsAt).isBefore(dayjs(), 'day')) {
    throw new HttpError(
      402,
      'Your subscription has expired — renew to continue.',
      'SUBSCRIPTION_EXPIRED',
    );
  }
  return sub;
};

/**
 * Asserts the company can create another invoice this period. Quota of 0
 * (or negative) is treated as "unlimited" — handy for trial overrides.
 */
export const assertCanCreateInvoice = async (
  companyId: string,
  manager?: EntityManager,
): Promise<Subscription> => {
  const sub = await assertActiveSubscription(companyId);
  const quota = sub.invoiceQuota ?? 0;
  if (quota > 0 && (sub.invoicesUsed ?? 0) >= quota) {
    throw new HttpError(
      402,
      `Monthly invoice quota of ${quota} reached for plan ${sub.plan} — upgrade to add more.`,
      'QUOTA_EXCEEDED',
      { plan: sub.plan, quota, used: sub.invoicesUsed },
    );
  }
  // Re-fetch via the transactional manager so the increment below sees a fresh row.
  return manager ? subRepo(manager).findOneOrFail({ where: { id: sub.id } }) : sub;
};

/**
 * Atomic +1 on `invoicesUsed`. Always pass the transaction manager from the
 * caller so the counter and the invoice insert succeed or fail together.
 */
export const incrementInvoiceUsage = async (
  companyId: string,
  manager: EntityManager,
): Promise<void> => {
  await subRepo(manager)
    .createQueryBuilder()
    .update(Subscription)
    .set({ invoicesUsed: () => '`invoicesUsed` + 1' })
    .where('companyId = :companyId AND status = :status', {
      companyId,
      status: SubscriptionStatus.ACTIVE,
    })
    .execute();
};

/**
 * Daily cron entry point — flips any ACTIVE subscription whose `endsAt` is
 * in the past to EXPIRED. Idempotent; safe to call as often as you like.
 */
export const expireOverdueSubscriptions = async (): Promise<{ expired: number }> => {
  const today = dayjs().format('YYYY-MM-DD');
  const overdue = await subRepo().find({
    where: { status: SubscriptionStatus.ACTIVE, endsAt: LessThan(today) },
  });
  if (overdue.length === 0) return { expired: 0 };

  for (const sub of overdue) {
    sub.status = SubscriptionStatus.EXPIRED;
  }
  await subRepo().save(overdue);
  logger.info({ count: overdue.length }, 'Expired overdue subscriptions');
  return { expired: overdue.length };
};

export const quotaService = {
  getActive,
  getUsage,
  assertActiveSubscription,
  assertCanCreateInvoice,
  incrementInvoiceUsage,
  expireOverdueSubscriptions,
};
