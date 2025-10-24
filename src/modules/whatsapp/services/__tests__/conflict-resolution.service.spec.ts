import { Test, TestingModule } from '@nestjs/testing';
import { ConflictResolutionService } from '../conflict-resolution.service';
import { PhoneValidationService } from '../../../auth/services/phone-validation.service';

describe('ConflictResolutionService', () => {
  let service: ConflictResolutionService;
  let phoneValidationService: jest.Mocked<PhoneValidationService>;

  beforeEach(async () => {
    const mockPhoneValidationService = {
      checkPhoneNumberStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConflictResolutionService,
        {
          provide: PhoneValidationService,
          useValue: mockPhoneValidationService,
        },
      ],
    }).compile();

    service = module.get<ConflictResolutionService>(ConflictResolutionService);
    phoneValidationService = module.get(PhoneValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkAndResolveConflict', () => {
    it('should return no conflict when phone number does not exist', async () => {
      phoneValidationService.checkPhoneNumberStatus.mockResolvedValue({
        exists: false,
      });

      const result = await service.checkAndResolveConflict('+221701234567');

      expect(result.conflictType).toBe('no_conflict');
      expect(result.canProceed).toBe(true);
      expect(result.message).toBe('');
    });

    it('should handle existing owner conflict', async () => {
      phoneValidationService.checkPhoneNumberStatus.mockResolvedValue({
        exists: true,
        userType: 'owner',
        businessName: 'Test Business',
        businessId: 'test-id',
      });

      const result = await service.checkAndResolveConflict('+221701234567');

      expect(result.conflictType).toBe('owner_exists');
      expect(result.canProceed).toBe(false);
      expect(result.message).toContain('Vous possédez déjà une entreprise');
      expect(result.businessName).toBe('Test Business');
    });

    it('should handle existing employee conflict', async () => {
      phoneValidationService.checkPhoneNumberStatus.mockResolvedValue({
        exists: true,
        userType: 'employee',
        businessName: 'Test Business',
        businessId: 'test-id',
      });

      const result = await service.checkAndResolveConflict('+221701234567');

      expect(result.conflictType).toBe('employee_exists');
      expect(result.canProceed).toBe(true);
      expect(result.message).toContain('Vous êtes déjà employé');
      expect(result.businessName).toBe('Test Business');
    });
  });

  describe('processEmployeeChoice', () => {
    it('should handle create business choice', async () => {
      const result = await service.processEmployeeChoice('+221701234567', 'nouvelle entreprise');

      expect(result.shouldProceed).toBe(true);
      expect(result.action).toBe('create_business');
      expect(result.message).toContain('Parfait !');
    });

    it('should handle stay employee choice', async () => {
      const result = await service.processEmployeeChoice('+221701234567', 'rester employé');

      expect(result.shouldProceed).toBe(false);
      expect(result.action).toBe('stay_employee');
      expect(result.message).toContain('Choix confirmé');
    });

    it('should handle invalid choice', async () => {
      const result = await service.processEmployeeChoice('+221701234567', 'invalid choice');

      expect(result.shouldProceed).toBe(false);
      expect(result.action).toBe('invalid_choice');
      expect(result.message).toContain('Choix non reconnu');
    });
  });

  describe('isConflictHelpRequest', () => {
    it('should detect help requests', () => {
      expect(service.isConflictHelpRequest('aide')).toBe(true);
      expect(service.isConflictHelpRequest('help')).toBe(true);
      expect(service.isConflictHelpRequest('pourquoi')).toBe(true);
      expect(service.isConflictHelpRequest('comment')).toBe(true);
      expect(service.isConflictHelpRequest('normal message')).toBe(false);
    });
  });

  describe('getConflictHelpMessage', () => {
    it('should return owner help message', () => {
      const message = service.getConflictHelpMessage('owner_exists');
      expect(message).toContain('Propriétaire existant');
      expect(message).toContain('Pourquoi ne puis-je pas créer');
    });

    it('should return employee help message', () => {
      const message = service.getConflictHelpMessage('employee_exists');
      expect(message).toContain('Employé existant');
      expect(message).toContain('Bonne nouvelle');
    });
  });
});