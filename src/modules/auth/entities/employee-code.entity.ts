import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Business } from './business.entity';
import { User } from './user.entity';

@Entity('employee_codes')
@Index(['code'], { unique: true })
@Index(['businessId', 'isActive'])
export class EmployeeCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid', nullable: false })
  businessId: string;

  @Column({ type: 'varchar', length: 6, unique: true })
  code: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: false })
  createdBy: string;

  @Column({ name: 'expires_at', type: 'datetime', nullable: false })
  expiresAt: Date;

  @Column({ name: 'used_by', type: 'varchar', length: 20, nullable: true })
  usedBy: string; // phone number

  @Column({ name: 'used_at', type: 'datetime', nullable: true })
  usedAt: Date;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;
}