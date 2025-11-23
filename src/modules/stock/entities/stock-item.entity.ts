import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { Business } from '../../auth/entities/business.entity';

@Entity('stock_items')
@Unique(['businessId', 'product'])
@Unique(['businessId', 'productCode'])
@Index(['businessId'])
@Index(['businessId', 'productCode'])
export class StockItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid', nullable: false })
  businessId: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  product: string;

  @Column({ 
    name: 'product_code', 
    type: 'varchar', 
    length: 50, 
    nullable: true,
    unique: false
  })
  productCode: string;

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