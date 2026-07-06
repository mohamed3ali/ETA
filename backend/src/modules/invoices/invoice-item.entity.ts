import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { Invoice } from './invoice.entity';
import { Product } from '../products/product.entity';

@Entity({ name: 'invoice_items' })
export class InvoiceItem extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  description!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  etaItemCode?: string;

  @Column({ type: 'varchar', length: 20, default: 'GS1' })
  etaCodeType!: 'GS1' | 'EGS';

  @Column({ type: 'varchar', length: 20, default: 'EA' })
  unitType!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  quantity!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  unitPrice!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  discount!: number; // absolute amount

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 14 })
  taxRate!: number; // %

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  taxAmount!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  lineTotal!: number; // net + tax

  @Column({ type: 'char', length: 36 })
  invoiceId!: string;

  @Column({ type: 'char', length: 36, nullable: true })
  productId?: string | null;

  @ManyToOne(() => Invoice, (i) => i.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice!: Invoice;

  @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'productId' })
  product?: Product | null;
}
