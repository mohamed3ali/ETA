import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';

@Entity({ name: 'audit_logs' })
@Index(['companyId', 'createdAt'])
export class AuditLog extends BaseEntity {
  @Column({ type: 'char', length: 36, nullable: true })
  companyId?: string | null;

  @Column({ type: 'char', length: 36, nullable: true })
  userId?: string | null;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resource?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resourceId?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent?: string;

  @Column({ type: 'json', nullable: true })
  meta?: Record<string, unknown> | null;
}
