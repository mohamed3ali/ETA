import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { Company } from './company.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role';

/**
 * Links a user to a company they can access, with a per-company role.
 *
 * A user can have memberships in many companies (e.g. an accounting firm
 * staffer managing multiple client companies). The user's "active" company
 * for any request is still carried on the JWT (`companyId`), and the auth
 * middleware verifies the user has a matching membership before letting
 * the request through.
 */
@Entity({ name: 'company_memberships' })
@Unique('uniq_user_company', ['userId', 'companyId'])
@Index(['userId'])
@Index(['companyId'])
export class CompanyMembership extends BaseEntity {
  @Column({ type: 'char', length: 36 })
  userId!: string;

  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.ACCOUNTANT })
  role!: UserRole;

  /** Marks the user's default company shown after login. */
  @Column({ type: 'boolean', default: false })
  isDefault!: boolean;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company!: Company;
}
