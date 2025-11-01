import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { Business } from '../../auth/entities/business.entity';

@Entity('product_units')
@Unique(['businessId', 'productName'])
@Index(['businessId'])
@Index(['businessId', 'productName'])
export class ProductUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid', nullable: false })
  businessId: string;

  @Column({ name: 'product_name', type: 'varchar', length: 255, nullable: false })
  productName: string;

  @Column({ name: 'base_unit', type: 'varchar', length: 50, nullable: false, default: 'pièce' })
  baseUnit: string;

  @Column({ name: 'purchase_unit', type: 'varchar', length: 50, nullable: false })
  purchaseUnit: string;

  @Column({ name: 'conversion_factor', type: 'integer', nullable: false })
  conversionFactor: number;

  @Column({ name: 'purchase_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  purchasePrice: number;

  @Column({ name: 'selling_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  sellingPrice: number;

  @Column({ name: 'profit_margin', type: 'decimal', precision: 5, scale: 2, nullable: true })
  profitMargin: number;

  @Column({ name: 'alert_threshold', type: 'integer', nullable: true })
  alertThreshold: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Business, business => business.stockItems)
  @JoinColumn({ name: 'business_id' })
  business: Business;
}