import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { Invoice } from '../invoices/invoice.entity';

export enum PaymentLinkStatus {
  PENDING = 'pending',
  PAID = 'paid',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum PaymentLinkProvider {
  PAYMOB = 'paymob',
  FAWRY = 'fawry',
  STRIPE = 'stripe',
  MOCK = 'mock',
}

@Entity({ name: 'payment_links' })
@Index(['companyId', 'invoiceId'])
@Index(['companyId', 'status'])
export class PaymentLink extends BaseEntity {
  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @Column({ type: 'char', length: 36 })
  invoiceId!: string;

  /**
   * URL-safe public token used as the path segment in the customer-facing
   * payment URL. Unique across all tenants (random nanoid, 32 chars).
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  token!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount!: number;

  @Column({ type: 'varchar', length: 10, default: 'EGP' })
  currency!: string;

  @Column({ type: 'enum', enum: PaymentLinkStatus, default: PaymentLinkStatus.PENDING })
  status!: PaymentLinkStatus;

  @Column({ type: 'enum', enum: PaymentLinkProvider, default: PaymentLinkProvider.MOCK })
  provider!: PaymentLinkProvider;

  /** Provider-side reference (Paymob intention id, Stripe session id, etc.). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  providerRef?: string | null;

  /**
   * The redirectable URL we hand to the customer. For real providers this is
   * the hosted checkout URL; for mock mode it points at our own public
   * `/pay/:token` page so the flow is testable end-to-end.
   */
  @Column({ type: 'varchar', length: 1000, nullable: true })
  checkoutUrl?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date | null;

  @Column({ type: 'char', length: 36, nullable: true })
  createdById?: string | null;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice!: Invoice;
}
