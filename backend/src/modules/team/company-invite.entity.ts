import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { Company } from '../companies/company.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role';

export enum CompanyInviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

/**
 * Invitation to join a company. The invited user follows the token URL,
 * either logs in or creates an account with the same email, and on the
 * `/team/invites/accept` endpoint we materialise a CompanyMembership.
 *
 * A pending invite is unique per (companyId, email) — re-inviting the
 * same email just resets the existing row (`token`, `expiresAt`).
 */
@Entity({ name: 'company_invites' })
@Index('uniq_company_invite_email', ['companyId', 'email', 'status'])
@Index('idx_company_invite_token', ['token'], { unique: true })
export class CompanyInvite extends BaseEntity {
  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Company;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.ACCOUNTANT })
  role!: UserRole;

  @Column({ type: 'varchar', length: 64 })
  token!: string;

  @Column({ type: 'enum', enum: CompanyInviteStatus, default: CompanyInviteStatus.PENDING })
  status!: CompanyInviteStatus;

  @Column({ type: 'char', length: 36, nullable: true })
  invitedById?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invitedById' })
  invitedBy?: User | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt?: Date | null;
}
