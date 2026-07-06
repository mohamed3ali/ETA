import { AppDataSource } from '../../database/data-source';
import { Invoice } from './invoice.entity';
import { Company } from '../companies/company.entity';
import { HttpError } from '../../common/errors/HttpError';
import { etaService } from '../eta/eta.service';
import { logger } from '../../config/logger';
import { renderEtaStyleInvoicePdf } from './invoice-pdf-eta-layout';

const isMockEtaUuid = (uuid?: string | null) =>
  !!uuid && (uuid.startsWith('MOCK-') || uuid.startsWith('mock-'));

export const invoicePdfService = {
  /**
   * Returns the official ETA PDF when the invoice was accepted by ETA and
   * credentials are configured; otherwise renders the bilingual ETA-style layout.
   */
  async render(companyId: string, invoiceId: string): Promise<Buffer> {
    const invoice = await AppDataSource.getRepository(Invoice).findOne({
      where: { id: invoiceId, companyId },
      relations: ['customer', 'items', 'branch'],
    });
    if (!invoice) throw HttpError.notFound('Invoice not found');

    const company = await AppDataSource.getRepository(Company).findOneOrFail({
      where: { id: companyId },
    });

    const canUseOfficialPrintout =
      !!invoice.etaUuid &&
      !isMockEtaUuid(invoice.etaUuid) &&
      !!company.etaClientId &&
      !!company.etaClientSecret;

    if (canUseOfficialPrintout) {
      try {
        return await etaService.getDocumentPrintout(companyId, invoice.etaUuid!);
      } catch (err) {
        logger.warn(
          { err, invoiceId, etaUuid: invoice.etaUuid },
          'ETA official printout unavailable; using local ETA-style template',
        );
      }
    }

    return renderEtaStyleInvoicePdf(invoice, company);
  },
};
