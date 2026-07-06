import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { TaxFilingStatus } from './tax.utils';

@Entity({ name: 'form41_returns' })
@Index(['companyId', 'year', 'quarter'], { unique: true })
export class Form41Return extends BaseEntity {
  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'varchar', length: 2 })
  quarter!: string;

  @Column({ type: 'enum', enum: TaxFilingStatus, default: TaxFilingStatus.DRAFT })
  status!: TaxFilingStatus;

  @Column({ type: 'timestamp', nullable: true })
  filedAt?: Date | null;
}
