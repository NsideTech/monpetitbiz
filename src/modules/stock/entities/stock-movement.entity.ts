import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Business } from '../../auth/entities/business.entity';
import { User } from '../../auth/entities/user.entity';

export enum MovementType {
  PURCHASE = 'purchase',
  SALE = 'sale',
  ADJUSTMENT = 'adjustment',
  LOSS = 'loss'
}

@Entity('stock_movements')
@Index(['businessId'])
@Index(['businessId', 'productName'])
@Index(['businessId', 'createdAt'])
@Index(['businessId', 'movementType'])
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid', nullable: false })
  businessId: string;

  @Column({ name: 'product_name', type: 'varchar', length: 255, nullable: false })
  productName: string;

  @Column({ 
    name: 'movement_type',
    type: 'varchar', 
    length: 20,
    nullable: false
  })
  movementType: MovementType;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  quantity: number;

  @Column({ type: 'varchar', length: 50, nullable: false })
  unit: string;

  @Column({ name: 'base_quantity', type: 'decimal', precision: 10, scale: 2, nullable: false })
  baseQuantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  unitPrice: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalAmount: number;

  @Column({ name: 'previous_stock', type: 'decimal', precision: 10, scale: 2, nullable: false })
  previousStock: number;

  @Column({ name: 'new_stock', type: 'decimal', precision: 10, scale: 2, nullable: false })
  newStock: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: false })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Business, business => business.stockItems)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @ManyToOne(() => User, user => user.transactions)
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;
}