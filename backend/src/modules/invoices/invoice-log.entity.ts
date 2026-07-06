import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { Invoice } from './invoice.entity';

export enum InvoiceLogAction {
  CREATED = 'created',
  UPDATED = 'updated',
  STATUS_CHANGED = 'status_changed',
  SUBMITTED_TO_ETA = 'submitted_to_eta',
  ETA_ACCEPTED = 'eta_accepted',
  ETA_REJECTED = 'eta_rejected',
  PAYMENT_RECORDED = 'payment_recorded',
  PDF_GENERATED = 'pdf_generated',
  EMAILED = 'emailed',
  WHATSAPP_SENT = 'whatsapp_sent',
}

@Entity({ name: 'invoice_logs' })
@Index(['invoiceId'])
export class InvoiceLog extends BaseEntity {
  @Column({ type: 'enum', enum: InvoiceLogAction })
  action!: InvoiceLogAction;

  @Column({ type: 'json', nullable: true })
  meta?: Record<string, unknown> | null;

  @Column({ type: 'char', length: 36, nullable: true })
  userId?: string | null;

  @Column({ type: 'char', length: 36 })
  invoiceId!: string;

  @ManyToOne(() => Invoice, (i) => i.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice!: Invoice;
}
