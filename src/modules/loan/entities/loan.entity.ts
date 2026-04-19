import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Business } from '../../auth/entities/business.entity';
import { User } from '../../auth/entities/user.entity';
import { LoanPayment } from './loan-payment.entity';

export type LoanType = 'supplier' | 'microcredit';
export type LoanStatus = 'open' | 'partial' | 'paid' | 'overdue';

@Entity('loans')
@Index(['businessId'])
@Index(['businessId', 'status'])
@Index(['businessId', 'createdAt'])
export class Loan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid', nullable: false })
  businessId: string;

  @Column({ name: 'lender_name', type: 'varchar', length: 255, nullable: false })
  lenderName: string;

  @Column({ name: 'lender_phone', type: 'varchar', length: 50, nullable: true })
  lenderPhone: string;

  @Column({ name: 'loan_type', type: 'varchar', length: 20, nullable: false })
  loanType: LoanType;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
  amount: number;

  @Column({ name: 'amount_paid', type: 'decimal', precision: 12, scale: 2, default: 0 })
  amountPaid: number;

  @Column({ type: 'varchar', length: 3, default: 'XOF' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'due_date', type: 'date', nullable: false })
  dueDate: Date;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: LoanStatus;

  @Column({ name: 'created_by', type: 'uuid', nullable: false })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;

  @OneToMany(() => LoanPayment, (p) => p.loan)
  payments: LoanPayment[];
}
