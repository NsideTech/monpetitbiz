import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {User} from '../../auth/entities/user.entity';
import {Business} from '../../auth/entities/business.entity';

@Entity('chat_messages')
@Index(['userId', 'timestamp'])
@Index(['businessId', 'timestamp'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({name: 'user_id', type: 'uuid', nullable: false})
  userId: string;

  @Column({name: 'business_id', type: 'uuid', nullable: false})
  businessId: string;

  @Column({type: 'text', nullable: false})
  message: string;

  @Column({type: 'text', nullable: false})
  response: string;

  @Column({name: 'message_id', type: 'varchar', length: 255, nullable: false})
  messageId: string;

  @CreateDateColumn({name: 'timestamp'})
  timestamp: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({name: 'user_id'})
  user: User;

  @ManyToOne(() => Business)
  @JoinColumn({name: 'business_id'})
  business: Business;
}

