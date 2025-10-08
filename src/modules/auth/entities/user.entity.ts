import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { Business } from './business.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';

export enum UserRole {
  OWNER = 'owner',
  SELLER = 'seller'
}

@Entity('users')
@Index(['phoneNumber'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 20, unique: true, nullable: false })
  phoneNumber: string;

  @Column({ name: 'business_id', type: 'uuid', nullable: true })
  businessId: string;

  @Column({ 
    type: 'enum', 
    enum: UserRole,
    nullable: false
  })
  role: UserRole;

  @Column({ type: 'varchar', length: 5, default: 'fr' })
  language: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Business, business => business.users)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @OneToMany(() => Transaction, transaction => transaction.user)
  transactions: Transaction[];
}