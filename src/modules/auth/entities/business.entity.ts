import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn, OneToMany, Index } from 'typeorm';
import { User } from './user.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';
import { StockItem } from '../../stock/entities/stock-item.entity';
import { ProductUnit } from '../../stock/entities/product-unit.entity';
import { StockMovement } from '../../stock/entities/stock-movement.entity';

@Entity('businesses')
@Index('IDX_businesses_country', ['country'])
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ name: 'business_code', type: 'varchar', length: 6, unique: true, nullable: false })
  businessCode: string;

  @Column({ type: 'varchar', length: 3, default: 'XOF' })
  currency: string;

  @Column({ type: 'varchar', length: 50, default: 'Africa/Dakar' })
  timezone: string;

  @Column({ name: 'owner_name', type: 'varchar', length: 100, nullable: true })
  ownerName: string;

  @Column({ name: 'country', type: 'varchar', length: 3, nullable: true })
  country: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ name: 'activity_type', type: 'varchar', length: 50, nullable: true })
  activityType: string | null; // 'retail' | 'food' | 'craft' | 'service' | 'other'

  @Column({ name: 'preferred_channel', type: 'varchar', length: 20, default: 'whatsapp', nullable: false })
  preferredChannel: string; // 'whatsapp' | 'mobile' | 'both'

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  // Relations
  @OneToMany(() => User, user => user.business)
  users: User[];

  @OneToMany(() => Transaction, transaction => transaction.business)
  transactions: Transaction[];

  @OneToMany(() => StockItem, stockItem => stockItem.business)
  stockItems: StockItem[];

  @OneToMany(() => ProductUnit, productUnit => productUnit.business)
  productUnits: ProductUnit[];

  @OneToMany(() => StockMovement, stockMovement => stockMovement.business)
  stockMovements: StockMovement[];
}