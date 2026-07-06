import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { VatReturn } from './vat-return.entity';

@Entity({ name: 'vat_purchases_manual' })
@Index(['companyId', 'vatReturnId'])
export class VatPurchaseManual extends BaseEntity {
  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @Column({ type: 'char', length: 36 })
  vatReturnId!: string;

  @ManyToOne(() => VatReturn, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vatReturnId' })
  vatReturn?: VatReturn;

  @Column({ type: 'varchar', length: 255 })
  supplierName!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  supplierTaxId?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  invoiceNumber?: string | null;

  @Column({ type: 'date', nullable: true })
  invoiceDate?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  netAmount!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  vatAmount!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  grossAmount!: number;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;
}
