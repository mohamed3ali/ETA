import dayjs from 'dayjs';

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export enum TaxFilingStatus {
  DRAFT = 'draft',
  READY_TO_FILE = 'ready_to_file',
  FILED = 'filed',
}

/** Egyptian withholding rates by payment type (Form 41). */
export const WITHHOLDING_RATES: Record<string, { rate: number; labelAr: string }> = {
  contractors: { rate: 0.05, labelAr: 'مقاولات' },
  professional_services: { rate: 0.1, labelAr: 'خدمات مهنية' },
  dividends: { rate: 0.1, labelAr: 'أرباح موزعة' },
  interest: { rate: 0.2, labelAr: 'فوائد' },
  royalties: { rate: 0.2, labelAr: 'إتاوات' },
  rent: { rate: 0.1, labelAr: 'إيجار' },
  commissions: { rate: 0.05, labelAr: 'عمولات' },
  prizes: { rate: 0.2, labelAr: 'جوائز' },
};

export function calcWithholding(grossAmount: number, paymentType: string): number {
  const rate = WITHHOLDING_RATES[paymentType]?.rate ?? 0.05;
  return Math.round(grossAmount * rate * 100) / 100;
}

export function quarterToMonths(quarter: Quarter): [number, number] {
  switch (quarter) {
    case 'Q1':
      return [1, 3];
    case 'Q2':
      return [4, 6];
    case 'Q3':
      return [7, 9];
    case 'Q4':
      return [10, 12];
  }
}

export function quarterEndDate(year: number, quarter: Quarter): dayjs.Dayjs {
  const [, endMonth] = quarterToMonths(quarter);
  return dayjs(`${year}-${String(endMonth).padStart(2, '0')}-01`).endOf('month');
}

/** VAT return deadline: 15th of the month following the tax period. */
export function vatDeadline(year: number, month: number): dayjs.Dayjs {
  return dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
    .add(1, 'month')
    .date(15)
    .startOf('day');
}

export function form41Deadline(year: number, quarter: Quarter): dayjs.Dayjs {
  // Quarter-end + 1 month (typical ETA filing window); calendar uses quarter end for "due soon".
  return quarterEndDate(year, quarter).add(1, 'month').date(15).startOf('day');
}

export type CalendarItemStatus = 'filed' | 'due_soon' | 'overdue' | 'upcoming';

export function deadlineStatus(
  deadline: dayjs.Dayjs,
  filed: boolean,
  dueSoonDays: number,
): CalendarItemStatus {
  if (filed) return 'filed';
  const today = dayjs().startOf('day');
  const daysLeft = deadline.diff(today, 'day');
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= dueSoonDays) return 'due_soon';
  return 'upcoming';
}
