import { z } from 'zod';
import { PaymentLinkProvider } from './payment-link.entity';

export const createPaymentLinkSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().positive().optional(),
  expiresInDays: z.coerce.number().int().min(1).max(90).optional(),
  provider: z.nativeEnum(PaymentLinkProvider).optional(),
  sendWhatsapp: z.coerce.boolean().optional(),
});

export type CreatePaymentLinkInput = z.infer<typeof createPaymentLinkSchema>;
