import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';

import { AuthService } from '../auth.service';
import { User, UserRole } from '../entities/user.entity';
import { Business } from '../entities/business.entity';
import { OtpSession } from '../entities/otp-session.entity';
import { PhoneValidationService } from '../services/phone-validation.service';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let businessRepository: Repository<Business>;
  let otpSessionRepository: Repository<OtpSession>;
  let jwtService: JwtService;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockBusinessRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockOtpSessionRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Business),
          useValue: mockBusinessRepository,
        },
        {
          provide: getRepositoryToken(OtpSession),
          useValue: mockOtpSessionRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PhoneValidationService,
          useValue: {
            extractCountryFromWhatsApp: jest.fn(),
            checkPhoneNumberStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    businessRepository = module.get<Repository<Business>>(getRepositoryToken(Business));
    otpSessionRepository = module.get<Repository<OtpSession>>(getRepositoryToken(OtpSession));
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendOTP', () => {
    it('should generate and save OTP session', async () => {
      const phoneNumber = '+226123456789';
      mockOtpSessionRepository.save.mockResolvedValue({});

      const result = await service.sendOTP(phoneNumber);

      expect(result.message).toBe('OTP sent successfully');
      expect(result.code).toMatch(/^\d{6}$/);
      expect(mockOtpSessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: '+226123456789',
          code: expect.stringMatching(/^\d{6}$/),
          expiresAt: expect.any(Date),
          attempts: 0,
        })
      );
    });
  });

  describe('verifyOTP', () => {
    it('should verify valid OTP and return auth result', async () => {
      const phoneNumber = '+226123456789';
      const code = '123456';
      const mockOtpSession = {
        phoneNumber,
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
        attempts: 0,
      };
      const mockUser = {
        id: 'user-id',
        phoneNumber,
        businessId: 'business-id',
        role: UserRole.OWNER,
      };

      mockOtpSessionRepository.findOne.mockResolvedValue(mockOtpSession);
      mockOtpSessionRepository.delete.mockResolvedValue({});
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.verifyOTP(phoneNumber, code);

      // Check if it's an AuthResult (user exists)
      if ('user' in result) {
        expect(result.user).toEqual(mockUser);
        expect(result.accessToken).toBe('jwt-token');
      } else {
        fail('Expected AuthResult but got VerificationResult');
      }
      expect(mockOtpSessionRepository.delete).toHaveBeenCalledWith({ phoneNumber });
    });

    it('should throw error for invalid OTP', async () => {
      const phoneNumber = '+226123456789';
      const code = '123456';
      const mockOtpSession = {
        phoneNumber,
        code: '654321', // Different code
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
      };

      mockOtpSessionRepository.findOne.mockResolvedValue(mockOtpSession);
      mockOtpSessionRepository.update.mockResolvedValue({});

      await expect(service.verifyOTP(phoneNumber, code)).rejects.toThrow(UnauthorizedException);
      expect(mockOtpSessionRepository.update).toHaveBeenCalledWith(
        { phoneNumber },
        { attempts: 1 }
      );
    });

    it('should throw error for expired OTP', async () => {
      const phoneNumber = '+226123456789';
      const code = '123456';
      const mockOtpSession = {
        phoneNumber,
        code,
        expiresAt: new Date(Date.now() - 1000), // Expired
        attempts: 0,
      };

      mockOtpSessionRepository.findOne.mockResolvedValue(mockOtpSession);
      mockOtpSessionRepository.delete.mockResolvedValue({});

      await expect(service.verifyOTP(phoneNumber, code)).rejects.toThrow(BadRequestException);
      expect(mockOtpSessionRepository.delete).toHaveBeenCalledWith({ phoneNumber });
    });
  });

  describe('registerUser', () => {
    it('should register new user with business', async () => {
      const registerDto = {
        phoneNumber: '+226123456789',
        businessName: 'Test Business',
        role: UserRole.OWNER,
        language: 'fr',
      };

      const mockBusiness = { id: 'business-id', name: 'Test Business' };
      const mockUser = { id: 'user-id', phoneNumber: '+226123456789' };

      mockUserRepository.findOne.mockResolvedValue(null); // User doesn't exist
      mockBusinessRepository.create.mockReturnValue(mockBusiness);
      mockBusinessRepository.save.mockResolvedValue(mockBusiness);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      // Mock JWT token generation
      mockJwtService.sign.mockReturnValue('jwt-token');
      
      // Mock final user lookup with business relation
      mockUserRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
        ...mockUser,
        business: mockBusiness,
      });

      const result = await service.registerUser(registerDto);

      expect(result).toEqual({
        user: { ...mockUser, business: mockBusiness },
        accessToken: 'jwt-token',
      });
      expect(mockBusinessRepository.create).toHaveBeenCalledWith({
        name: 'Test Business',
        currency: 'XOF',
        timezone: 'Africa/Dakar',
      });
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        phoneNumber: '+226123456789',
        businessId: 'business-id',
        role: UserRole.OWNER,
        language: 'fr',
        isActive: true,
      });
    });

    it('should throw error if user already exists', async () => {
      const registerDto = {
        phoneNumber: '+226123456789',
        businessName: 'Test Business',
        role: UserRole.OWNER,
      };

      mockUserRepository.findOne.mockResolvedValue({ id: 'existing-user' });

      await expect(service.registerUser(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('hasPermission', () => {
    it('should return true for owner with valid permission', async () => {
      const mockUser = {
        id: 'user-id',
        role: UserRole.OWNER,
        isActive: true,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.hasPermission('user-id', 'view_reports');

      expect(result).toBe(true);
    });

    it('should return false for seller with owner-only permission', async () => {
      const mockUser = {
        id: 'user-id',
        role: UserRole.SELLER,
        isActive: true,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.hasPermission('user-id', 'view_reports');

      expect(result).toBe(false);
    });

    it('should return true for seller with allowed permission', async () => {
      const mockUser = {
        id: 'user-id',
        role: UserRole.SELLER,
        isActive: true,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.hasPermission('user-id', 'create_sale');

      expect(result).toBe(true);
    });

    it('should return false for inactive user', async () => {
      const mockUser = {
        id: 'user-id',
        role: UserRole.OWNER,
        isActive: false,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.hasPermission('user-id', 'view_reports');

      expect(result).toBe(false);
    });
  });
});