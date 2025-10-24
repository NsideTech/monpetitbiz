import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PhoneValidationService } from '../phone-validation.service';
import { User, UserRole } from '../../entities/user.entity';
import { Business } from '../../entities/business.entity';

describe('PhoneValidationService', () => {
  let service: PhoneValidationService;
  let userRepository: jest.Mocked<Repository<User>>;
  let businessRepository: jest.Mocked<Repository<Business>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhoneValidationService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Business),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PhoneValidationService>(PhoneValidationService);
    userRepository = module.get(getRepositoryToken(User));
    businessRepository = module.get(getRepositoryToken(Business));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractCountryFromWhatsApp', () => {
    it('should extract country from Burkina phone number', async () => {
      const result = await service.extractCountryFromWhatsApp('+226701234567');
      
      expect(result.isValid).toBe(true);
      expect(result.country).toBe('BF');
      expect(result.formattedNumber).toBe('+226701234567');
    });

    it('should extract country from Twilio WhatsApp format', async () => {
      const result = await service.extractCountryFromWhatsApp('whatsapp:+221701234567');
      
      expect(result.isValid).toBe(true);
      expect(result.country).toBe('SN');
      expect(result.formattedNumber).toBe('+221701234567');
    });

    it('should handle Mali phone number', async () => {
      const result = await service.extractCountryFromWhatsApp('+223701234567');
      
      expect(result.isValid).toBe(true);
      expect(result.country).toBe('ML');
      expect(result.formattedNumber).toBe('+223701234567');
    });

    it('should handle Canadian phone number', async () => {
      const result = await service.extractCountryFromWhatsApp('+14161234567');
      
      expect(result.isValid).toBe(true);
      expect(result.country).toBe('CA');
      expect(result.formattedNumber).toBe('+14161234567');
    });

    it('should handle US phone number', async () => {
      const result = await service.extractCountryFromWhatsApp('+12125551234');
      
      expect(result.isValid).toBe(true);
      expect(result.country).toBe('US');
      expect(result.formattedNumber).toBe('+12125551234');
    });

    it('should handle invalid phone number', async () => {
      const result = await service.extractCountryFromWhatsApp('invalid');
      
      expect(result.isValid).toBe(false);
      expect(result.country).toBe('');
      expect(result.formattedNumber).toBe('');
    });

    it('should handle empty phone number', async () => {
      const result = await service.extractCountryFromWhatsApp('');
      
      expect(result.isValid).toBe(false);
      expect(result.country).toBe('');
      expect(result.formattedNumber).toBe('');
    });
  });

  describe('checkPhoneNumberStatus', () => {
    it('should return exists false for non-existent phone number', async () => {
      userRepository.findOne.mockResolvedValue(null);
      
      const result = await service.checkPhoneNumberStatus('+221701234567');
      
      expect(result.exists).toBe(false);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { phoneNumber: '+221701234567' },
        relations: ['business'],
      });
    });

    it('should return owner status for existing owner', async () => {
      const mockBusiness = { id: 'business-1', name: 'Test Business' } as Business;
      const mockUser = {
        id: 'user-1',
        phoneNumber: '+221701234567',
        role: UserRole.OWNER,
        businessId: 'business-1',
        business: mockBusiness,
      } as User;

      userRepository.findOne.mockResolvedValue(mockUser);
      
      const result = await service.checkPhoneNumberStatus('+221701234567');
      
      expect(result.exists).toBe(true);
      expect(result.userType).toBe('owner');
      expect(result.businessName).toBe('Test Business');
      expect(result.businessId).toBe('business-1');
      expect(result.userId).toBe('user-1');
    });

    it('should return employee status for existing employee', async () => {
      const mockBusiness = { id: 'business-1', name: 'Test Business' } as Business;
      const mockUser = {
        id: 'user-1',
        phoneNumber: '+221701234567',
        role: UserRole.SELLER,
        businessId: 'business-1',
        business: mockBusiness,
      } as User;

      userRepository.findOne.mockResolvedValue(mockUser);
      
      const result = await service.checkPhoneNumberStatus('+221701234567');
      
      expect(result.exists).toBe(true);
      expect(result.userType).toBe('employee');
      expect(result.businessName).toBe('Test Business');
      expect(result.businessId).toBe('business-1');
      expect(result.userId).toBe('user-1');
    });
  });

  describe('validatePhoneNumberFormat', () => {
    it('should validate correct E.164 format', () => {
      expect(service.validatePhoneNumberFormat('+221701234567')).toBe(true);
      expect(service.validatePhoneNumberFormat('+223701234567')).toBe(true);
      expect(service.validatePhoneNumberFormat('+224701234567')).toBe(true);
      expect(service.validatePhoneNumberFormat('+14161234567')).toBe(true); // Canada
      expect(service.validatePhoneNumberFormat('+12125551234')).toBe(true); // US
    });

    it('should reject invalid formats', () => {
      expect(service.validatePhoneNumberFormat('221701234567')).toBe(false); // Missing +
      expect(service.validatePhoneNumberFormat('+221')).toBe(false); // Too short
      expect(service.validatePhoneNumberFormat('+2217012345678901234')).toBe(false); // Too long
      expect(service.validatePhoneNumberFormat('invalid')).toBe(false);
      expect(service.validatePhoneNumberFormat('')).toBe(false);
    });

    it('should handle Twilio WhatsApp format', () => {
      expect(service.validatePhoneNumberFormat('whatsapp:+221701234567')).toBe(true);
    });
  });

  describe('isFromCountry', () => {
    it('should correctly identify Burkina numbers', () => {
      expect(service.isFromCountry('+226701234567', 'BF')).toBe(true);
      expect(service.isFromCountry('+223701234567', 'SN')).toBe(false);
    });

    it('should correctly identify Mali numbers', () => {
      expect(service.isFromCountry('+223701234567', 'ML')).toBe(true);
      expect(service.isFromCountry('+221701234567', 'ML')).toBe(false);
    });

    it('should correctly identify Canadian numbers', () => {
      expect(service.isFromCountry('+14161234567', 'CA')).toBe(true);
      expect(service.isFromCountry('+12125551234', 'CA')).toBe(false);
    });

    it('should correctly identify US numbers', () => {
      expect(service.isFromCountry('+12125551234', 'US')).toBe(true);
      expect(service.isFromCountry('+14161234567', 'US')).toBe(false);
    });
  });

  describe('getCountryName', () => {
    it('should return correct country names', () => {
      expect(service.getCountryName('SN')).toBe('Sénégal');
      expect(service.getCountryName('ML')).toBe('Mali');
      expect(service.getCountryName('GN')).toBe('Guinée');
      expect(service.getCountryName('CI')).toBe('Côte d\'Ivoire');
      expect(service.getCountryName('CA')).toBe('Canada');
      expect(service.getCountryName('US')).toBe('United States');
    });

    it('should return country code for unknown countries', () => {
      expect(service.getCountryName('XX')).toBe('XX');
    });
  });
});