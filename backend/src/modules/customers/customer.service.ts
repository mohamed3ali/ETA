import { Brackets } from 'typeorm';
import { AppDataSource } from '../../database/data-source';
import { Customer } from './customer.entity';
import { CreateCustomerInput, UpdateCustomerInput } from './customer.dto';
import { HttpError } from '../../common/errors/HttpError';
import { buildPage, PaginationQuery } from '../../common/utils/pagination';

const repo = () => AppDataSource.getRepository(Customer);

export const customerService = {
  async list(companyId: string, q: PaginationQuery) {
    const qb = repo()
      .createQueryBuilder('c')
      .where('c.companyId = :companyId', { companyId });

    if (q.search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('c.name LIKE :s', { s: `%${q.search}%` })
            .orWhere('c.email LIKE :s', { s: `%${q.search}%` })
            .orWhere('c.phone LIKE :s', { s: `%${q.search}%` })
            .orWhere('c.taxRegistrationNumber LIKE :s', { s: `%${q.search}%` });
        }),
      );
    }

    const allowed = ['createdAt', 'name', 'email'];
    const sortBy = allowed.includes(q.sortBy ?? '') ? q.sortBy! : 'createdAt';
    qb.orderBy(`c.${sortBy}`, q.sortDir);

    const [items, total] = await qb
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getManyAndCount();

    return buildPage(items, total, q);
  },

  async getById(companyId: string, id: string) {
    const customer = await repo().findOne({ where: { id, companyId } });
    if (!customer) throw HttpError.notFound('Customer not found');
    return customer;
  },

  async create(companyId: string, input: CreateCustomerInput) {
    const entity = repo().create({ ...input, companyId });
    return repo().save(entity);
  },

  async update(companyId: string, id: string, input: UpdateCustomerInput) {
    const customer = await this.getById(companyId, id);
    Object.assign(customer, input);
    return repo().save(customer);
  },

  async remove(companyId: string, id: string) {
    const customer = await this.getById(companyId, id);
    await repo().softRemove(customer);
    return { id };
  },
};
