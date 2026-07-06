import { AppDataSource } from '../../database/data-source';
import { Branch } from './branch.entity';
import { CreateBranchInput, UpdateBranchInput } from './branch.dto';
import { HttpError } from '../../common/errors/HttpError';

const repo = () => AppDataSource.getRepository(Branch);

export const branchService = {
  async list(companyId: string) {
    return repo().find({ where: { companyId }, order: { createdAt: 'ASC' } });
  },
  async getById(companyId: string, id: string) {
    const b = await repo().findOne({ where: { id, companyId } });
    if (!b) throw HttpError.notFound('Branch not found');
    return b;
  },
  async create(companyId: string, input: CreateBranchInput) {
    const exists = await repo().findOne({ where: { companyId, code: input.code } });
    if (exists) throw HttpError.conflict('Branch code already exists');
    return repo().save(repo().create({ ...input, companyId }));
  },
  async update(companyId: string, id: string, input: UpdateBranchInput) {
    const b = await this.getById(companyId, id);
    Object.assign(b, input);
    return repo().save(b);
  },
  async remove(companyId: string, id: string) {
    const b = await this.getById(companyId, id);
    await repo().softRemove(b);
    return { id };
  },
};
