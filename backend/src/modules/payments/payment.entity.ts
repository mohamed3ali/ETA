import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { Invoice } from '../invoices/invoice.entity';

export enum PaymentMethod {
  CASH = 'cash',
  BANK_TRANSFER = 'bank_transfer',
  CARD = 'card',
  CHEQUE = 'cheque',
  WALLET = 'wallet',
  OTHER = 'other',
}

@Entity({ name: 'payments' })
@Index(['companyId', 'invoiceId'])
export class Payment extends BaseEntity {
  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount!: number;

  @Column({ type: 'varchar', length: 10, default: 'EGP' })
  currency!: string;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.CASH })
  method!: PaymentMethod;

  @Column({ type: 'date' })
  paidAt!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @Column({ type: 'char', length: 36 })
  invoiceId!: string;

  @ManyToOne(() => Invoice, (i) => i.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice!: Invoice;
}
