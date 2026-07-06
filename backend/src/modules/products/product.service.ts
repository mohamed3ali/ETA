import { Brackets } from 'typeorm';
import { AppDataSource } from '../../database/data-source';
import { Product, ProductKind } from './product.entity';
import { CreateProductInput, UpdateProductInput } from './product.dto';
import { HttpError } from '../../common/errors/HttpError';
import { buildPage, PaginationQuery } from '../../common/utils/pagination';

const repo = () => AppDataSource.getRepository(Product);

interface ListProductsQuery extends PaginationQuery {
  kind?: ProductKind;
  active?: boolean;
}

export const productService = {
  async list(companyId: string, q: ListProductsQuery) {
    const qb = repo()
      .createQueryBuilder('p')
      .where('p.companyId = :companyId', { companyId });

    if (q.search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('p.name LIKE :s', { s: `%${q.search}%` })
            .orWhere('p.sku LIKE :s', { s: `%${q.search}%` })
            .orWhere('p.etaItemCode LIKE :s', { s: `%${q.search}%` });
        }),
      );
    }

    if (q.kind) {
      qb.andWhere('p.kind = :kind', { kind: q.kind });
    }
    if (typeof q.active === 'boolean') {
      qb.andWhere('p.isActive = :active', { active: q.active });
    }

    const allowed = ['createdAt', 'name', 'unitPrice', 'sku'];
    const sortBy = allowed.includes(q.sortBy ?? '') ? q.sortBy! : 'createdAt';
    qb.orderBy(`p.${sortBy}`, q.sortDir);

    const [items, total] = await qb
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getManyAndCount();

    return buildPage(items, total, q);
  },

  async getById(companyId: string, id: string) {
    const product = await repo().findOne({ where: { id, companyId } });
    if (!product) throw HttpError.notFound('Product not found');
    return product;
  },

  async create(companyId: string, input: CreateProductInput) {
    const existing = await repo().findOne({ where: { companyId, sku: input.sku } });
    if (existing) throw HttpError.conflict('SKU already exists');
    const entity = repo().create({ ...input, companyId });
    return repo().save(entity);
  },

  async update(companyId: string, id: string, input: UpdateProductInput) {
    const product = await this.getById(companyId, id);
    Object.assign(product, input);
    return repo().save(product);
  },

  async remove(companyId: string, id: string) {
    const product = await this.getById(companyId, id);
    await repo().softRemove(product);
    return { id };
  },
};
