import { Brackets, DeepPartial } from 'typeorm';
import dayjs from 'dayjs';
import { AppDataSource } from '../../database/data-source';
import { Company } from '../companies/company.entity';
import { EtaPortalDocument, EtaPortalDirection } from './eta-portal-document.entity';
import { etaTokenService } from './eta-token.service';
import { EtaSyncLog, EtaSyncDirection, EtaSyncStatus } from './eta-sync-log.entity';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { HttpError } from '../../common/errors/HttpError';
import {
  EtaDocumentSummary,
  EtaSearchDocumentsResponse,
} from './eta-portal.types';
import { buildPage, PaginationQuery } from '../../common/utils/pagination';

const apiBaseUrl = (envName: 'preprod' | 'production') =>
  envName === 'production'
    ? 'https://api.invoicing.eta.gov.eg'
    : env.ETA_BASE_URL;

const repo = () => AppDataSource.getRepository(EtaPortalDocument);
const companyRepo = () => AppDataSource.getRepository(Company);
const syncLogRepo = () => AppDataSource.getRepository(EtaSyncLog);

export interface SyncOptions {
  direction: EtaPortalDirection;
  issueDateFrom: string; // YYYY-MM-DD
  issueDateTo: string; // YYYY-MM-DD
  /** Stop after this many pages (safety). */
  maxPages?: number;
  pageSize?: number;
}

export interface SyncResult {
  fetched: number;
  upserted: number;
  pages: number;
  mock: boolean;
  message?: string;
}

export interface ListQuery extends PaginationQuery {
  direction?: EtaPortalDirection;
  status?: string;
  from?: string;
  to?: string;
}

const mapToEntity = (
  d: EtaDocumentSummary,
  companyId: string,
  direction: EtaPortalDirection,
): DeepPartial<EtaPortalDocument> => ({
  companyId,
  uuid: d.uuid,
  direction,
  submissionUUID: d.submissionUUID,
  longId: d.longId,
  publicUrl: d.publicUrl,
  internalId: d.internalId,
  typeName: d.typeName,
  typeVersionName: d.typeVersionName,
  issuerId: d.issuerId,
  issuerName: d.issuerName,
  issuerType: d.issuerType,
  receiverId: d.receiverId,
  receiverName: d.receiverName,
  receiverType: d.receiverType,
  dateTimeIssued: new Date(d.dateTimeIssued),
  dateTimeReceived: d.dateTimeReceived ? new Date(d.dateTimeReceived) : undefined,
  totalSales: String(d.totalSales ?? 0),
  totalDiscount: String(d.totalDiscount ?? 0),
  netAmount: String(d.netAmount ?? 0),
  total: String(d.total ?? 0),
  status: d.status,
  documentStatusReason: d.documentStatusReason,
  rawPayload: d as unknown as Record<string, unknown>,
});

const buildMockBatch = (
  companyTaxId: string,
  direction: EtaPortalDirection,
  from: string,
  to: string,
  count: number,
): EtaDocumentSummary[] => {
  const start = dayjs(from);
  const end = dayjs(to);
  const totalDays = Math.max(1, end.diff(start, 'day'));
  const docs: EtaDocumentSummary[] = [];
  for (let i = 0; i < count; i += 1) {
    const dayOffset = Math.floor((i / count) * totalDays);
    const issued = start.add(dayOffset, 'day').hour(10 + (i % 8));
    const isSent = direction === 'Sent';
    const net = Math.round((500 + i * 137.5) * 100) / 100;
    const vat = Math.round(net * 0.14 * 100) / 100;
    const total = Math.round((net + vat) * 100) / 100;
    docs.push({
      uuid: `MOCK-${direction.toUpperCase()}-${i.toString().padStart(4, '0')}-${Date.now().toString(36)}`,
      submissionUUID: `MOCK-SUB-${i}`,
      longId: `MOCK-LONG-${i}`,
      internalId: `INV-${i.toString().padStart(5, '0')}`,
      typeName: 'I',
      typeVersionName: '1.0',
      issuerId: isSent ? companyTaxId : `EX${String(100000 + i).slice(-9)}`,
      issuerName: isSent ? 'My Company' : `Supplier ${i + 1}`,
      issuerType: 'B',
      receiverId: isSent ? `EX${String(200000 + i).slice(-9)}` : companyTaxId,
      receiverName: isSent ? `Customer ${i + 1}` : 'My Company',
      receiverType: 'B',
      dateTimeIssued: issued.toISOString(),
      dateTimeReceived: issued.add(5, 'minute').toISOString(),
      totalSales: net,
      totalDiscount: 0,
      netAmount: net,
      total,
      status: i % 11 === 0 ? 'Cancelled' : i % 7 === 0 ? 'Rejected' : 'Valid',
    });
  }
  return docs;
};

export const etaPortalService = {
  /**
   * Pull documents from the ETA portal for a given direction and date range
   * and upsert them into our local cache. If ETA credentials are missing we
   * fall back to a deterministic mock so the full flow is testable end-to-end.
   */
  async sync(companyId: string, opts: SyncOptions): Promise<SyncResult> {
    const company = await companyRepo().findOneOrFail({ where: { id: companyId } });
    const useMock = !company.etaClientId || !company.etaClientSecret;
    const maxPages = opts.maxPages ?? 20;
    const pageSize = Math.min(100, Math.max(10, opts.pageSize ?? 50));

    const syncLog = syncLogRepo().create({
      companyId,
      direction: EtaSyncDirection.INBOUND,
      action: `portal:${opts.direction.toLowerCase()}`,
      status: EtaSyncStatus.PENDING,
      request: { ...opts },
    });
    await syncLogRepo().save(syncLog);

    let pagesFetched = 0;
    let totalFetched = 0;
    let totalUpserted = 0;
    let continuationToken: string | undefined;

    try {
      if (useMock) {
        logger.warn({ companyId }, 'ETA portal sync running in MOCK mode');
        const batch = buildMockBatch(
          company.taxRegistrationNumber,
          opts.direction,
          opts.issueDateFrom,
          opts.issueDateTo,
          25,
        );
        totalFetched = batch.length;
        totalUpserted = await upsertBatch(batch, companyId, opts.direction);
        pagesFetched = 1;
      } else {
        const token = await etaTokenService.getToken(companyId, {
          clientId: company.etaClientId!,
          clientSecret: company.etaClientSecret!,
          environment: company.etaEnvironment,
        });

        while (pagesFetched < maxPages) {
          const url = new URL(`${apiBaseUrl(company.etaEnvironment)}/api/v1.0/documents/search`);
          url.searchParams.set('pageSize', String(pageSize));
          url.searchParams.set('submissionDateFrom', `${opts.issueDateFrom}T00:00:00Z`);
          url.searchParams.set('submissionDateTo', `${opts.issueDateTo}T23:59:59Z`);
          url.searchParams.set('direction', opts.direction);
          if (continuationToken) {
            url.searchParams.set('continuationToken', continuationToken);
          }

          const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) {
            throw new Error(`ETA search failed: ${res.status} ${await res.text()}`);
          }
          const json = (await res.json()) as EtaSearchDocumentsResponse;
          const batch = json.result ?? [];
          totalFetched += batch.length;
          totalUpserted += await upsertBatch(batch, companyId, opts.direction);
          pagesFetched += 1;

          continuationToken = json.metadata?.continuationToken;
          if (!continuationToken || batch.length === 0) break;
        }
      }

      syncLog.status = EtaSyncStatus.SUCCESS;
      syncLog.response = {
        fetched: totalFetched,
        upserted: totalUpserted,
        pages: pagesFetched,
        mock: useMock,
      };
      await syncLogRepo().save(syncLog);

      return {
        fetched: totalFetched,
        upserted: totalUpserted,
        pages: pagesFetched,
        mock: useMock,
        message: useMock ? 'Synced from mock data — set ETA credentials to pull live.' : undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, companyId }, 'ETA portal sync failed');
      syncLog.status = EtaSyncStatus.FAILED;
      syncLog.errorMessage = msg;
      await syncLogRepo().save(syncLog);
      throw HttpError.badRequest(`ETA sync failed: ${msg}`);
    }
  },

  async list(companyId: string, q: ListQuery) {
    const qb = repo()
      .createQueryBuilder('d')
      .where('d.companyId = :companyId', { companyId });

    if (q.direction) qb.andWhere('d.direction = :direction', { direction: q.direction });
    if (q.status) qb.andWhere('d.status = :status', { status: q.status });
    if (q.from) qb.andWhere('d.dateTimeIssued >= :from', { from: `${q.from} 00:00:00` });
    if (q.to) qb.andWhere('d.dateTimeIssued <= :to', { to: `${q.to} 23:59:59` });

    if (q.search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('d.internalId LIKE :s', { s: `%${q.search}%` })
            .orWhere('d.uuid LIKE :s', { s: `%${q.search}%` })
            .orWhere('d.issuerName LIKE :s', { s: `%${q.search}%` })
            .orWhere('d.receiverName LIKE :s', { s: `%${q.search}%` });
        }),
      );
    }

    const allowed = ['dateTimeIssued', 'total', 'createdAt', 'internalId', 'status'];
    const sortBy = allowed.includes(q.sortBy ?? '') ? q.sortBy! : 'dateTimeIssued';
    qb.orderBy(`d.${sortBy}`, q.sortDir);

    const [items, total] = await qb
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getManyAndCount();

    return buildPage(items, total, q);
  },

  async getOne(companyId: string, uuid: string) {
    const doc = await repo().findOne({ where: { companyId, uuid } });
    if (!doc) throw HttpError.notFound('Document not found');
    return doc;
  },

  async summary(companyId: string, from: string, to: string) {
    const rows = await repo()
      .createQueryBuilder('d')
      .select('d.direction', 'direction')
      .addSelect('d.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(d.total), 0)', 'totalAmount')
      .where('d.companyId = :companyId', { companyId })
      .andWhere('d.dateTimeIssued BETWEEN :from AND :to', {
        from: `${from} 00:00:00`,
        to: `${to} 23:59:59`,
      })
      .groupBy('d.direction')
      .addGroupBy('d.status')
      .getRawMany<{ direction: string; status: string; count: string; totalAmount: string }>();

    return rows.map((r) => ({
      direction: r.direction,
      status: r.status,
      count: Number(r.count),
      totalAmount: Number(r.totalAmount),
    }));
  },
};

async function upsertBatch(
  batch: EtaDocumentSummary[],
  companyId: string,
  direction: EtaPortalDirection,
): Promise<number> {
  if (batch.length === 0) return 0;
  const rows = batch.map((d) => mapToEntity(d, companyId, direction));
  // ON DUPLICATE KEY UPDATE on (companyId, uuid).
  // Cast to `any` because TypeORM's QueryDeepPartialEntity insists relations
  // be referenced as IDs or nested partials, while we only ever set the FK
  // column (`companyId`) — never the `company` relation object.
  const result = await repo()
    .createQueryBuilder()
    .insert()
    .into(EtaPortalDocument)
    .values(rows as any)
    .orUpdate(
      [
        'status',
        'documentStatusReason',
        'totalSales',
        'totalDiscount',
        'netAmount',
        'total',
        'rawPayload',
        'dateTimeReceived',
        'longId',
        'publicUrl',
      ],
      ['companyId', 'uuid'],
    )
    .execute();
  return result.identifiers.length || batch.length;
}
