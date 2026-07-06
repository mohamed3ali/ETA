import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { Company } from '../companies/company.entity';

@Entity({ name: 'branches' })
@Index(['companyId', 'code'], { unique: true })
export class Branch extends BaseEntity {
  @Column({ type: 'varchar', length: 60 })
  code!: string; // ETA branch code

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  governorate?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, (c) => c.branches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company!: Company;
}
