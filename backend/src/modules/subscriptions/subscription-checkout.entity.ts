import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { Company } from '../companies/company.entity';
import { SubscriptionPlan } from './subscription.entity';

export enum SubscriptionCheckoutStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum SubscriptionCheckoutProvider {
  PAYMOB = 'paymob',
  MOCK = 'mock',
}

export type BillingPeriod = 'monthly' | 'yearly';

/**
 * One row per "Subscribe" intent. Created when a user clicks Subscribe on the
 * pricing page and used to track the Paymob (or mock) checkout end-to-end.
 *
 * On success (webhook or mock-confirm) we promote the company's active
 * subscription to the purchased plan.
 */
@Entity({ name: 'subscription_checkouts' })
@Index(['companyId', 'status'])
export class SubscriptionCheckout extends BaseEntity {
  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company!: Company;

  @Column({ type: 'char', length: 36, nullable: true })
  createdById?: string | null;

  /** Public URL-safe token used as the path segment of the customer-facing page. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  token!: string;

  @Column({ type: 'enum', enum: SubscriptionPlan })
  plan!: SubscriptionPlan;

  @Column({ type: 'varchar', length: 16, default: 'monthly' })
  billingPeriod!: BillingPeriod;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', length: 10, default: 'EGP' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: SubscriptionCheckoutStatus,
    default: SubscriptionCheckoutStatus.PENDING,
  })
  status!: SubscriptionCheckoutStatus;

  @Column({
    type: 'enum',
    enum: SubscriptionCheckoutProvider,
    default: SubscriptionCheckoutProvider.MOCK,
  })
  provider!: SubscriptionCheckoutProvider;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerRef?: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  checkoutUrl?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date | null;
}
