import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { Company } from '../companies/company.entity';

export enum SubscriptionPlan {
  TRIAL = 'trial',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity({ name: 'subscriptions' })
export class Subscription extends BaseEntity {
  @Column({ type: 'enum', enum: SubscriptionPlan, default: SubscriptionPlan.TRIAL })
  plan!: SubscriptionPlan;

  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.ACTIVE })
  status!: SubscriptionStatus;

  @Column({ type: 'date' })
  startsAt!: string;

  @Column({ type: 'date', nullable: true })
  endsAt?: string | null;

  @Column({ type: 'int', default: 100 })
  invoiceQuota!: number;

  @Column({ type: 'int', default: 0 })
  invoicesUsed!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price!: number;

  @Column({ type: 'varchar', length: 10, default: 'EGP' })
  currency!: string;

  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, (c) => c.subscriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company!: Company;
}
