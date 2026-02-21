import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ValueTransformer } from 'typeorm';

// Transformer to handle JSON serialization for both SQLite and PostgreSQL
const jsonTransformer: ValueTransformer = {
  to: (value: Record<string, any>) => JSON.stringify(value),
  from: (value: string) => {
    try {
      return value ? JSON.parse(value) : {};
    } catch {
      return {};
    }
  },
};

@Entity('conversation_states')
export class ConversationStateEntity {
  @PrimaryColumn({ name: 'phone_number', type: 'varchar', length: 20 })
  phoneNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  step: string;

  @Column({ 
    type: 'text', 
    nullable: false, 
    default: '{}',
    transformer: jsonTransformer
  })
  data: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: false })
  expiresAt: Date;

  @Column({ name: 'timeout_warnings_sent', type: 'integer', default: 0 })
  timeoutWarningsSent: number;

  @Column({ name: 'last_activity_at', type: 'timestamptz', nullable: true })
  lastActivityAt: Date;
}