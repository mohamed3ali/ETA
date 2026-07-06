import dayjs from 'dayjs';
import { AppDataSource } from '../../database/data-source';
import { VatReturn } from './vat-return.entity';
import { Form41Return } from './form41-return.entity';
import {
  TaxFilingStatus,
  vatDeadline,
  form41Deadline,
  deadlineStatus,
  type Quarter,
  type CalendarItemStatus,
} from './tax.utils';

export interface TaxCalendarItem {
  id: string;
  type: 'vat' | 'form41';
  title: string;
  periodLabel: string;
  deadline: string;
  status: CalendarItemStatus;
  href: string;
  year: number;
  month?: number;
  quarter?: string;
}

export const taxCalendarService = {
  async list(companyId: string): Promise<TaxCalendarItem[]> {
    const items: TaxCalendarItem[] = [];
    const today = dayjs();
    const vatRepo = AppDataSource.getRepository(VatReturn);
    const form41Repo = AppDataSource.getRepository(Form41Return);

    // VAT: current month + previous 2 months
    for (let i = 0; i < 3; i++) {
      const d = today.subtract(i, 'month');
      const year = d.year();
      const month = d.month() + 1;
      const deadline = vatDeadline(year, month);
      const row = await vatRepo.findOne({ where: { companyId, year, month } });
      const filed = row?.status === TaxFilingStatus.FILED;
      const monthName = d.locale('ar').format('MMMM YYYY');
      items.push({
        id: `vat-${year}-${month}`,
        type: 'vat',
        title: 'إقرار ضريبة القيمة المضافة',
        periodLabel: monthName,
        deadline: deadline.format('YYYY-MM-DD'),
        status: deadlineStatus(deadline, filed, 7),
        href: `/vat-return?year=${year}&month=${month}`,
        year,
        month,
      });
    }

    const year = today.year();
    const quarters: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
    const quarterLabels: Record<Quarter, string> = {
      Q1: 'الربع الأول',
      Q2: 'الربع الثاني',
      Q3: 'الربع الثالث',
      Q4: 'الربع الرابع',
    };

    for (const quarter of quarters) {
      const deadline = form41Deadline(year, quarter);
      const row = await form41Repo.findOne({ where: { companyId, year, quarter } });
      const filed = row?.status === TaxFilingStatus.FILED;
      items.push({
        id: `form41-${year}-${quarter}`,
        type: 'form41',
        title: 'نموذج 41 — خصم وتحصيل',
        periodLabel: `${quarterLabels[quarter]} ${year}`,
        deadline: deadline.format('YYYY-MM-DD'),
        status: deadlineStatus(deadline, filed, 7),
        href: `/form41?year=${year}&quarter=${quarter}`,
        year,
        quarter,
      });
    }

    const order: Record<CalendarItemStatus, number> = {
      overdue: 0,
      due_soon: 1,
      upcoming: 2,
      filed: 3,
    };
    return items.sort((a, b) => order[a.status] - order[b.status] || a.deadline.localeCompare(b.deadline));
  },
};
