import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, BadRequestException } from '@nestjs/common';

import { AuthService, BusinessCreationRequest } from '../auth.service';
import { User, UserRole } from '../entities/user.entity';
import { Business } from '../entities/business.entity';
import { OtpSession } from '../entities/otp-session.entity';
import { PhoneValidationService } from '../services/phone-validation.service';

describe('AuthService - Business Creation', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let businessRepository: Repository<Business>;
  let otpSessionRepository: Repository<OtpSession>;
  let phoneValidationService: PhoneValidationService;
  let jwtService: JwtService;

  const mockUser = {
    id: 'user-id',
    phoneNumber: '+221701234567',
    employeeName: 'John Doe',
    businessId: 'business-id',
    role: UserRole.OWNER,
    language: 'fr',
    isActive: true,
    joinedAt: new Date(),
    createdAt: new Date(),
    business: {
      id: 'business-id',
      name: 'Test Business',
      businessCode: 'ABC123',
      currency: 'XOF',
      timezone: 'Africa/Dakar',
      ownerName: 'John Doe',
      country: 'SN',
      createdAt: new Date(),
    },
  };

  const mockBusiness = {
    id: 'business-id',
    name: 'Test Business',
    businessCode: 'ABC123',
    currency: 'XOF',
    timezone: 'Africa/Dakar',
    ownerName: 'John Doe',
    country: 'SN',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Business),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              getOne: jest.fn(),
            }),
          },
        },
        {
          provide: getRepositoryToken(OtpSession),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: PhoneValidationService,
          useValue: {
            extractCountryFromWhatsApp: jest.fn(),
            checkPhoneNumberStatus: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    businessRepository = module.get<Repository<Business>>(getRepositoryToken(Business));
    otpSessionRepository = module.get<Repository<OtpSession>>(getRepositoryToken(OtpSession));
    phoneValidationService = module.get<PhoneValidationService>(PhoneValidationService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('createBusinessWithOwner', () => {
    const validRequest: BusinessCreationRequest = {
      phoneNumber: '+221701234567',
      businessName: 'Test Business',
      ownerName: 'John Doe',
      country: 'SN',
      language: 'fr',
    };

    it('should create business with owner successfully', async () => {
      // Mock no existing user
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      
      // Mock business name uniqueness check
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      jest.spyOn(businessRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      // Mock business code generation - return null first time to simulate unique code
      jest.spyOn(businessRepository, 'findOne').mockResolvedValue(null);
      
      // Mock generateBusinessCode method to return consistent value
      jest.spyOn(service, 'generateBusinessCode').mockResolvedValue('ABC123');

      // Mock business creation
      jest.spyOn(businessRepository, 'create').mockReturnValue(mockBusiness as any);
      jest.spyOn(businessRepository, 'save').mockResolvedValue(mockBusiness as any);

      // Mock user creation
      jest.spyOn(userRepository, 'create').mockReturnValue(mockUser as any);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as any);

      // Mock JWT token generation
      jest.spyOn(jwtService, 'sign').mockReturnValue('mock-jwt-token');

      // Mock final user lookup
      jest.spyOn(userRepository, 'findOne').mockResolvedValueOnce(null).mockResolvedValueOnce(mockUser as any);

      const result = await service.createBusinessWithOwner(validRequest);

      expect(result).toEqual({
        business: mockBusiness,
        owner: mockUser,
        businessCode: 'ABC123',
        accessToken: 'mock-jwt-token',
      });
    });

    it('should throw ConflictException if user already exists', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);

      await expect(service.createBusinessWithOwner(validRequest)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if business name already exists', async () => {
      // Mock no existing user
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      
      // Mock business name already exists
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockBusiness),
      };
      jest.spyOn(businessRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      await expect(service.createBusinessWithOwner(validRequest)).rejects.toThrow(ConflictException);
    });

    it('should extract country from phone number if not provided', async () => {
      const requestWithoutCountry = { ...validRequest };
      delete requestWithoutCountry.country;

      // Mock no existing user
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      
      // Mock business name uniqueness check
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      jest.spyOn(businessRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      // Mock country extraction
      jest.spyOn(phoneValidationService, 'extractCountryFromWhatsApp').mockResolvedValue({
        country: 'SN',
        formattedNumber: '+221701234567',
        isValid: true,
      });

      // Mock generateBusinessCode method to return consistent value
      jest.spyOn(service, 'generateBusinessCode').mockResolvedValue('ABC123');

      // Mock business code generation
      jest.spyOn(businessRepository, 'findOne').mockResolvedValue(null);

      // Mock business creation
      jest.spyOn(businessRepository, 'create').mockReturnValue(mockBusiness as any);
      jest.spyOn(businessRepository, 'save').mockResolvedValue(mockBusiness as any);

      // Mock user creation
      jest.spyOn(userRepository, 'create').mockReturnValue(mockUser as any);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as any);

      // Mock JWT token generation
      jest.spyOn(jwtService, 'sign').mockReturnValue('mock-jwt-token');

      // Mock final user lookup
      jest.spyOn(userRepository, 'findOne').mockResolvedValueOnce(null).mockResolvedValueOnce(mockUser as any);

      const result = await service.createBusinessWithOwner(requestWithoutCountry);

      expect(phoneValidationService.extractCountryFromWhatsApp).toHaveBeenCalledWith('+221701234567');
      expect(result.business.country).toBe('SN');
    });

    it('should throw BadRequestException if country extraction fails', async () => {
      const requestWithoutCountry = { ...validRequest };
      delete requestWithoutCountry.country;

      // Mock no existing user
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      
      // Mock business name uniqueness check
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      jest.spyOn(businessRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      // Mock failed country extraction
      jest.spyOn(phoneValidationService, 'extractCountryFromWhatsApp').mockResolvedValue({
        country: '',
        formattedNumber: '+221701234567',
        isValid: false,
      });

      await expect(service.createBusinessWithOwner(requestWithoutCountry)).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateBusinessNameUniqueness', () => {
    it('should pass for unique business name', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      jest.spyOn(businessRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      await expect(service.validateBusinessNameUniqueness('Unique Business')).resolves.not.toThrow();
    });

    it('should throw ConflictException for duplicate business name', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockBusiness),
      };
      jest.spyOn(businessRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      await expect(service.validateBusinessNameUniqueness('Test Business')).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for empty business name', async () => {
      await expect(service.validateBusinessNameUniqueness('')).rejects.toThrow(BadRequestException);
      await expect(service.validateBusinessNameUniqueness('   ')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for business name too short', async () => {
      await expect(service.validateBusinessNameUniqueness('A')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for business name too long', async () => {
      const longName = 'A'.repeat(101);
      await expect(service.validateBusinessNameUniqueness(longName)).rejects.toThrow(BadRequestException);
    });
  });
});