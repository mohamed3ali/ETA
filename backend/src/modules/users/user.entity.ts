import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { Company } from '../companies/company.entity';
import { Invoice } from '../invoices/invoice.entity';
import { UserRole } from './user-role';

export { UserRole };

@Entity({ name: 'users' })
@Index('uniq_users_email_global', ['email'], { unique: true })
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 120 })
  firstName!: string;

  @Column({ type: 'varchar', length: 120 })
  lastName!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.EMPLOYEE })
  role!: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  locale!: 'en' | 'ar';

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date | null;

  // multi-tenant scope
  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, (c) => c.users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company!: Company;

  @OneToMany(() => Invoice, (i) => i.createdBy)
  createdInvoices!: Invoice[];
}
