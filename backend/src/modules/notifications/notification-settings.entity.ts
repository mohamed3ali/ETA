import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';

/**
 * Per-company notification preferences. There is at most one row per company,
 * created lazily on first read.
 */
@Entity({ name: 'notification_settings' })
export class NotificationSettings extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'char', length: 36 })
  companyId!: string;

  // ── WhatsApp delivery toggles ──────────────────────────────────────────
  @Column({ type: 'boolean', default: true })
  whatsappEnabled!: boolean;

  @Column({ type: 'boolean', default: true })
  sendOnAccepted!: boolean;

  @Column({ type: 'boolean', default: true })
  sendReminders!: boolean;

  /** How many days before `dueDate` to send a payment reminder. */
  @Column({ type: 'int', default: 3 })
  reminderLeadDays!: number;

  @Column({ type: 'boolean', default: true })
  sendOnOverdue!: boolean;

  @Column({ type: 'boolean', default: true })
  sendOnPaid!: boolean;

  // ── Smart-alert rules ──────────────────────────────────────────────────
  @Column({ type: 'boolean', default: true })
  alertOverdue!: boolean;

  @Column({ type: 'boolean', default: true })
  alertRejected!: boolean;

  @Column({ type: 'boolean', default: true })
  alertSubmissionStuck!: boolean;

  @Column({ type: 'boolean', default: true })
  alertLargeInvoice!: boolean;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 100000 })
  alertLargeInvoiceThreshold!: number;

  /**
   * Optional per-tenant message body overrides keyed by template name.
   * Recognized keys: invoice_sent, payment_reminder, overdue, payment_received.
   * If unset for a given template, the default copy is used.
   */
  @Column({ type: 'json', nullable: true })
  templates?: Record<string, string> | null;
}
