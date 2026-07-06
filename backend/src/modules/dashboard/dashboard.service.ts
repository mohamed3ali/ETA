import { AppDataSource } from '../../database/data-source';
import { Invoice, InvoiceStatus } from '../invoices/invoice.entity';
import { Company } from '../companies/company.entity';
import { CompanyMembership } from '../companies/company-membership.entity';
import { VatReturn } from '../tax/vat-return.entity';
import { Form41Return } from '../tax/form41-return.entity';
import { TaxFilingStatus } from '../tax/tax.utils';
import dayjs from 'dayjs';

export const dashboardService = {
  async getMetrics(companyId: string) {
    const repo = AppDataSource.getRepository(Invoice);

    const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
    const endOfMonth = dayjs().endOf('month').format('YYYY-MM-DD');

    const [
      totalInvoices,
      acceptedCount,
      rejectedCount,
      paidCount,
      overdueCount,
      monthAgg,
      ytdAgg,
    ] = await Promise.all([
      repo.count({ where: { companyId } }),
      repo.count({ where: { companyId, status: InvoiceStatus.ACCEPTED } }),
      repo.count({ where: { companyId, status: InvoiceStatus.REJECTED } }),
      repo.count({ where: { companyId, status: InvoiceStatus.PAID } }),
      repo.count({ where: { companyId, status: InvoiceStatus.OVERDUE } }),
      repo
        .createQueryBuilder('i')
        .select('SUM(i.total)', 'revenue')
        .addSelect('SUM(i.totalTax)', 'vat')
        .where('i.companyId = :companyId', { companyId })
        .andWhere('i.issueDate BETWEEN :s AND :e', { s: startOfMonth, e: endOfMonth })
        .andWhere('i.status IN (:...statuses)', {
          statuses: [InvoiceStatus.ACCEPTED, InvoiceStatus.PAID, InvoiceStatus.SUBMITTED],
        })
        .getRawOne<{ revenue: string | null; vat: string | null }>(),
      repo
        .createQueryBuilder('i')
        .select('SUM(i.total)', 'revenue')
        .addSelect('SUM(i.totalTax)', 'vat')
        .where('i.companyId = :companyId', { companyId })
        .andWhere('YEAR(i.issueDate) = YEAR(CURRENT_DATE())')
        .getRawOne<{ revenue: string | null; vat: string | null }>(),
    ]);

    return {
      counts: {
        total: totalInvoices,
        accepted: acceptedCount,
        rejected: rejectedCount,
        paid: paidCount,
        overdue: overdueCount,
      },
      thisMonth: {
        revenue: Number(monthAgg?.revenue ?? 0),
        vat: Number(monthAgg?.vat ?? 0),
      },
      yearToDate: {
        revenue: Number(ytdAgg?.revenue ?? 0),
        vat: Number(ytdAgg?.vat ?? 0),
      },
    };
  },

  async getRevenueByMonth(companyId: string, months = 12) {
    const rows = await AppDataSource.getRepository(Invoice)
      .createQueryBuilder('i')
      .select("DATE_FORMAT(i.issueDate, '%Y-%m')", 'month')
      .addSelect('SUM(i.total)', 'revenue')
      .addSelect('SUM(i.totalTax)', 'vat')
      .addSelect('COUNT(*)', 'count')
      .where('i.companyId = :companyId', { companyId })
      .andWhere('i.issueDate >= :since', {
        since: dayjs().subtract(months - 1, 'month').startOf('month').format('YYYY-MM-DD'),
      })
      .groupBy("DATE_FORMAT(i.issueDate, '%Y-%m')")
      .orderBy('month', 'ASC')
      .getRawMany<{ month: string; revenue: string; vat: string; count: string }>();

    return rows.map((r) => ({
      month: r.month,
      revenue: Number(r.revenue),
      vat: Number(r.vat),
      count: Number(r.count),
    }));
  },

  async getTopCustomers(companyId: string, limit = 5) {
    const rows = await AppDataSource.getRepository(Invoice)
      .createQueryBuilder('i')
      .leftJoin('i.customer', 'customer')
      .select('customer.id', 'customerId')
      .addSelect('customer.name', 'customerName')
      .addSelect('SUM(i.total)', 'revenue')
      .addSelect('COUNT(*)', 'invoices')
      .where('i.companyId = :companyId', { companyId })
      .andWhere('i.status != :rejected', { rejected: InvoiceStatus.REJECTED })
      .groupBy('customer.id')
      .addGroupBy('customer.name')
      .orderBy('revenue', 'DESC')
      .limit(limit)
      .getRawMany<{ customerId: string; customerName: string; revenue: string; invoices: string }>();

    return rows.map((r) => ({
      customerId: r.customerId,
      customerName: r.customerName,
      revenue: Number(r.revenue),
      invoices: Number(r.invoices),
    }));
  },

  async getRecentInvoices(companyId: string, limit = 10) {
    return AppDataSource.getRepository(Invoice).find({
      where: { companyId },
      relations: ['customer'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  },

  /**
   * Firm-wide rollup across every company the user has access to. Intended
   * for accounting offices managing multiple clients — surfaces per-company
   * KPIs in a single roll so the operator doesn't need to swap tenants.
   *
   * Returns one row per accessible company with:
   *   - revenue / VAT for the current month (issued, non-rejected)
   *   - counts of overdue invoices and pending submissions
   *   - latest VAT-return and Form-41 status for the current period
   *   - role the user holds in that company
   *
   * Heavy joins are avoided — we issue parallel scoped queries per company.
   * Memberships are capped at 200 (more than any realistic firm) to keep
   * latency predictable.
   */
  async getFirmOverview(userId: string) {
    const memberships = await AppDataSource.getRepository(CompanyMembership).find({
      where: { userId },
      relations: ['company'],
      take: 200,
    });
    if (memberships.length === 0) {
      return { companies: [], totals: emptyTotals() };
    }

    const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
    const endOfMonth = dayjs().endOf('month').format('YYYY-MM-DD');
    const today = dayjs().format('YYYY-MM-DD');

    const invRepo = AppDataSource.getRepository(Invoice);
    const vatRepo = AppDataSource.getRepository(VatReturn);
    const form41Repo = AppDataSource.getRepository(Form41Return);

    const year = dayjs().year();
    const month = dayjs().month() + 1;
    const quarter = `Q${Math.floor((month - 1) / 3) + 1}`;

    const rows = await Promise.all(
      memberships.map(async (m) => {
        const company = m.company as Company;
        const companyId = company.id;

        const [
          monthAgg,
          overdueCount,
          submittedCount,
          rejectedCount,
          vatRet,
          form41,
        ] = await Promise.all([
          invRepo
            .createQueryBuilder('i')
            .select('SUM(i.total)', 'revenue')
            .addSelect('SUM(i.totalTax)', 'vat')
            .addSelect('COUNT(*)', 'count')
            .where('i.companyId = :companyId', { companyId })
            .andWhere('i.issueDate BETWEEN :s AND :e', {
              s: startOfMonth,
              e: endOfMonth,
            })
            .andWhere('i.status IN (:...statuses)', {
              statuses: [
                InvoiceStatus.ACCEPTED,
                InvoiceStatus.PAID,
                InvoiceStatus.SUBMITTED,
              ],
            })
            .getRawOne<{ revenue: string | null; vat: string | null; count: string }>(),
          invRepo.count({
            where: [
              { companyId, status: InvoiceStatus.OVERDUE },
              // Treat unpaid past dueDate as overdue even if status not flipped.
              // We approximate here with a raw query below.
            ],
          }),
          invRepo.count({ where: { companyId, status: InvoiceStatus.SUBMITTED } }),
          invRepo.count({ where: { companyId, status: InvoiceStatus.REJECTED } }),
          vatRepo.findOne({ where: { companyId, year, month } }),
          form41Repo.findOne({ where: { companyId, year, quarter } }),
        ]);

        // Approximate "past-due but unpaid" — covers cases where the worker
        // hasn't yet flipped statuses to OVERDUE.
        const pastDueExtra = await invRepo
          .createQueryBuilder('i')
          .where('i.companyId = :companyId', { companyId })
          .andWhere('i.dueDate IS NOT NULL')
          .andWhere('i.dueDate < :today', { today })
          .andWhere('i.amountPaid < i.total')
          .andWhere('i.status NOT IN (:...closed)', {
            closed: [
              InvoiceStatus.CANCELLED,
              InvoiceStatus.DRAFT,
              InvoiceStatus.OVERDUE,
            ],
          })
          .getCount();

        return {
          companyId,
          companyName: company.name,
          taxRegistrationNumber: company.taxRegistrationNumber,
          status: company.status,
          role: m.role,
          monthRevenue: Number(monthAgg?.revenue ?? 0),
          monthVat: Number(monthAgg?.vat ?? 0),
          monthInvoices: Number(monthAgg?.count ?? 0),
          overdueCount: Number(overdueCount) + Number(pastDueExtra),
          submittedCount: Number(submittedCount),
          rejectedCount: Number(rejectedCount),
          vatStatus: vatRet?.status ?? TaxFilingStatus.DRAFT,
          vatNet: Number(vatRet?.netVat ?? 0),
          form41Status: form41?.status ?? TaxFilingStatus.DRAFT,
        };
      }),
    );

    const totals = rows.reduce<ReturnType<typeof emptyTotals>>(
      (acc, r) => {
        acc.monthRevenue += r.monthRevenue;
        acc.monthVat += r.monthVat;
        acc.monthInvoices += r.monthInvoices;
        acc.overdueCount += r.overdueCount;
        acc.submittedCount += r.submittedCount;
        acc.rejectedCount += r.rejectedCount;
        if (r.vatStatus !== TaxFilingStatus.FILED) acc.vatNotFiled += 1;
        if (r.form41Status !== TaxFilingStatus.FILED) acc.form41NotFiled += 1;
        return acc;
      },
      emptyTotals(),
    );
    totals.companies = rows.length;

    return {
      period: { year, month, quarter, from: startOfMonth, to: endOfMonth },
      companies: rows.sort((a, b) => b.monthRevenue - a.monthRevenue),
      totals,
    };
  },
};

function emptyTotals() {
  return {
    companies: 0,
    monthRevenue: 0,
    monthVat: 0,
    monthInvoices: 0,
    overdueCount: 0,
    submittedCount: 0,
    rejectedCount: 0,
    vatNotFiled: 0,
    form41NotFiled: 0,
  };
}
