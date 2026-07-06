import { Brackets } from 'typeorm';
import { AppDataSource } from '../../database/data-source';
import { Invoice, InvoiceStatus } from './invoice.entity';
import { InvoiceItem } from './invoice-item.entity';
import { InvoiceLog, InvoiceLogAction } from './invoice-log.entity';
import { Customer } from '../customers/customer.entity';
import { Product } from '../products/product.entity';
import { HttpError } from '../../common/errors/HttpError';
import { CreateInvoiceInput, ListInvoiceQuery, UpdateInvoiceInput } from './invoice.dto';
import { buildPage } from '../../common/utils/pagination';
import { calculateInvoiceTotals } from './invoice-calculator';
import { generateInvoiceNumber } from './invoice-numbering';
import { quotaService } from '../subscriptions/quota.service';

const invRepo = () => AppDataSource.getRepository(Invoice);

export const invoiceService = {
  async list(companyId: string, q: ListInvoiceQuery) {
    const qb = invRepo()
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.customer', 'customer')
      .leftJoinAndSelect('i.branch', 'branch')
      .where('i.companyId = :companyId', { companyId });

    if (q.status) qb.andWhere('i.status = :status', { status: q.status });
    if (q.type) qb.andWhere('i.type = :type', { type: q.type });
    if (q.customerId) qb.andWhere('i.customerId = :customerId', { customerId: q.customerId });
    if (q.branchId) qb.andWhere('i.branchId = :branchId', { branchId: q.branchId });
    if (q.from) qb.andWhere('i.issueDate >= :from', { from: q.from });
    if (q.to) qb.andWhere('i.issueDate <= :to', { to: q.to });

    if (q.search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('i.invoiceNumber LIKE :s', { s: `%${q.search}%` })
            .orWhere('i.etaUuid LIKE :s', { s: `%${q.search}%` })
            .orWhere('customer.name LIKE :s', { s: `%${q.search}%` });
        }),
      );
    }

    const allowed = ['createdAt', 'issueDate', 'total', 'invoiceNumber', 'status'];
    const sortBy = allowed.includes(q.sortBy ?? '') ? q.sortBy! : 'issueDate';
    qb.orderBy(`i.${sortBy}`, q.sortDir);

    const [items, total] = await qb
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getManyAndCount();

    return buildPage(items, total, q as any);
  },

  async getById(companyId: string, id: string) {
    const inv = await invRepo().findOne({
      where: { id, companyId },
      relations: ['customer', 'branch', 'items', 'items.product', 'payments', 'logs'],
    });
    if (!inv) throw HttpError.notFound('Invoice not found');
    return inv;
  },

  async create(companyId: string, userId: string, input: CreateInvoiceInput): Promise<Invoice> {
    return AppDataSource.transaction(async (manager) => {
      // Subscription gate + quota check. Throws 402 if the tenant has no
      // active subscription or has hit their monthly invoice quota.
      await quotaService.assertCanCreateInvoice(companyId, manager);

      const customer = await manager.getRepository(Customer).findOne({
        where: { id: input.customerId, companyId },
      });
      if (!customer) throw HttpError.notFound('Customer not found');

      // Resolve product info onto lines (when productId provided)
      const productIds = input.items.map((i) => i.productId).filter(Boolean) as string[];
      const products = productIds.length
        ? await manager.getRepository(Product).find({
            where: productIds.map((id) => ({ id, companyId })),
          })
        : [];
      const productMap = new Map(products.map((p) => [p.id, p]));

      const enriched = input.items.map((it) => {
        if (it.productId) {
          const p = productMap.get(it.productId);
          if (!p) throw HttpError.badRequest(`Product ${it.productId} not found`);
          return {
            ...it,
            description: it.description || p.name,
            etaItemCode: it.etaItemCode || p.etaItemCode,
            etaCodeType: it.etaCodeType || p.etaCodeType,
            unitType: it.unitType || p.unitType,
            taxRate: it.taxRate ?? p.taxRate,
          };
        }
        return it;
      });

      const totals = calculateInvoiceTotals(enriched);

      const invoiceNumber = await generateInvoiceNumber(
        manager,
        companyId,
        input.issueDate,
        input.type,
      );

      const invoice = manager.getRepository(Invoice).create({
        companyId,
        customerId: input.customerId,
        branchId: input.branchId ?? null,
        createdById: userId,
        type: input.type,
        status: InvoiceStatus.DRAFT,
        invoiceNumber,
        issueDate: input.issueDate,
        dueDate: input.dueDate ?? null,
        currency: input.currency ?? 'EGP',
        notes: input.notes,
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        totalTax: totals.totalTax,
        total: totals.total,
      });
      await manager.getRepository(Invoice).save(invoice);

      const items = totals.lines.map((l) =>
        manager.getRepository(InvoiceItem).create({
          invoiceId: invoice.id,
          productId: l.productId ?? undefined,
          description: l.description,
          etaItemCode: l.etaItemCode,
          etaCodeType: l.etaCodeType,
          unitType: l.unitType,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          taxRate: l.taxRate,
          taxAmount: l.taxAmount,
          lineTotal: l.lineTotal,
        }),
      );
      await manager.getRepository(InvoiceItem).save(items);

      await manager.getRepository(InvoiceLog).save(
        manager.getRepository(InvoiceLog).create({
          invoiceId: invoice.id,
          userId,
          action: InvoiceLogAction.CREATED,
          meta: { invoiceNumber: invoice.invoiceNumber, total: invoice.total },
        }),
      );

      await quotaService.incrementInvoiceUsage(companyId, manager);

      const saved = await manager.getRepository(Invoice).findOneOrFail({
        where: { id: invoice.id },
        relations: ['customer', 'branch', 'items'],
      });
      return saved;
    });
  },

  async update(companyId: string, userId: string, id: string, input: UpdateInvoiceInput) {
    return AppDataSource.transaction(async (manager) => {
      const inv = await manager.getRepository(Invoice).findOne({
        where: { id, companyId },
        relations: ['items'],
      });
      if (!inv) throw HttpError.notFound('Invoice not found');
      if (inv.status !== InvoiceStatus.DRAFT) {
        throw HttpError.badRequest('Only draft invoices can be edited');
      }

      if (input.items) {
        await manager.getRepository(InvoiceItem).delete({ invoiceId: inv.id });
        const totals = calculateInvoiceTotals(input.items);
        const items = totals.lines.map((l) =>
          manager.getRepository(InvoiceItem).create({
            invoiceId: inv.id,
            productId: l.productId ?? undefined,
            description: l.description,
            etaItemCode: l.etaItemCode,
            etaCodeType: l.etaCodeType,
            unitType: l.unitType,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
            taxRate: l.taxRate,
            taxAmount: l.taxAmount,
            lineTotal: l.lineTotal,
          }),
        );
        await manager.getRepository(InvoiceItem).save(items);

        inv.subtotal = totals.subtotal;
        inv.totalDiscount = totals.totalDiscount;
        inv.totalTax = totals.totalTax;
        inv.total = totals.total;
      }

      if (input.customerId) inv.customerId = input.customerId;
      if (input.branchId !== undefined) inv.branchId = input.branchId;
      if (input.type) inv.type = input.type;
      if (input.issueDate) inv.issueDate = input.issueDate;
      if (input.dueDate !== undefined) inv.dueDate = input.dueDate;
      if (input.currency) inv.currency = input.currency;
      if (input.notes !== undefined) inv.notes = input.notes;

      await manager.getRepository(Invoice).save(inv);

      await manager.getRepository(InvoiceLog).save(
        manager.getRepository(InvoiceLog).create({
          invoiceId: inv.id,
          userId,
          action: InvoiceLogAction.UPDATED,
        }),
      );

      return manager.getRepository(Invoice).findOneOrFail({
        where: { id: inv.id },
        relations: ['customer', 'branch', 'items'],
      });
    });
  },

  async changeStatus(
    companyId: string,
    userId: string,
    id: string,
    status: InvoiceStatus,
  ): Promise<Invoice> {
    const inv = await invRepo().findOne({ where: { id, companyId } });
    if (!inv) throw HttpError.notFound('Invoice not found');
    const prev = inv.status;
    inv.status = status;
    await invRepo().save(inv);
    const logRepo = AppDataSource.getRepository(InvoiceLog);
    await logRepo.save(
      logRepo.create({
        invoiceId: inv.id,
        userId,
        action: InvoiceLogAction.STATUS_CHANGED,
        meta: { from: prev, to: status },
      }),
    );
    return inv;
  },

  async remove(companyId: string, id: string) {
    const inv = await invRepo().findOne({ where: { id, companyId } });
    if (!inv) throw HttpError.notFound('Invoice not found');
    if (inv.status !== InvoiceStatus.DRAFT) {
      throw HttpError.badRequest('Only draft invoices can be deleted');
    }
    await invRepo().softRemove(inv);
    return { id };
  },
};
