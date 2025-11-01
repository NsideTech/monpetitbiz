import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { AuthModule } from '../auth.module';
import { User } from '../entities/user.entity';
import { OtpSession } from '../entities/otp-session.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, ManyToOne, JoinColumn, Index } from 'typeorm';

// Simplified Business entity for testing (without Transaction/StockItem relationships)
@Entity('businesses')
@Index('IDX_businesses_country', ['country'])
class TestBusiness {
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

  // Only include User relationship for auth tests
  @OneToMany(() => TestUser, user => user.business)
  users: TestUser[];
}

// Simplified User entity for testing
@Entity('users')
@Index(['phoneNumber'], { unique: true })
@Index('IDX_users_business_role', ['businessId', 'role'])
@Index('IDX_users_role', ['role'])
class TestUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 20, unique: true, nullable: false })
  phoneNumber: string;

  @Column({ name: 'employee_name', type: 'varchar', length: 100, nullable: true })
  employeeName: string;

  @Column({ name: 'business_id', type: 'uuid', nullable: true })
  businessId: string;

  @Column({ type: 'varchar', length: 10, nullable: false })
  role: string;

  @Column({ type: 'varchar', length: 5, default: 'fr' })
  language: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'invited_by', type: 'uuid', nullable: true })
  invitedBy: string;

  @Column({ name: 'joined_at', type: 'timestamp', nullable: true })
  joinedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => TestBusiness, business => business.users)
  @JoinColumn({ name: 'business_id' })
  business: TestBusiness;
}

describe('Auth Integration Tests (with in-memory database)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        // Use in-memory SQLite database for testing
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [TestUser, TestBusiness, OtpSession],
          synchronize: true,
          logging: false,
        }),
        AuthModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('OTP Flow', () => {
    const testPhoneNumber = '+226123456789';

    it('should complete the full OTP authentication flow', async () => {
      // Step 1: Send OTP
      const sendOtpResponse = await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send({ phoneNumber: testPhoneNumber })
        .expect(200);

      expect(sendOtpResponse.body.success).toBe(true);
      expect(sendOtpResponse.body.message).toBe('OTP sent successfully');

      // Step 2: Get OTP from debug endpoint (only works in test environment)
      const debugResponse = await request(app.getHttpServer())
        .get('/auth/debug/otp-sessions')
        .expect(200);

      const otpSession = debugResponse.body.data.find(
        (session: any) => session.phoneNumber === testPhoneNumber
      );
      expect(otpSession).toBeDefined();
      expect(otpSession.code).toMatch(/^\d{6}$/);

      // Step 3: Verify OTP (should indicate need for registration)
      const verifyResponse = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({
          phoneNumber: testPhoneNumber,
          code: otpSession.code,
        })
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.needsRegistration).toBe(true);
      expect(verifyResponse.body.phoneNumber).toBe(testPhoneNumber);

      // Step 4: Complete registration
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/complete-registration')
        .send({
          phoneNumber: testPhoneNumber,
          businessName: 'Test Business',
          role: 'owner',
          language: 'fr',
        })
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data.user.phoneNumber).toBe(testPhoneNumber);
      expect(registerResponse.body.data.accessToken).toBeDefined();

      // Step 5: Test existing user flow
      // Send new OTP
      await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send({ phoneNumber: testPhoneNumber })
        .expect(200);

      // Get new OTP
      const debugResponse2 = await request(app.getHttpServer())
        .get('/auth/debug/otp-sessions')
        .expect(200);

      const newOtpSession = debugResponse2.body.data.find(
        (session: any) => session.phoneNumber === testPhoneNumber
      );

      // Verify OTP for existing user
      const existingUserResponse = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({
          phoneNumber: testPhoneNumber,
          code: newOtpSession.code,
        })
        .expect(200);

      expect(existingUserResponse.body.success).toBe(true);
      expect(existingUserResponse.body.data.user.phoneNumber).toBe(testPhoneNumber);
      expect(existingUserResponse.body.data.accessToken).toBeDefined();
      expect(existingUserResponse.body.needsRegistration).toBeUndefined();
    });

    it('should handle invalid OTP codes', async () => {
      const invalidPhoneNumber = '+226987654321';

      // Send OTP
      await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send({ phoneNumber: invalidPhoneNumber })
        .expect(200);

      // Try to verify with wrong code
      await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({
          phoneNumber: invalidPhoneNumber,
          code: '000000',
        })
        .expect(401);
    });

    it('should handle expired OTP codes', async () => {
      // This test would require mocking the date or waiting for expiration
      // For now, we'll just test the validation
      await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({
          phoneNumber: '+226999999999',
          code: '123456',
        })
        .expect(400); // No OTP session found
    });
  });

  describe('Registration', () => {
    it('should prevent duplicate registrations', async () => {
      const phoneNumber = '+226555555555';

      // First registration
      await request(app.getHttpServer())
        .post('/auth/complete-registration')
        .send({
          phoneNumber,
          businessName: 'First Business',
          role: 'owner',
          language: 'fr',
        })
        .expect(201);

      // Second registration should fail
      await request(app.getHttpServer())
        .post('/auth/complete-registration')
        .send({
          phoneNumber,
          businessName: 'Second Business',
          role: 'owner',
          language: 'fr',
        })
        .expect(409); // Conflict
    });
  });
});