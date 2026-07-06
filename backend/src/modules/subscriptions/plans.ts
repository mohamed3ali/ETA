import { env } from '../../config/env';
import { SubscriptionPlan } from './subscription.entity';

export type BillingPeriod = 'monthly' | 'yearly';

export interface PlanCatalogEntry {
  id: Exclude<SubscriptionPlan, SubscriptionPlan.TRIAL>;
  name: string;
  invoiceQuota: number;
  prices: Record<BillingPeriod, number>;
  originalPrices?: Record<BillingPeriod, number>;
  currency: string;
  discountPercent?: number;
}

/**
 * Canonical, server-side source of truth for paid plans. The landing page and
 * /checkout both pull these prices from /subscriptions/plans — billing always
 * uses this table.
 *
 * Yearly prices include a ~17% discount vs paying monthly for 12 months. Set
 * `LAUNCH_DISCOUNT_PERCENT` in the environment to layer a launch promo on top
 * (e.g. `LAUNCH_DISCOUNT_PERCENT=10` makes everything 10% cheaper across the
 * board). The original prices are still surfaced in the API so the UI can
 * show a struck-through "was" price.
 */
const BASE_PRICES: Record<
  Exclude<SubscriptionPlan, SubscriptionPlan.TRIAL>,
  { quota: number; name: string; monthly: number; yearly: number }
> = {
  [SubscriptionPlan.STARTER]: {
    name: 'Starter',
    quota: 200,
    monthly: 299,
    yearly: 2_990,
  },
  [SubscriptionPlan.PROFESSIONAL]: {
    name: 'Professional',
    quota: 1_000,
    monthly: 699,
    yearly: 6_990,
  },
  [SubscriptionPlan.ENTERPRISE]: {
    name: 'Enterprise',
    quota: 10_000,
    monthly: 1_999,
    yearly: 19_990,
  },
};

const round = (n: number) => Math.round(n);

const applyLaunchDiscount = (
  prices: { monthly: number; yearly: number },
  percent: number,
): { monthly: number; yearly: number } => ({
  monthly: round(prices.monthly * (1 - percent / 100)),
  yearly: round(prices.yearly * (1 - percent / 100)),
});

const buildCatalog = (): Record<
  Exclude<SubscriptionPlan, SubscriptionPlan.TRIAL>,
  PlanCatalogEntry
> => {
  const discount = Math.min(Math.max(env.LAUNCH_DISCOUNT_PERCENT, 0), 90);
  const entries = Object.entries(BASE_PRICES) as [
    Exclude<SubscriptionPlan, SubscriptionPlan.TRIAL>,
    (typeof BASE_PRICES)[keyof typeof BASE_PRICES],
  ][];

  return entries.reduce(
    (acc, [id, base]) => {
      const original = { monthly: base.monthly, yearly: base.yearly };
      const effective =
        discount > 0 ? applyLaunchDiscount(original, discount) : original;
      acc[id] = {
        id,
        name: base.name,
        invoiceQuota: base.quota,
        prices: effective,
        currency: 'EGP',
        ...(discount > 0
          ? { originalPrices: original, discountPercent: discount }
          : {}),
      };
      return acc;
    },
    {} as Record<Exclude<SubscriptionPlan, SubscriptionPlan.TRIAL>, PlanCatalogEntry>,
  );
};

export const PLAN_CATALOG = buildCatalog();

export function isPaidPlanId(
  plan: string,
): plan is Exclude<SubscriptionPlan, SubscriptionPlan.TRIAL> {
  return (
    plan === SubscriptionPlan.STARTER ||
    plan === SubscriptionPlan.PROFESSIONAL ||
    plan === SubscriptionPlan.ENTERPRISE
  );
}

export function planPrice(
  plan: Exclude<SubscriptionPlan, SubscriptionPlan.TRIAL>,
  billing: BillingPeriod,
): number {
  return PLAN_CATALOG[plan].prices[billing];
}
