/**
 * AI service scaffold — Phase 3.
 *
 * Goal: a small "conversational ERP" surface that:
 *   1. Translates natural-language questions into structured intents.
 *   2. Runs whitelisted, multi-tenant-scoped queries against the database.
 *   3. Returns both a human answer and the raw data.
 *
 * The MVP ships with a deterministic intent router (no LLM required). Wire up
 * OpenAI behind the `interpret()` function when `OPENAI_API_KEY` is set.
 */
import { dashboardService } from '../dashboard/dashboard.service';
import { AppDataSource } from '../../database/data-source';
import { Invoice, InvoiceStatus } from '../invoices/invoice.entity';
import { env } from '../../config/env';

export interface AiAnswer {
  intent: string;
  answer: string;
  data?: unknown;
}

const intents = [
  {
    name: 'overdue_count',
    match: (q: string) => /overdue|متأخر/.test(q),
    run: async (companyId: string): Promise<AiAnswer> => {
      const count = await AppDataSource.getRepository(Invoice).count({
        where: { companyId, status: InvoiceStatus.OVERDUE },
      });
      return {
        intent: 'overdue_count',
        answer: `You have ${count} overdue invoice${count === 1 ? '' : 's'}.`,
        data: { count },
      };
    },
  },
  {
    name: 'top_customers',
    match: (q: string) => /top.*(customer|عميل)|best.*customer/i.test(q),
    run: async (companyId: string): Promise<AiAnswer> => {
      const top = await dashboardService.getTopCustomers(companyId, 5);
      return {
        intent: 'top_customers',
        answer: `Top customers: ${top.map((c, i) => `${i + 1}. ${c.customerName} (${c.revenue} EGP)`).join(', ')}`,
        data: top,
      };
    },
  },
  {
    name: 'this_month_vat',
    match: (q: string) => /this month.*(vat|tax)|vat.*month|ضريبة|شهر/i.test(q),
    run: async (companyId: string): Promise<AiAnswer> => {
      const metrics = await dashboardService.getMetrics(companyId);
      return {
        intent: 'this_month_vat',
        answer: `Your VAT this month is ${metrics.thisMonth.vat.toFixed(2)} EGP from ${metrics.thisMonth.revenue.toFixed(2)} EGP in revenue.`,
        data: metrics.thisMonth,
      };
    },
  },
  {
    name: 'rejected_count',
    match: (q: string) => /reject|مرفوض/.test(q),
    run: async (companyId: string): Promise<AiAnswer> => {
      const count = await AppDataSource.getRepository(Invoice).count({
        where: { companyId, status: InvoiceStatus.REJECTED },
      });
      return {
        intent: 'rejected_count',
        answer: `You have ${count} rejected invoice${count === 1 ? '' : 's'} pending fix-up.`,
        data: { count },
      };
    },
  },
];

export const aiService = {
  hasLlm: () => !!env.OPENAI_API_KEY,

  async ask(companyId: string, question: string): Promise<AiAnswer> {
    for (const intent of intents) {
      if (intent.match(question)) return intent.run(companyId);
    }
    return {
      intent: 'fallback',
      answer:
        'I can help with overdue invoices, rejected invoices, top customers, and monthly VAT. (LLM integration coming soon.)',
    };
  },
};
