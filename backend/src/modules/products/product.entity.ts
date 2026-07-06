import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { Company } from '../companies/company.entity';

export enum ProductKind {
  PRODUCT = 'product', // Physical good
  SERVICE = 'service', // Service / labour / hour-based offering
}

@Entity({ name: 'products' })
@Index(['companyId', 'sku'], { unique: true })
export class Product extends BaseEntity {
  @Column({ type: 'enum', enum: ProductKind, default: ProductKind.PRODUCT })
  kind!: ProductKind;

  @Column({ type: 'varchar', length: 100 })
  sku!: string; // internal SKU

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nameEn?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // ETA item code (GS1 / EGS) — required to submit to ETA
  @Column({ type: 'varchar', length: 100, nullable: true })
  etaItemCode?: string;

  @Column({ type: 'varchar', length: 20, default: 'GS1' })
  etaCodeType!: 'GS1' | 'EGS';

  @Column({ type: 'varchar', length: 20, default: 'EA' })
  unitType!: string; // ETA unit codes (EA, KGM, etc.)

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  unitPrice!: number;

  // VAT rate stored as percentage (e.g. 14.00)
  @Column({ type: 'decimal', precision: 6, scale: 2, default: 14 })
  taxRate!: number;

  @Column({ type: 'varchar', length: 10, default: 'EGP' })
  currency!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, (c) => c.products, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company!: Company;
}
