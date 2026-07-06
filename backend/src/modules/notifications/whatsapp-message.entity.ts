import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { Invoice } from '../invoices/invoice.entity';

export enum WhatsappStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

export enum WhatsappTemplate {
  INVOICE_SENT = 'invoice_sent',
  PAYMENT_REMINDER = 'payment_reminder',
  PAYMENT_RECEIVED = 'payment_received',
  OVERDUE = 'overdue',
  PAYMENT_LINK = 'payment_link',
}

/**
 * Audit log of every WhatsApp message we attempted to deliver. Lets the UI
 * show a per-invoice timeline and helps debug failures.
 */
@Entity({ name: 'whatsapp_messages' })
@Index(['companyId', 'invoiceId'])
@Index(['companyId', 'status'])
@Index(['companyId', 'createdAt'])
export class WhatsappMessage extends BaseEntity {
  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @Column({ type: 'char', length: 36, nullable: true })
  invoiceId?: string | null;

  @Column({ type: 'enum', enum: WhatsappTemplate })
  template!: WhatsappTemplate;

  @Column({ type: 'varchar', length: 50 })
  toPhone!: string;

  @Column({ type: 'enum', enum: WhatsappStatus, default: WhatsappStatus.QUEUED })
  status!: WhatsappStatus;

  @Column({ type: 'json', nullable: true })
  variables?: Record<string, string> | null;

  @Column({ type: 'text', nullable: true })
  body?: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ type: 'boolean', default: false })
  mock!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  sentAt?: Date | null;

  @ManyToOne(() => Invoice, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invoiceId' })
  invoice?: Invoice | null;
}
