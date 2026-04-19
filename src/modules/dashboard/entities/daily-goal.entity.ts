import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Business } from '../../auth/entities/business.entity';

@Entity('daily_goals')
export class DailyGoal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid', nullable: false })
  businessId: string;

  @Column({
    name: 'target_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: false,
  })
  targetAmount: number;

  @Column({
    name: 'day_of_week',
    type: 'integer',
    nullable: true,
    comment: '0=tous les jours (null), 0=dim, 1=lun ... 6=sam selon JS getDay()',
  })
  dayOfWeek: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true, nullable: false })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;
}
