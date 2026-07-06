import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { User } from '../users/user.entity';
import { Branch } from '../branches/branch.entity';
import { Customer } from '../customers/customer.entity';
import { Product } from '../products/product.entity';
import { Invoice } from '../invoices/invoice.entity';
import { Subscription } from '../subscriptions/subscription.entity';

export enum CompanyStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  TRIAL = 'trial',
}

@Entity({ name: 'companies' })
export class Company extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 60 })
  taxRegistrationNumber!: string; // RIN

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nameEn?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 10, default: 'EGP' })
  defaultCurrency!: string;

  // ETA credentials (per-tenant — encrypted at rest in prod)
  @Column({ type: 'varchar', length: 255, nullable: true })
  etaClientId?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  etaClientSecret?: string;

  @Column({ type: 'varchar', length: 20, default: 'preprod' })
  etaEnvironment!: 'preprod' | 'production';

  @Column({ type: 'enum', enum: CompanyStatus, default: CompanyStatus.TRIAL })
  status!: CompanyStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl?: string;

  @OneToMany(() => User, (u) => u.company)
  users!: User[];

  @OneToMany(() => Branch, (b) => b.company)
  branches!: Branch[];

  @OneToMany(() => Customer, (c) => c.company)
  customers!: Customer[];

  @OneToMany(() => Product, (p) => p.company)
  products!: Product[];

  @OneToMany(() => Invoice, (i) => i.company)
  invoices!: Invoice[];

  @OneToMany(() => Subscription, (s) => s.company)
  subscriptions!: Subscription[];
}
