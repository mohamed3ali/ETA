import { z } from 'zod';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const portalSearchSchema = z.object({
  direction: z.enum(['Sent', 'Received']).optional(),
  issueDateFrom: dateOnly,
  issueDateTo: dateOnly,
  status: z.enum(['Valid', 'Invalid', 'Rejected', 'Cancelled', 'Submitted']).optional(),
  documentType: z.string().max(4).optional(),
  uuid: z.string().max(64).optional(),
  internalID: z.string().max(64).optional(),
  issuerId: z.string().max(32).optional(),
  receiverId: z.string().max(32).optional(),
  continuationToken: z.string().optional(),
  pageSize: z.coerce.number().min(1).max(100).optional(),
  search: z.string().max(200).optional(),
});

export const portalRejectSchema = z.object({
  reason: z.string().min(3).max(500),
});

export type PortalSearchQuery = z.infer<typeof portalSearchSchema>;
export type PortalRejectBody = z.infer<typeof portalRejectSchema>;
