import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { User, UserRole } from './entities/user.entity';
import { Business } from './entities/business.entity';
import { OtpSession } from './entities/otp-session.entity';

export interface SendOtpDto {
  phoneNumber: string;
}

export interface VerifyOtpDto {
  phoneNumber: string;
  code: string;
}

export interface RegisterUserDto {
  phoneNumber: string;
  businessName: string;
  role: UserRole;
  language?: string;
}

export interface JwtPayload {
  sub: string; // user id
  phoneNumber: string;
  businessId: string;
  role: UserRole;
}

export interface AuthResult {
  user: User;
  accessToken: string;
}

export interface VerificationResult {
  needsRegistration: boolean;
  phoneNumber: string;
}

export type OTPVerificationResult = AuthResult | VerificationResult;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(OtpSession)
    private readonly otpSessionRepository: Repository<OtpSession>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Generate and send OTP to user's phone number
   */
  async sendOTP(phoneNumber: string): Promise<string> {
    // Clean phone number format
    const cleanPhoneNumber = this.cleanPhoneNumber(phoneNumber);

    // Generate 6-digit OTP
    const code = this.generateOTP();

    // Set expiration time (5 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // Save or update OTP session
    await this.otpSessionRepository.save({
      phoneNumber: cleanPhoneNumber,
      code,
      expiresAt,
      attempts: 0,
    });

    // In a real implementation, you would send the OTP via WhatsApp or SMS
    // For now, we'll return the session ID for testing purposes
    console.log(`OTP for ${cleanPhoneNumber}: ${code}`);

    return 'OTP sent successfully';
  }

  /**
   * Verify OTP and authenticate user
   */
  async verifyOTP(phoneNumber: string, code: string): Promise<OTPVerificationResult> {
    const cleanPhoneNumber = this.cleanPhoneNumber(phoneNumber);

    // Find OTP session
    const otpSession = await this.otpSessionRepository.findOne({
      where: { phoneNumber: cleanPhoneNumber }
    });

    if (!otpSession) {
      throw new BadRequestException('No OTP session found. Please request a new OTP.');
    }

    // Check if OTP is expired
    if (new Date() > otpSession.expiresAt) {
      await this.otpSessionRepository.delete({ phoneNumber: cleanPhoneNumber });
      throw new BadRequestException('OTP has expired. Please request a new OTP.');
    }

    // Check attempts limit
    if (otpSession.attempts >= 3) {
      await this.otpSessionRepository.delete({ phoneNumber: cleanPhoneNumber });
      throw new BadRequestException('Too many failed attempts. Please request a new OTP.');
    }

    // Verify OTP code
    if (otpSession.code !== code) {
      // Increment attempts
      await this.otpSessionRepository.update(
        { phoneNumber: cleanPhoneNumber },
        { attempts: otpSession.attempts + 1 }
      );
      throw new UnauthorizedException('Invalid OTP code.');
    }

    // OTP is valid, clean up session
    await this.otpSessionRepository.delete({ phoneNumber: cleanPhoneNumber });

    // Check if user already exists
    const existingUser = await this.getUserByPhone(cleanPhoneNumber);

    if (existingUser) {
      // User exists, return authentication result
      const accessToken = await this.generateJwtToken(existingUser);
      return {
        user: existingUser,
        accessToken,
      };
    } else {
      // User doesn't exist, needs registration
      return {
        needsRegistration: true,
        phoneNumber: cleanPhoneNumber,
      };
    }
  }

  /**
   * Register a new user with business and return authentication result
   */
  async registerUser(registerDto: RegisterUserDto): Promise<AuthResult> {
    const cleanPhoneNumber = this.cleanPhoneNumber(registerDto.phoneNumber);

    // Check if user already exists
    const existingUser = await this.getUserByPhone(cleanPhoneNumber);
    if (existingUser) {
      throw new ConflictException('User with this phone number already exists.');
    }

    // Create business first
    const business = this.businessRepository.create({
      name: registerDto.businessName,
      currency: 'XOF', // Default currency for West Africa
      timezone: 'Africa/Dakar', // Default timezone
    });
    const savedBusiness = await this.businessRepository.save(business);

    // Create user
    const user = this.userRepository.create({
      phoneNumber: cleanPhoneNumber,
      businessId: savedBusiness.id,
      role: registerDto.role,
      language: registerDto.language || 'fr',
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);

    // Generate JWT token for immediate authentication
    const accessToken = await this.generateJwtToken(savedUser);

    // Return the user with business relation loaded
    const userWithBusiness = await this.getUserByPhone(cleanPhoneNumber);

    return {
      user: userWithBusiness!,
      accessToken,
    };
  }

  /**
   * Get user by phone number
   */
  async getUserByPhone(phoneNumber: string): Promise<User | null> {
    const cleanPhoneNumber = this.cleanPhoneNumber(phoneNumber);

    return await this.userRepository.findOne({
      where: { phoneNumber: cleanPhoneNumber },
      relations: ['business'],
    });
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { id: userId },
      relations: ['business'],
    });
  }

  /**
   * Check if user has permission for a specific action
   */
  async hasPermission(userId: string, action: string): Promise<boolean> {
    const user = await this.getUserById(userId);

    if (!user || !user.isActive) {
      return false;
    }

    // Define permission matrix
    const permissions = {
      [UserRole.OWNER]: [
        'create_sale',
        'create_expense',
        'view_reports',
        'manage_stock',
        'view_balance',
        'generate_pdf',
        'manage_users'
      ],
      [UserRole.SELLER]: [
        'create_sale',
        'manage_stock'
      ]
    };

    const userPermissions = permissions[user.role] || [];
    return userPermissions.includes(action);
  }

  /**
   * Validate JWT token and return user
   */
  async validateToken(token: string): Promise<User> {
    try {
      const payload = this.jwtService.verify(token) as JwtPayload;
      const user = await this.getUserById(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive.');
      }

      return user;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }

  /**
   * Generate JWT token for user
   */
  private async generateJwtToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      phoneNumber: user.phoneNumber,
      businessId: user.businessId,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Generate 6-digit OTP
   */
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Debug method to get all OTP sessions (development only)
   */
  async getAllOtpSessions(): Promise<any[]> {
    if (process.env.NODE_ENV === 'production') {
      return [];
    }

    try {
      const sessions = await this.otpSessionRepository.find();
      return sessions.map(session => ({
        phoneNumber: session.phoneNumber,
        code: session.code,
        expiresAt: session.expiresAt,
        attempts: session.attempts,
        isExpired: new Date() > session.expiresAt
      }));
    } catch (error) {
      console.error('Error fetching OTP sessions:', error);
      return [];
    }
  }

  /**
   * Debug method to get all users (development only)
   */
  async getAllUsers(): Promise<any[]> {
    if (process.env.NODE_ENV === 'production') {
      return [];
    }
    
    try {
      const users = await this.userRepository.find({
        relations: ['business'],
      });
      return users.map(user => ({
        id: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        language: user.language,
        isActive: user.isActive,
        businessId: user.businessId,
        businessName: user.business?.name,
        createdAt: user.createdAt
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  /**
   * Clean and format phone number
   */
  private cleanPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');

    // Add country code if missing (assuming West Africa +221 for Senegal)
    if (cleaned.length === 9 && !cleaned.startsWith('221')) {
      return '+221' + cleaned;
    }

    if (cleaned.length >= 10 && !cleaned.startsWith('+')) {
      return '+' + cleaned;
    }

    return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
  }
}