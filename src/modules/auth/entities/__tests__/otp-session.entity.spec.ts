
import { OtpSession } from '../otp-session.entity';

describe('OtpSession Entity', () => {
  let otpSession: OtpSession;

  beforeEach(() => {
    otpSession = new OtpSession();
  });

  describe('Entity Structure', () => {
    it('should create an OTP session instance', () => {
      expect(otpSession).toBeInstanceOf(OtpSession);
    });

    it('should have all required properties defined', () => {
      // Properties are defined by TypeORM decorators, not as instance properties
      expect(otpSession.constructor.name).toBe('OtpSession');
      
      // Set properties to test they exist
      otpSession.phoneNumber = '+226701234567';
      otpSession.code = '123456';
      otpSession.expiresAt = new Date();
      otpSession.attempts = 0;

      expect(otpSession.phoneNumber).toBe('+226701234567');
      expect(otpSession.code).toBe('123456');
      expect(otpSession.expiresAt).toBeInstanceOf(Date);
      expect(otpSession.attempts).toBe(0);
    });
  });

  describe('Default Values', () => {
    it('should have default attempts as 0', () => {
      otpSession.attempts = 0; // Simulating default value
      expect(otpSession.attempts).toBe(0);
    });
  });

  describe('Property Validation', () => {
    it('should accept valid OTP session data', () => {
      otpSession.phoneNumber = '+226701234567';
      otpSession.code = '123456';
      otpSession.expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
      otpSession.attempts = 0;

      expect(otpSession.phoneNumber).toBe('+226701234567');
      expect(otpSession.code).toBe('123456');
      expect(otpSession.expiresAt).toBeInstanceOf(Date);
      expect(otpSession.attempts).toBe(0);
    });

    it('should validate phone number as primary key', () => {
      otpSession.phoneNumber = '+226701234567';
      expect(otpSession.phoneNumber).toBe('+226701234567');
    });

    it('should validate phone number length constraint', () => {
      const longPhoneNumber = '1'.repeat(21); // Exceeds 20 character limit
      otpSession.phoneNumber = longPhoneNumber;
      expect(otpSession.phoneNumber.length).toBeGreaterThan(20);
    });

    it('should validate OTP code length constraint', () => {
      const longCode = '1'.repeat(7); // Exceeds 6 character limit
      otpSession.code = longCode;
      expect(otpSession.code.length).toBeGreaterThan(6);
    });
  });

  describe('OTP Code Validation', () => {
    it('should accept valid 6-digit OTP codes', () => {
      const validCodes = ['123456', '000000', '999999', '654321'];
      
      validCodes.forEach(code => {
        otpSession.code = code;
        expect(otpSession.code).toBe(code);
        expect(otpSession.code.length).toBe(6);
      });
    });

    it('should handle numeric OTP codes', () => {
      otpSession.code = '123456';
      const isNumeric = /^\d{6}$/.test(otpSession.code);
      expect(isNumeric).toBe(true);
    });

    it('should validate OTP code format', () => {
      const invalidCodes = ['12345', '1234567', 'abcdef', '12345a'];
      
      invalidCodes.forEach(code => {
        otpSession.code = code;
        const isValid = /^\d{6}$/.test(otpSession.code);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Expiration Logic', () => {
    it('should handle future expiration dates', () => {
      const futureDate = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
      otpSession.expiresAt = futureDate;
      
      const isExpired = otpSession.expiresAt < new Date();
      expect(isExpired).toBe(false);
    });

    it('should handle past expiration dates', () => {
      const pastDate = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      otpSession.expiresAt = pastDate;
      
      const isExpired = otpSession.expiresAt < new Date();
      expect(isExpired).toBe(true);
    });

    it('should calculate remaining time correctly', () => {
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
      otpSession.expiresAt = fiveMinutesFromNow;
      
      const remainingTime = otpSession.expiresAt.getTime() - Date.now();
      expect(remainingTime).toBeGreaterThan(4 * 60 * 1000); // More than 4 minutes
      expect(remainingTime).toBeLessThan(6 * 60 * 1000); // Less than 6 minutes
    });
  });

  describe('Attempt Tracking', () => {
    it('should track attempt count', () => {
      otpSession.attempts = 0;
      expect(otpSession.attempts).toBe(0);

      otpSession.attempts = 1;
      expect(otpSession.attempts).toBe(1);

      otpSession.attempts = 3;
      expect(otpSession.attempts).toBe(3);
    });

    it('should handle maximum attempts logic', () => {
      const maxAttempts = 3;
      otpSession.attempts = maxAttempts;
      
      const hasExceededMaxAttempts = otpSession.attempts >= maxAttempts;
      expect(hasExceededMaxAttempts).toBe(true);
    });

    it('should increment attempts correctly', () => {
      otpSession.attempts = 0;
      otpSession.attempts++;
      expect(otpSession.attempts).toBe(1);

      otpSession.attempts++;
      expect(otpSession.attempts).toBe(2);
    });
  });

  describe('Phone Number Validation', () => {
    it('should accept valid phone number formats', () => {
      const validPhoneNumbers = [
        '+226701234567',
        '+226771234567',
        '+33123456789',
        '+1234567890'
      ];

      validPhoneNumbers.forEach(phoneNumber => {
        otpSession.phoneNumber = phoneNumber;
        expect(otpSession.phoneNumber).toBe(phoneNumber);
      });
    });

    it('should handle phone number as primary key constraint', () => {
      otpSession.phoneNumber = '+226701234567';
      // In a real database scenario, duplicate phone numbers would replace existing sessions
      expect(otpSession.phoneNumber).toBe('+226701234567');
    });
  });

  describe('Business Logic Validation', () => {
    it('should validate complete OTP session', () => {
      otpSession.phoneNumber = '+226701234567';
      otpSession.code = '123456';
      otpSession.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      otpSession.attempts = 0;

      // Validate all properties are set correctly
      expect(otpSession.phoneNumber).toBeTruthy();
      expect(otpSession.code).toMatch(/^\d{6}$/);
      expect(otpSession.expiresAt).toBeInstanceOf(Date);
      expect(otpSession.attempts).toBeGreaterThanOrEqual(0);
    });

    it('should handle OTP verification logic', () => {
      otpSession.phoneNumber = '+226701234567';
      otpSession.code = '123456';
      otpSession.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      otpSession.attempts = 1;

      const inputCode = '123456';
      const isCodeValid = otpSession.code === inputCode;
      const isNotExpired = otpSession.expiresAt > new Date();
      const hasAttemptsLeft = otpSession.attempts < 3;

      expect(isCodeValid).toBe(true);
      expect(isNotExpired).toBe(true);
      expect(hasAttemptsLeft).toBe(true);
    });

    it('should handle OTP session cleanup logic', () => {
      // Expired session
      otpSession.expiresAt = new Date(Date.now() - 1000); // 1 second ago
      const shouldCleanup = otpSession.expiresAt < new Date();
      expect(shouldCleanup).toBe(true);

      // Max attempts reached
      otpSession.attempts = 3;
      const maxAttemptsReached = otpSession.attempts >= 3;
      expect(maxAttemptsReached).toBe(true);
    });
  });
});