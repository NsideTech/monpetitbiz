import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Business } from '../../auth/entities/business.entity';
import { User } from '../../auth/entities/user.entity';

export enum TransactionType {
  SALE = 'sale',
  EXPENSE = 'expense'
}

@Entity('transactions')
@Index(['businessId', 'createdAt'])
@Index(['businessId', 'type'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid', nullable: false })
  businessId: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId: string;

  @Column({ 
    type: 'enum', 
    enum: TransactionType,
    nullable: false
  })
  type: TransactionType;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'XOF' })
  currency: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  product: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Business, business => business.transactions)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @ManyToOne(() => User, user => user.transactions)
  @JoinColumn({ name: 'user_id' })
  user: User;
}