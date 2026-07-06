import { z } from 'zod';
import { WhatsappTemplate } from './whatsapp-message.entity';

export const updateSettingsSchema = z
  .object({
    whatsappEnabled: z.boolean().optional(),
    sendOnAccepted: z.boolean().optional(),
    sendReminders: z.boolean().optional(),
    reminderLeadDays: z.coerce.number().int().min(0).max(30).optional(),
    sendOnOverdue: z.boolean().optional(),
    sendOnPaid: z.boolean().optional(),
    alertOverdue: z.boolean().optional(),
    alertRejected: z.boolean().optional(),
    alertSubmissionStuck: z.boolean().optional(),
    alertLargeInvoice: z.boolean().optional(),
    alertLargeInvoiceThreshold: z.coerce.number().min(0).optional(),
    templates: z.record(z.string()).nullable().optional(),
  })
  .strict();

export const sendInvoiceMessageSchema = z.object({
  invoiceId: z.string().uuid(),
  template: z.nativeEnum(WhatsappTemplate),
  variables: z.record(z.string()).optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type SendInvoiceMessageInput = z.infer<typeof sendInvoiceMessageSchema>;
