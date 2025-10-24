import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { Business } from '../../auth/entities/business.entity';

@Entity('stock_items')
@Unique(['businessId', 'product'])
@Index(['businessId'])
export class StockItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid', nullable: false })
  businessId: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  product: string;

  @Column({ type: 'integer', default: 0 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'unit_price' })
  unitPrice: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Business, business => business.stockItems)
  @JoinColumn({ name: 'business_id' })
  business: Business;
}