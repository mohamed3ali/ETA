import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { TaxFilingStatus } from './tax.utils';

@Entity({ name: 'vat_returns' })
@Index(['companyId', 'year', 'month'], { unique: true })
export class VatReturn extends BaseEntity {
  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'int' })
  month!: number;

  @Column({ type: 'enum', enum: TaxFilingStatus, default: TaxFilingStatus.DRAFT })
  status!: TaxFilingStatus;

  /** Output VAT from accepted/submitted/paid sales invoices in period. */
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  outputVat!: number;

  /** Input VAT from manual purchase lines. */
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  inputVat!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  netVat!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  salesTotal!: number;

  @Column({ type: 'timestamp', nullable: true })
  filedAt?: Date | null;
}
