import { z } from 'zod';
import { SubscriptionPlan } from './subscription.entity';

export const startCheckoutSchema = z.object({
  plan: z.enum([
    SubscriptionPlan.STARTER,
    SubscriptionPlan.PROFESSIONAL,
    SubscriptionPlan.ENTERPRISE,
  ]),
  billingPeriod: z.enum(['monthly', 'yearly']).default('monthly'),
});

export type StartCheckoutInput = z.infer<typeof startCheckoutSchema>;
