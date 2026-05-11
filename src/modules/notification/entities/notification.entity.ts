import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationType {
  INACTIVITY_REMINDER     = 'inactivity_reminder',
  ACTIVITY_DROP_ALERT     = 'activity_drop_alert',
  GOAL_REACHED            = 'goal_reached',
  REGULARITY_SIGNAL       = 'regularity_signal',
  AGENT_INACTIVITY_REPORT = 'agent_inactivity_report',
}

@Entity('notifications')
@Index('IDX_notifications_business_id', ['businessId'])
@Index('IDX_notifications_status', ['status'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 50 })
  type: NotificationType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: 'pending' | 'sent' | 'failed';

  @Column({ name: 'sent_at', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
