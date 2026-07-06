import dayjs from 'dayjs';
import { AppDataSource } from '../../database/data-source';
import { VatReturn } from './vat-return.entity';
import { VatPurchaseManual } from './vat-purchase-manual.entity';
import { Form41Return } from './form41-return.entity';
import { WithholdingEntry } from './withholding-entry.entity';
import { TaxFilingStatus, calcWithholding, WITHHOLDING_RATES } from './tax.utils';

export async function seedVatMockIfEmpty(companyId: string, vatReturn: VatReturn) {
  const purchaseRepo = AppDataSource.getRepository(VatPurchaseManual);
  const count = await purchaseRepo.count({ where: { companyId, vatReturnId: vatReturn.id } });
  if (count > 0) return;

  const samples = [
    {
      supplierName: 'شركة التوريدات الحديثة',
      supplierTaxId: '123-456-789',
      invoiceNumber: 'PUR-2025-0142',
      invoiceDate: dayjs().subtract(12, 'day').format('YYYY-MM-DD'),
      netAmount: 45000,
      vatAmount: 6300,
      grossAmount: 51300,
    },
    {
      supplierName: 'مؤسسة النيل للتعبئة',
      supplierTaxId: '987-654-321',
      invoiceNumber: 'PUR-2025-0098',
      invoiceDate: dayjs().subtract(20, 'day').format('YYYY-MM-DD'),
      netAmount: 12000,
      vatAmount: 1680,
      grossAmount: 13680,
    },
  ];

  for (const s of samples) {
    await purchaseRepo.save(
      purchaseRepo.create({ companyId, vatReturnId: vatReturn.id, ...s }),
    );
  }
}

export async function seedForm41MockIfEmpty(companyId: string, form41: Form41Return) {
  const entryRepo = AppDataSource.getRepository(WithholdingEntry);
  const count = await entryRepo.count({ where: { companyId, form41ReturnId: form41.id } });
  if (count > 0) return;

  const samples = [
    {
      payeeName: 'م. أحمد محمود — استشارات',
      payeeId: '29801011234567',
      paymentType: 'professional_services',
      grossAmount: 85000,
      paymentDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    },
    {
      payeeName: 'شركة البناء المتحد',
      payeeId: '456789123',
      paymentType: 'contractors',
      grossAmount: 250000,
      paymentDate: dayjs().subtract(45, 'day').format('YYYY-MM-DD'),
    },
    {
      payeeName: 'دار النشر العربية',
      payeeId: '789123456',
      paymentType: 'royalties',
      grossAmount: 32000,
      paymentDate: dayjs().subtract(15, 'day').format('YYYY-MM-DD'),
    },
  ];

  for (const s of samples) {
    const rate = WITHHOLDING_RATES[s.paymentType]?.rate ?? 0.05;
    await entryRepo.save(
      entryRepo.create({
        companyId,
        form41ReturnId: form41.id,
        ...s,
        withholdingRate: rate,
        withheldAmount: calcWithholding(s.grossAmount, s.paymentType),
      }),
    );
  }

  if (form41.status === TaxFilingStatus.DRAFT) {
    form41.status = TaxFilingStatus.READY_TO_FILE;
    await AppDataSource.getRepository(Form41Return).save(form41);
  }
}
