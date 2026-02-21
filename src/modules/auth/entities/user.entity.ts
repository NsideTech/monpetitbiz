import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { Business } from './business.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';

export enum UserRole {
  OWNER = 'owner',
  SELLER = 'seller',
  MANAGER = 'manager'
}

@Entity('users')
@Index(['phoneNumber'], { unique: true })
@Index('IDX_users_business_role', ['businessId', 'role'])
@Index('IDX_users_role', ['role'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 20, unique: true, nullable: false })
  phoneNumber: string;

  @Column({ name: 'employee_name', type: 'varchar', length: 100, nullable: true })
  employeeName: string;

  @Column({ name: 'business_id', type: 'uuid', nullable: true })
  businessId: string;

  @Column({ 
    type: 'varchar', 
    length: 20,
    nullable: false
  })
  role: UserRole;

  @Column({ type: 'varchar', length: 5, default: 'fr' })
  language: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'invited_by', type: 'uuid', nullable: true })
  invitedBy: string;

  @Column({ name: 'joined_at', type: 'timestamptz', nullable: true })
  joinedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Business, business => business.users)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @OneToMany(() => Transaction, transaction => transaction.user)
  transactions: Transaction[];
}