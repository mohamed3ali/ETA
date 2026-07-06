import { Entity, Column, Index, Unique, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { Company } from '../companies/company.entity';

export type EtaPortalDirection = 'Sent' | 'Received';

export type EtaPortalDocumentStatus =
  | 'Valid'
  | 'Invalid'
  | 'Rejected'
  | 'Cancelled'
  | 'Submitted';

/**
 * One document fetched from the ETA portal (sales or purchases) for a given
 * company. Acts as a local cache so we can list, filter and analyse without
 * hitting ETA every time. Uniqueness is per (company, uuid) — the same UUID
 * can appear under different companies (Sent for issuer, Received for
 * receiver) which is fine.
 */
@Entity({ name: 'eta_portal_documents' })
@Unique('uniq_company_uuid', ['companyId', 'uuid'])
@Index(['companyId', 'direction'])
@Index(['companyId', 'dateTimeIssued'])
export class EtaPortalDocument extends BaseEntity {
  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company!: Company;

  @Column({ type: 'varchar', length: 64 })
  uuid!: string;

  @Column({
    type: 'enum',
    enum: ['Sent', 'Received'],
    default: 'Sent',
  })
  direction!: EtaPortalDirection;

  @Column({ type: 'varchar', length: 64, nullable: true })
  submissionUUID?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  longId?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  internalId?: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  typeName?: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  typeVersionName?: string;

  @Column({ type: 'varchar', length: 60 })
  issuerId!: string;

  @Column({ type: 'varchar', length: 255 })
  issuerName!: string;

  @Column({ type: 'varchar', length: 8, nullable: true })
  issuerType?: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  receiverId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  receiverName?: string;

  @Column({ type: 'varchar', length: 8, nullable: true })
  receiverType?: string;

  @Column({ type: 'datetime' })
  dateTimeIssued!: Date;

  @Column({ type: 'datetime', nullable: true })
  dateTimeReceived?: Date;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalSales!: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalDiscount!: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  netAmount!: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  total!: string;

  @Column({
    type: 'enum',
    enum: ['Valid', 'Invalid', 'Rejected', 'Cancelled', 'Submitted'],
    default: 'Valid',
  })
  status!: EtaPortalDocumentStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  documentStatusReason?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  publicUrl?: string;

  /** Full raw payload from ETA for forensics / future re-mapping. */
  @Column({ type: 'json', nullable: true })
  rawPayload?: Record<string, unknown>;
}
