import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { Company } from '../companies/company.entity';
import { Customer } from '../customers/customer.entity';
import { Branch } from '../branches/branch.entity';
import { User } from '../users/user.entity';
import { InvoiceType } from '../invoices/invoice.entity';

export enum RecurringPeriod {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export interface RecurringItem {
  productId?: string | null;
  description: string;
  etaItemCode?: string | null;
  etaCodeType: 'GS1' | 'EGS';
  unitType: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
}

@Entity({ name: 'recurring_invoices' })
@Index(['companyId', 'isActive'])
@Index(['companyId', 'nextRunDate'])
export class RecurringInvoice extends BaseEntity {
  @Column({ type: 'varchar', length: 120, nullable: true })
  name?: string | null;

  @Column({ type: 'enum', enum: InvoiceType, default: InvoiceType.INVOICE })
  type!: InvoiceType;

  @Column({ type: 'enum', enum: RecurringPeriod })
  period!: RecurringPeriod;

  @Column({ type: 'date' })
  nextRunDate!: string;

  @Column({ type: 'timestamp', nullable: true })
  lastRunAt?: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'boolean', default: false })
  autoSubmit!: boolean;

  @Column({ type: 'varchar', length: 10, default: 'EGP' })
  currency!: string;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'json' })
  items!: RecurringItem[];

  // bookkeeping for visibility in UI
  @Column({ type: 'int', default: 0 })
  generatedCount!: number;

  // foreign keys
  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @Column({ type: 'char', length: 36 })
  customerId!: string;

  @Column({ type: 'char', length: 36, nullable: true })
  branchId?: string | null;

  @Column({ type: 'char', length: 36, nullable: true })
  createdById?: string | null;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company!: Company;

  @ManyToOne(() => Customer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customerId' })
  customer!: Customer;

  @ManyToOne(() => Branch, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch?: Branch | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy?: User | null;
}
