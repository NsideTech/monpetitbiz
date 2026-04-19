import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Business } from '../../auth/entities/business.entity';
import { User } from '../../auth/entities/user.entity';

export enum TransactionType {
  SALE = 'sale',
  EXPENSE = 'expense'
}

export enum PaymentMethod {
  CASH = 'cash',
  MOBILE_MONEY = 'mobile_money',
  CREDIT = 'credit',
  OTHER = 'other',
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
    type: 'varchar', 
    length: 20,
    nullable: false
  })
  type: TransactionType;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'XOF' })
  currency: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  product: string;

  @Column({ type: 'integer', nullable: true })
  quantity: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  /**
   * @deprecated Use paymentMethod === PaymentMethod.CREDIT instead.
   * Kept for backward compatibility. PaymentMethod.CREDIT replaces the semantics of this field.
   */
  @Column({ name: 'is_credit_sale', type: 'boolean', default: false })
  isCreditSale: boolean;

  @Column({
    name: 'payment_method',
    type: 'varchar',
    length: 20,
    default: PaymentMethod.CASH,
    nullable: false,
  })
  paymentMethod: PaymentMethod;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy: string | null;

  @Column({ name: 'deletion_reason', type: 'text', nullable: true })
  deletionReason: string | null;

  // Relations
  @ManyToOne(() => Business, business => business.transactions)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @ManyToOne(() => User, user => user.transactions)
  @JoinColumn({ name: 'user_id' })
  user: User;
}