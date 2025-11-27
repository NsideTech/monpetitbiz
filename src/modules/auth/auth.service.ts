import { Injectable, UnauthorizedException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { User, UserRole } from './entities/user.entity';
import { Business } from './entities/business.entity';
import { OtpSession } from './entities/otp-session.entity';
import { PhoneValidationService } from './services/phone-validation.service';

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

export interface BusinessCreationRequest {
  phoneNumber: string;
  businessName: string;
  ownerName: string;
  country?: string;
  language?: string;
}

export interface BusinessCreationResult {
  business: Business;
  owner: User;
  businessCode: string;
  accessToken: string;
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
    private readonly phoneValidationService: PhoneValidationService,
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
   * Register a new business owner with generated business code
   */
  async registerBusinessOwner(registerDto: RegisterUserDto): Promise<AuthResult> {
    const cleanPhoneNumber = this.cleanPhoneNumber(registerDto.phoneNumber);

    // Check if user already exists
    const existingUser = await this.getUserByPhone(cleanPhoneNumber);
    if (existingUser) {
      throw new ConflictException('User with this phone number already exists.');
    }

    // Generate unique business code
    const businessCode = await this.generateBusinessCode();

    // Create business with generated code
    const business = this.businessRepository.create({
      name: registerDto.businessName,
      businessCode,
      currency: 'XOF', // Default currency for West Africa
      timezone: 'Africa/Dakar', // Default timezone
    });
    const savedBusiness = await this.businessRepository.save(business);

    // Create owner user
    const user = this.userRepository.create({
      phoneNumber: cleanPhoneNumber,
      businessId: savedBusiness.id,
      role: UserRole.OWNER,
      language: registerDto.language || 'fr',
      isActive: true,
      joinedAt: new Date(),
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
   * Register a new employee with business code validation
   */
  async registerEmployee(
    phoneNumber: string, 
    businessCode: string, 
    employeeName: string, 
    role: 'seller' | 'manager', 
    language?: string
  ): Promise<AuthResult> {
    const cleanPhoneNumber = this.cleanPhoneNumber(phoneNumber);

    // Check if user already exists
    const existingUser = await this.getUserByPhone(cleanPhoneNumber);
    if (existingUser) {
      throw new ConflictException('User with this phone number already exists.');
    }

    // Validate business code exists
    const business = await this.businessRepository.findOne({
      where: { businessCode: businessCode.toUpperCase() }
    });

    if (!business) {
      throw new BadRequestException('Invalid business code. Please verify with your employer.');
    }

    // Map role string to UserRole enum
    const userRole = role === 'manager' ? UserRole.MANAGER : UserRole.SELLER;

    // Create employee user
    const user = this.userRepository.create({
      phoneNumber: cleanPhoneNumber,
      employeeName,
      businessId: business.id,
      role: userRole,
      language: language || 'fr',
      isActive: true,
      joinedAt: new Date(),
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
   * Add another owner (administrator) to an existing business
   * Only existing owners can add other owners
   */
  async addOwnerToBusiness(
    ownerPhoneNumber: string,
    newOwnerPhoneNumber: string,
    newOwnerName: string,
    language?: string
  ): Promise<AuthResult> {
    const cleanOwnerPhone = this.cleanPhoneNumber(ownerPhoneNumber);
    const cleanNewOwnerPhone = this.cleanPhoneNumber(newOwnerPhoneNumber);

    // Verify the requester is an owner
    const requester = await this.getUserByPhone(cleanOwnerPhone);
    if (!requester) {
      throw new ForbiddenException('Requester not found.');
    }

    if (requester.role !== UserRole.OWNER) {
      throw new ForbiddenException('Only business owners can add other owners.');
    }

    if (!requester.businessId) {
      throw new BadRequestException('Requester is not associated with a business.');
    }

    // Check if new owner already exists
    const existingUser = await this.getUserByPhone(cleanNewOwnerPhone);
    if (existingUser) {
      if (existingUser.businessId === requester.businessId) {
        throw new ConflictException('This user is already part of your business.');
      }
      throw new ConflictException('User with this phone number already exists in another business.');
    }

    // Get the business
    const business = await this.businessRepository.findOne({
      where: { id: requester.businessId }
    });

    if (!business) {
      throw new BadRequestException('Business not found.');
    }

    // Create new owner user
    const newOwner = this.userRepository.create({
      phoneNumber: cleanNewOwnerPhone,
      employeeName: newOwnerName.trim(),
      businessId: business.id,
      role: UserRole.OWNER,
      language: language || 'fr',
      isActive: true,
      joinedAt: new Date(),
      invitedBy: requester.id,
    });

    const savedOwner = await this.userRepository.save(newOwner);

    // Generate JWT token for immediate authentication
    const accessToken = await this.generateJwtToken(savedOwner);

    // Return the user with business relation loaded
    const userWithBusiness = await this.getUserByPhone(cleanNewOwnerPhone);

    return {
      user: userWithBusiness!,
      accessToken,
    };
  }

  /**
   * Register a new user with business and return authentication result
   * @deprecated Use registerBusinessOwner for business owners
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
   * Get business by business code with employee count
   */
  async getBusinessByCode(businessCode: string): Promise<{ business: Business; employeeCount: number } | null> {
    const business = await this.businessRepository.findOne({
      where: { businessCode: businessCode.toUpperCase() },
      relations: ['users']
    });

    if (!business) {
      return null;
    }

    // Count active employees (excluding owners)
    const employeeCount = business.users.filter(user => 
      user.isActive && user.role !== UserRole.OWNER
    ).length;

    return {
      business,
      employeeCount
    };
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
        'manage_users',
        'view_business_code'
      ],
      [UserRole.MANAGER]: [
        'create_sale',
        'create_expense',
        'view_reports',
        'manage_stock',
        'view_balance',
        'generate_pdf'
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
  async generateJwtToken(user: User): Promise<string> {
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
   * Create business with owner - main method for merchant onboarding
   */
  async createBusinessWithOwner(request: BusinessCreationRequest): Promise<BusinessCreationResult> {
    const cleanPhoneNumber = this.cleanPhoneNumber(request.phoneNumber);

    // Check if user already exists
    const existingUser = await this.getUserByPhone(cleanPhoneNumber);
    if (existingUser) {
      throw new ConflictException('User with this phone number already exists.');
    }

    // Validate business name uniqueness
    await this.validateBusinessNameUniqueness(request.businessName);

    // Extract country from phone number if not provided
    let country = request.country;
    if (!country) {
      const phoneValidation = await this.phoneValidationService.extractCountryFromWhatsApp(cleanPhoneNumber);
      if (phoneValidation.isValid) {
        country = phoneValidation.country;
      } else {
        throw new BadRequestException('Unable to extract country from phone number. Please provide country manually.');
      }
    }

    // Generate unique business code
    const businessCode = await this.generateBusinessCode();

    // Create business with owner information
    const business = this.businessRepository.create({
      name: request.businessName.trim(),
      businessCode,
      currency: 'XOF', // Default currency for West Africa
      timezone: 'Africa/Dakar', // Default timezone
      ownerName: request.ownerName.trim(),
      country: country,
    });
    const savedBusiness = await this.businessRepository.save(business);

    // Create owner user with extracted country
    const owner = this.userRepository.create({
      phoneNumber: cleanPhoneNumber,
      employeeName: request.ownerName.trim(),
      businessId: savedBusiness.id,
      role: UserRole.OWNER,
      language: request.language || 'fr',
      isActive: true,
      joinedAt: new Date(),
    });

    const savedOwner = await this.userRepository.save(owner);

    // Generate JWT token for immediate authentication
    const accessToken = await this.generateJwtToken(savedOwner);

    // Return the complete result with business relation loaded
    const ownerWithBusiness = await this.getUserByPhone(cleanPhoneNumber);

    return {
      business: savedBusiness,
      owner: ownerWithBusiness!,
      businessCode,
      accessToken,
    };
  }

  /**
   * Validate business name uniqueness
   */
  async validateBusinessNameUniqueness(businessName: string): Promise<void> {
    if (!businessName || businessName.trim().length === 0) {
      throw new BadRequestException('Business name cannot be empty.');
    }

    const trimmedName = businessName.trim();
    
    if (trimmedName.length < 2) {
      throw new BadRequestException('Business name must be at least 2 characters long.');
    }

    if (trimmedName.length > 100) {
      throw new BadRequestException('Business name cannot exceed 100 characters.');
    }

    // Check for uniqueness (case-insensitive)
    const existingBusiness = await this.businessRepository
      .createQueryBuilder('business')
      .where('LOWER(business.name) = LOWER(:name)', { name: trimmedName })
      .getOne();

    if (existingBusiness) {
      throw new ConflictException('A business with this name already exists. Please choose a different name.');
    }
  }

  /**
   * Generate unique business code
   * Generates a 6-character alphanumeric code excluding confusing characters (0/O, 1/I/L)
   */
  async generateBusinessCode(): Promise<string> {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // Excludes 0, O, 1, I, L
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Check if code already exists
      const existingBusiness = await this.businessRepository.findOne({
        where: { businessCode: code }
      });

      if (!existingBusiness) {
        return code;
      }

      attempts++;
    }

    throw new Error('Unable to generate unique business code after maximum attempts');
  }

  /**
   * Clean and format phone number
   */
  private cleanPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');

    // Add country code if missing (assuming West Africa +226 for Burkina)
    if (cleaned.length === 9 && !cleaned.startsWith('226')) {
      return '+226' + cleaned;
    }

    if (cleaned.length >= 10 && !cleaned.startsWith('+')) {
      return '+' + cleaned;
    }

    return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
  }
}