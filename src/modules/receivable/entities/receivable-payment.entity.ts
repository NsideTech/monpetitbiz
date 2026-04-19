import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Receivable } from './receivable.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('receivable_payments')
@Index(['receivableId'])
@Index(['receivableId', 'createdAt'])
export class ReceivablePayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'receivable_id', type: 'uuid', nullable: false })
  receivableId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
  amount: number;

  @Column({ name: 'payment_date', type: 'date', nullable: false })
  paymentDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: false })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Receivable, (r) => r.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receivable_id' })
  receivable: Receivable;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;
}
