import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';

export enum EtaSyncStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export enum EtaSyncDirection {
  OUTBOUND = 'outbound', // we submit to ETA
  INBOUND = 'inbound',   // we pull from ETA
}

@Entity({ name: 'eta_sync_logs' })
@Index(['companyId', 'status'])
export class EtaSyncLog extends BaseEntity {
  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @Column({ type: 'char', length: 36, nullable: true })
  invoiceId?: string | null;

  @Column({ type: 'enum', enum: EtaSyncDirection })
  direction!: EtaSyncDirection;

  @Column({ type: 'enum', enum: EtaSyncStatus, default: EtaSyncStatus.PENDING })
  status!: EtaSyncStatus;

  @Column({ type: 'varchar', length: 100 })
  action!: string; // e.g. "submit", "fetch_status", "download_pdf"

  @Column({ type: 'json', nullable: true })
  request?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  response?: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'int', default: 0 })
  attempts!: number;
}
