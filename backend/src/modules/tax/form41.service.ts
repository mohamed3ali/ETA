import { AppDataSource } from '../../database/data-source';
import { HttpError } from '../../common/errors/HttpError';
import { Form41Return } from './form41-return.entity';
import { WithholdingEntry } from './withholding-entry.entity';
import {
  TaxFilingStatus,
  calcWithholding,
  WITHHOLDING_RATES,
  type Quarter,
} from './tax.utils';
import { seedForm41MockIfEmpty } from './tax.seed';

const form41Repo = () => AppDataSource.getRepository(Form41Return);
const entryRepo = () => AppDataSource.getRepository(WithholdingEntry);

async function getOrCreateForm41(companyId: string, year: number, quarter: string) {
  let row = await form41Repo().findOne({ where: { companyId, year, quarter } });
  if (!row) {
    row = await form41Repo().save(
      form41Repo().create({ companyId, year, quarter }),
    );
  }
  await seedForm41MockIfEmpty(companyId, row);
  return form41Repo().findOneOrFail({ where: { id: row.id, companyId } });
}

function applyWithholding(paymentType: string, grossAmount: number) {
  const rate = WITHHOLDING_RATES[paymentType]?.rate ?? 0.05;
  return {
    withholdingRate: rate,
    withheldAmount: calcWithholding(grossAmount, paymentType),
  };
}

export const form41Service = {
  async getForm(companyId: string, year: number, quarter: string) {
    const form41 = await getOrCreateForm41(companyId, year, quarter);
    const entries = await entryRepo().find({
      where: { companyId, form41ReturnId: form41.id },
      order: { paymentDate: 'DESC', createdAt: 'DESC' },
    });
    const totalGross = entries.reduce((s, e) => s + Number(e.grossAmount), 0);
    const totalWithheld = entries.reduce((s, e) => s + Number(e.withheldAmount), 0);
    return {
      form41,
      entries,
      paymentTypes: WITHHOLDING_RATES,
      summary: {
        totalGross,
        totalWithheld,
        entriesCount: entries.length,
      },
    };
  },

  async createEntry(
    companyId: string,
    body: {
      year: number;
      quarter: Quarter;
      payeeName: string;
      payeeId?: string;
      paymentType: string;
      grossAmount: number;
      paymentDate?: string;
    },
  ) {
    const form41 = await getOrCreateForm41(companyId, body.year, body.quarter);
    if (form41.status === TaxFilingStatus.FILED) {
      throw HttpError.badRequest('لا يمكن تعديل نموذج تم تقديمه');
    }
    const wh = applyWithholding(body.paymentType, body.grossAmount);
    return entryRepo().save(
      entryRepo().create({
        companyId,
        form41ReturnId: form41.id,
        payeeName: body.payeeName,
        payeeId: body.payeeId ?? null,
        paymentType: body.paymentType,
        grossAmount: body.grossAmount,
        paymentDate: body.paymentDate ?? null,
        ...wh,
      }),
    );
  },

  async updateEntry(
    companyId: string,
    id: string,
    body: Partial<{
      payeeName: string;
      payeeId?: string;
      paymentType: string;
      grossAmount: number;
      paymentDate?: string;
    }>,
  ) {
    const entry = await entryRepo().findOne({ where: { id, companyId } });
    if (!entry) throw HttpError.notFound('البند غير موجود');
    const form41 = await form41Repo().findOne({
      where: { id: entry.form41ReturnId, companyId },
    });
    if (!form41) throw HttpError.notFound('نموذج 41 غير موجود');
    if (form41.status === TaxFilingStatus.FILED) {
      throw HttpError.badRequest('لا يمكن تعديل نموذج تم تقديمه');
    }
    Object.assign(entry, body);
    if (body.paymentType != null || body.grossAmount != null) {
      const wh = applyWithholding(entry.paymentType, Number(entry.grossAmount));
      entry.withholdingRate = wh.withholdingRate;
      entry.withheldAmount = wh.withheldAmount;
    }
    return entryRepo().save(entry);
  },

  async deleteEntry(companyId: string, id: string) {
    const entry = await entryRepo().findOne({ where: { id, companyId } });
    if (!entry) throw HttpError.notFound('البند غير موجود');
    const form41 = await form41Repo().findOne({
      where: { id: entry.form41ReturnId, companyId },
    });
    if (form41?.status === TaxFilingStatus.FILED) {
      throw HttpError.badRequest('لا يمكن تعديل نموذج تم تقديمه');
    }
    await entryRepo().softRemove(entry);
    return { ok: true };
  },

  async updateStatus(
    companyId: string,
    year: number,
    quarter: string,
    status: TaxFilingStatus,
  ) {
    const row = await getOrCreateForm41(companyId, year, quarter);
    row.status = status;
    if (status === TaxFilingStatus.FILED) row.filedAt = new Date();
    return form41Repo().save(row);
  },

  async markFiled(companyId: string, year: number, quarter: string) {
    return this.updateStatus(companyId, year, quarter, TaxFilingStatus.FILED);
  },
};
