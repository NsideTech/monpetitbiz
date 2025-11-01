import { Test, TestingModule } from '@nestjs/testing';
import { ConversationStateService, RegistrationState } from '../conversation-state.service';

describe('ConversationStateService', () => {
  let service: ConversationStateService;
  const testPhoneNumber = '+226701234567';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConversationStateService],
    }).compile();

    service = module.get<ConversationStateService>(ConversationStateService);
  });

  afterEach(() => {
    // Clean up any states after each test
    service.clearState(testPhoneNumber);
  });

  describe('Basic State Management', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should return null for non-existent state', () => {
      const state = service.getState('non-existent');
      expect(state).toBeNull();
    });

    it('should set and get conversation state', () => {
      const step = 'type_selection';
      const data = { type: 'owner' };

      service.setState(testPhoneNumber, step, data);
      const state = service.getState(testPhoneNumber);

      expect(state).not.toBeNull();
      expect(state!.step).toBe(step);
      expect(state!.data).toEqual(data);
      expect(state!.createdAt).toBeInstanceOf(Date);
      expect(state!.expiresAt).toBeInstanceOf(Date);
    });

    it('should update existing state data', () => {
      service.setState(testPhoneNumber, 'business_info', { type: 'owner' });
      service.updateState(testPhoneNumber, { businessName: 'Test Business' });

      const state = service.getState(testPhoneNumber);
      expect(state!.data).toEqual({
        type: 'owner',
        businessName: 'Test Business',
      });
    });

    it('should clear conversation state', () => {
      service.setState(testPhoneNumber, 'type_selection');
      expect(service.getState(testPhoneNumber)).not.toBeNull();

      service.clearState(testPhoneNumber);
      expect(service.getState(testPhoneNumber)).toBeNull();
    });
  });

  describe('Registration State Management', () => {
    it('should detect registration flow correctly', () => {
      expect(service.isInRegistration(testPhoneNumber)).toBe(false);

      service.setState(testPhoneNumber, 'type_selection');
      expect(service.isInRegistration(testPhoneNumber)).toBe(true);

      service.setState(testPhoneNumber, 'non_registration_step');
      expect(service.isInRegistration(testPhoneNumber)).toBe(false);
    });

    it('should get registration state for registration steps', () => {
      const registrationData: Partial<RegistrationState> = {
        step: 'business_info',
        type: 'owner',
        businessName: 'Test Business',
      };

      service.setRegistrationState(testPhoneNumber, registrationData);
      const state = service.getRegistrationState(testPhoneNumber);

      expect(state).not.toBeNull();
      expect(state!.step).toBe('business_info');
      expect(state!.type).toBe('owner');
      expect(state!.businessName).toBe('Test Business');
    });

    it('should return null registration state for non-registration steps', () => {
      service.setState(testPhoneNumber, 'non_registration_step');
      const state = service.getRegistrationState(testPhoneNumber);
      expect(state).toBeNull();
    });

    it('should set registration state with step', () => {
      const registrationState: Partial<RegistrationState> = {
        step: 'employee_info',
        type: 'employee',
        businessCode: 'ABC123',
      };

      service.setRegistrationState(testPhoneNumber, registrationState);
      const state = service.getRegistrationState(testPhoneNumber);

      expect(state!.step).toBe('employee_info');
      expect(state!.type).toBe('employee');
      expect(state!.businessCode).toBe('ABC123');
    });

    it('should update registration state without changing step', () => {
      service.setRegistrationState(testPhoneNumber, {
        step: 'employee_info',
        type: 'employee',
      });

      service.setRegistrationState(testPhoneNumber, {
        businessCode: 'ABC123',
        employeeName: 'John Doe',
      });

      const state = service.getRegistrationState(testPhoneNumber);
      expect(state!.step).toBe('employee_info');
      expect(state!.type).toBe('employee');
      expect(state!.businessCode).toBe('ABC123');
      expect(state!.employeeName).toBe('John Doe');
    });
  });

  describe('State Expiration', () => {
    it('should handle expired states', async () => {
      // Create a service with very short expiration for testing
      const shortExpirationService = new ConversationStateService();
      // Override the expiration time for testing
      (shortExpirationService as any).EXPIRATION_TIME_MS = 100; // 100ms

      shortExpirationService.setState(testPhoneNumber, 'type_selection');
      expect(shortExpirationService.getState(testPhoneNumber)).not.toBeNull();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(shortExpirationService.getState(testPhoneNumber)).toBeNull();
      
      // Cleanup
      shortExpirationService.onModuleDestroy();
    });

    it('should update expiration time when updating state', async () => {
      service.setState(testPhoneNumber, 'business_info', { type: 'owner' });
      const initialState = service.getState(testPhoneNumber);
      const initialExpiration = initialState!.expiresAt;

      // Wait a bit then update
      await new Promise(resolve => setTimeout(resolve, 10));
      
      service.updateState(testPhoneNumber, { businessName: 'Test' });
      const updatedState = service.getState(testPhoneNumber);
      expect(updatedState!.expiresAt.getTime()).toBeGreaterThan(initialExpiration.getTime());
    });
  });

  describe('Utility Methods', () => {
    it('should return active conversation count', () => {
      expect(service.getActiveConversationCount()).toBe(0);

      service.setState(testPhoneNumber, 'type_selection');
      service.setState('+226701234568', 'business_info');

      expect(service.getActiveConversationCount()).toBe(2);

      service.clearState(testPhoneNumber);
      expect(service.getActiveConversationCount()).toBe(1);
    });

    it('should handle updateState for non-existent state gracefully', () => {
      // Should not throw error
      expect(() => {
        service.updateState('non-existent', { test: 'data' });
      }).not.toThrow();

      expect(service.getState('non-existent')).toBeNull();
    });
  });

  describe('Registration Step Detection', () => {
    const registrationSteps = [
      'type_selection',
      'phone_verification',
      'business_info',
      'employee_info',
      'role_selection',
    ];

    registrationSteps.forEach(step => {
      it(`should recognize ${step} as registration step`, () => {
        service.setState(testPhoneNumber, step);
        expect(service.isInRegistration(testPhoneNumber)).toBe(true);
      });
    });

    it('should not recognize non-registration steps', () => {
      const nonRegistrationSteps = [
        'menu',
        'transaction',
        'stock_check',
        'report_generation',
      ];

      nonRegistrationSteps.forEach(step => {
        service.setState(testPhoneNumber, step);
        expect(service.isInRegistration(testPhoneNumber)).toBe(false);
      });
    });
  });
});