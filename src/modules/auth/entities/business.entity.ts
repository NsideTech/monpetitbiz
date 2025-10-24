import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, Index } from 'typeorm';
import { User } from './user.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';
import { StockItem } from '../../stock/entities/stock-item.entity';

@Entity('businesses')
@Index('IDX_businesses_country', ['country'])
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 6, unique: true, nullable: false })
  businessCode: string;

  @Column({ type: 'varchar', length: 3, default: 'XOF' })
  currency: string;

  @Column({ type: 'varchar', length: 50, default: 'Africa/Dakar' })
  timezone: string;

  @Column({ name: 'owner_name', type: 'varchar', length: 100, nullable: true })
  ownerName: string;

  @Column({ name: 'country', type: 'varchar', length: 3, nullable: true })
  country: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @OneToMany(() => User, user => user.business)
  users: User[];

  @OneToMany(() => Transaction, transaction => transaction.business)
  transactions: Transaction[];

  @OneToMany(() => StockItem, stockItem => stockItem.business)
  stockItems: StockItem[];
}