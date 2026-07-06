import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';

export enum AlertType {
  INVOICE_OVERDUE = 'invoice_overdue',
  INVOICE_REJECTED = 'invoice_rejected',
  SUBMISSION_STUCK = 'submission_stuck',
  LARGE_INVOICE = 'large_invoice',
  PAYMENT_RECEIVED = 'payment_received',
  WHATSAPP_FAILED = 'whatsapp_failed',
  RECURRING_FAILED = 'recurring_failed',
  VAT_DUE_SOON = 'vat_due_soon',
  FORM41_DUE_SOON = 'form41_due_soon',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

@Entity({ name: 'alerts' })
@Index(['companyId', 'readAt'])
@Index(['companyId', 'createdAt'])
@Index(['companyId', 'dedupeKey'], { unique: true })
export class Alert extends BaseEntity {
  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @Column({ type: 'enum', enum: AlertType })
  type!: AlertType;

  @Column({ type: 'enum', enum: AlertSeverity, default: AlertSeverity.INFO })
  severity!: AlertSeverity;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  message?: string | null;

  @Column({ type: 'json', nullable: true })
  payload?: Record<string, unknown> | null;

  /** Optional related invoice for quick navigation from the UI. */
  @Column({ type: 'char', length: 36, nullable: true })
  invoiceId?: string | null;

  /**
   * Deduplication key. The rule engine writes alerts using upsert keyed on
   * (companyId, dedupeKey) so re-running the cron doesn't spam users. Example:
   * `invoice_overdue:${invoiceId}` or `large_invoice:${invoiceId}`.
   */
  @Column({ type: 'varchar', length: 191 })
  dedupeKey!: string;

  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  dismissedAt?: Date | null;
}
