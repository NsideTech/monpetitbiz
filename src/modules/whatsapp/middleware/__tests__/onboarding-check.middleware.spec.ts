import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingCheckMiddleware } from '../onboarding-check.middleware';
import { AuthService } from '../../../auth/auth.service';
import { User, UserRole } from '../../../auth/entities/user.entity';
import { Business } from '../../../auth/entities/business.entity';

describe('OnboardingCheckMiddleware', () => {
  let middleware: OnboardingCheckMiddleware;
  let authService: jest.Mocked<AuthService>;

  const mockBusiness: Business = {
    id: 'business-1',
    name: 'Test Business',
    businessCode: 'TEST123',
    currency: 'XOF',
    timezone: 'Africa/Dakar',
    ownerName: 'Test Owner',
    country: 'SEN',
    users: [],
    transactions: [],
    stockItems: [],
    productUnits: [],
    stockMovements: [],
    createdAt: new Date(),
  };

  const mockOwnerUser: User = {
    id: 'user-1',
    phoneNumber: '+226123456789',
    businessId: 'business-1',
    role: UserRole.OWNER,
    language: 'fr',
    isActive: true,
    business: mockBusiness,
    employeeName: '',
    invitedBy: null,
    transactions: [],
    joinedAt: new Date(),
    createdAt: new Date(),
  };

  const mockEmployeeUser: User = {
    id: 'user-2',
    phoneNumber: '+226987654321',
    businessId: 'business-1',
    role: UserRole.SELLER,
    language: 'fr',
    isActive: true,
    business: mockBusiness,
    employeeName: 'Test Employee',
    invitedBy: null,
    transactions: [],
    joinedAt: new Date(),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockAuthService = {
      getUserByPhone: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingCheckMiddleware,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    middleware = module.get<OnboardingCheckMiddleware>(OnboardingCheckMiddleware);
    authService = module.get(AuthService);
  });

  describe('checkUserOnboardingStatus', () => {
    it('should return onboarded status for existing active owner', async () => {
      authService.getUserByPhone.mockResolvedValue(mockOwnerUser);

      const result = await middleware.checkUserOnboardingStatus('+226123456789');

      expect(result).toEqual({
        isOnboarded: true,
        userType: 'owner',
        businessName: 'Test Business',
        requiresOnboarding: false,
      });
    });

    it('should return onboarded status for existing active employee', async () => {
      authService.getUserByPhone.mockResolvedValue(mockEmployeeUser);

      const result = await middleware.checkUserOnboardingStatus('+226987654321');

      expect(result).toEqual({
        isOnboarded: true,
        userType: 'employee',
        businessName: 'Test Business',
        requiresOnboarding: false,
      });
    });

    it('should return not onboarded for non-existing user', async () => {
      authService.getUserByPhone.mockResolvedValue(null);

      const result = await middleware.checkUserOnboardingStatus('+226999999999');

      expect(result).toEqual({
        isOnboarded: false,
        requiresOnboarding: true,
      });
    });

    it('should return not onboarded for inactive user', async () => {
      const inactiveUser = { ...mockOwnerUser, isActive: false };
      authService.getUserByPhone.mockResolvedValue(inactiveUser);

      const result = await middleware.checkUserOnboardingStatus('+226123456789');

      expect(result).toEqual({
        isOnboarded: false,
        requiresOnboarding: true,
      });
    });

    it('should handle errors gracefully', async () => {
      authService.getUserByPhone.mockRejectedValue(new Error('Database error'));

      const result = await middleware.checkUserOnboardingStatus('+226123456789');

      expect(result).toEqual({
        isOnboarded: false,
        requiresOnboarding: true,
      });
    });
  });

  describe('isOnboardingAction', () => {
    it('should detect onboarding trigger phrases', () => {
      const onboardingMessages = [
        'créer une nouvelle entreprise',
        'nouvelle entreprise',
        'créer entreprise',
        'inscription',
        'commencer',
        'bonjour',
        'salut',
        'hello',
        'hi',
      ];

      onboardingMessages.forEach(message => {
        expect(middleware.isOnboardingAction(message)).toBe(true);
      });
    });

    it('should not detect non-onboarding messages', () => {
      const nonOnboardingMessages = [
        'vente 1000',
        'stock pain',
        'dépense 500',
        'bilan',
        'rapport',
      ];

      nonOnboardingMessages.forEach(message => {
        expect(middleware.isOnboardingAction(message)).toBe(false);
      });
    });

    it('should be case insensitive', () => {
      expect(middleware.isOnboardingAction('CRÉER UNE NOUVELLE ENTREPRISE')).toBe(true);
      expect(middleware.isOnboardingAction('Bonjour')).toBe(true);
      expect(middleware.isOnboardingAction('HELLO')).toBe(true);
    });
  });

  describe('generateOnboardingPrompt', () => {
    it('should return sale-specific prompt for sale attempts', async () => {
      const result = await middleware.generateOnboardingPrompt('+226123456789', 'vente 1000');
      
      expect(result).toContain('Pour enregistrer des ventes');
      expect(result).toContain('créer entreprise');
    });

    it('should return stock-specific prompt for stock attempts', async () => {
      const result = await middleware.generateOnboardingPrompt('+226123456789', 'stock pain');
      
      expect(result).toContain('Pour gérer votre stock');
      expect(result).toContain('créer entreprise');
    });

    it('should return expense-specific prompt for expense attempts', async () => {
      const result = await middleware.generateOnboardingPrompt('+226123456789', 'dépense 500');
      
      expect(result).toContain('Pour enregistrer des dépenses');
      expect(result).toContain('créer entreprise');
    });

    it('should return general prompt for unknown actions', async () => {
      const result = await middleware.generateOnboardingPrompt('+226123456789', 'unknown command');
      
      expect(result).toContain('Bienvenue !');
      expect(result).toContain('créer entreprise');
    });

    it('should return general prompt when no action provided', async () => {
      const result = await middleware.generateOnboardingPrompt('+226123456789');
      
      expect(result).toContain('Bienvenue !');
      expect(result).toContain('créer entreprise');
    });
  });

  describe('canExecuteAction', () => {
    it('should allow action for onboarded users', async () => {
      authService.getUserByPhone.mockResolvedValue(mockOwnerUser);

      const result = await middleware.canExecuteAction('+226123456789', 'vente 1000');

      expect(result).toEqual({ allowed: true });
    });

    it('should allow onboarding actions for non-onboarded users', async () => {
      authService.getUserByPhone.mockResolvedValue(null);

      const result = await middleware.canExecuteAction('+226999999999', 'créer entreprise');

      expect(result).toEqual({ allowed: true });
    });

    it('should deny business actions for non-onboarded users', async () => {
      authService.getUserByPhone.mockResolvedValue(null);

      const result = await middleware.canExecuteAction('+226999999999', 'vente 1000');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('User not onboarded');
      expect(result.onboardingPrompt).toContain('Pour enregistrer des ventes');
    });
  });

  describe('interceptMessage', () => {
    it('should allow processing for onboarded users', async () => {
      authService.getUserByPhone.mockResolvedValue(mockOwnerUser);

      const result = await middleware.interceptMessage('+226123456789', 'vente 1000');

      expect(result).toEqual({ shouldProcess: true });
    });

    it('should allow processing for onboarding actions', async () => {
      authService.getUserByPhone.mockResolvedValue(null);

      const result = await middleware.interceptMessage('+226999999999', 'créer entreprise');

      expect(result).toEqual({ shouldProcess: true });
    });

    it('should block processing and provide onboarding prompt for non-onboarded users', async () => {
      authService.getUserByPhone.mockResolvedValue(null);

      const result = await middleware.interceptMessage('+226999999999', 'vente 1000');

      expect(result.shouldProcess).toBe(false);
      expect(result.response).toContain('Pour enregistrer des ventes');
      expect(result.redirectToOnboarding).toBe(true);
    });

    it('should handle errors gracefully and provide onboarding prompt for business actions', async () => {
      authService.getUserByPhone.mockRejectedValue(new Error('Database error'));

      const result = await middleware.interceptMessage('+226123456789', 'vente 1000');

      expect(result.shouldProcess).toBe(false);
      expect(result.response).toContain('Pour enregistrer des ventes');
      expect(result.redirectToOnboarding).toBe(true);
    });

    it('should handle errors gracefully and allow onboarding actions', async () => {
      authService.getUserByPhone.mockRejectedValue(new Error('Database error'));

      const result = await middleware.interceptMessage('+226123456789', 'créer entreprise');

      expect(result).toEqual({ shouldProcess: true });
    });
  });
});