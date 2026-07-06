import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { Company } from '../companies/company.entity';
import { Invoice } from '../invoices/invoice.entity';

export enum CustomerType {
  BUSINESS = 'B', // company
  PERSON = 'P',   // individual
  FOREIGNER = 'F',
}

@Entity({ name: 'customers' })
@Index(['companyId', 'taxRegistrationNumber'])
export class Customer extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nameEn?: string;

  @Column({ type: 'enum', enum: CustomerType, default: CustomerType.BUSINESS })
  type!: CustomerType;

  @Column({ type: 'varchar', length: 60, nullable: true })
  taxRegistrationNumber?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  nationalId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  governorate?: string;

  @Column({ type: 'varchar', length: 3, default: 'EG' })
  country!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, (c) => c.customers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company!: Company;

  @OneToMany(() => Invoice, (i) => i.customer)
  invoices!: Invoice[];
}
