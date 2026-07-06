import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/BaseEntity';
import { Form41Return } from './form41-return.entity';

@Entity({ name: 'withholding_entries' })
@Index(['companyId', 'form41ReturnId'])
export class WithholdingEntry extends BaseEntity {
  @Column({ type: 'char', length: 36 })
  companyId!: string;

  @Column({ type: 'char', length: 36 })
  form41ReturnId!: string;

  @ManyToOne(() => Form41Return, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'form41ReturnId' })
  form41Return?: Form41Return;

  @Column({ type: 'varchar', length: 255 })
  payeeName!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  payeeId?: string | null;

  @Column({ type: 'varchar', length: 64 })
  paymentType!: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  grossAmount!: number;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  withholdingRate!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  withheldAmount!: number;

  @Column({ type: 'date', nullable: true })
  paymentDate?: string | null;
}
