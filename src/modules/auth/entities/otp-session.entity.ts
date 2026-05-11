import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('otp_sessions')
export class OtpSession {
  @PrimaryColumn({ name: 'phone_number', type: 'varchar', length: 20 })
  phoneNumber: string;

  @Column({ type: 'varchar', length: 6, nullable: false })
  code: string;

  @Column({ name: 'expires_at', nullable: false })
  expiresAt: Date;

  @Column({ type: 'integer', default: 0 })
  attempts: number;
}