import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationHandlerService } from '../registration-handler.service';
import { OnboardingMessagesService } from '../onboarding-messages.service';
import { ConversationStateService } from '../conversation-state.service';
import { AuthService } from '../../../auth/auth.service';
import { NLPService } from '../nlp.service';
import { ConflictResolutionService } from '../conflict-resolution.service';

describe('Bug Reproduction - Exact User Scenario', () => {
    let registrationHandler: RegistrationHandlerService;
    let conversationState: ConversationStateService;

    const testPhoneNumber = '+226701234567';

    beforeEach(async () => {
        const mockAuthService = {
            registerBusinessOwner: jest.fn().mockResolvedValue({
                user: {
                    id: 1,
                    phoneNumber: testPhoneNumber,
                    business: {
                        businessCode: 'ABC123',
                        name: 'Test Business',
                        country: 'SN'
                    }
                },
                accessToken: 'test-token'
            }),
        };

        const mockConversationStateService = {
            getRegistrationState: jest.fn(),
            setRegistrationState: jest.fn(),
            updateState: jest.fn(),
            clearState: jest.fn(),
            isStateExpired: jest.fn().mockReturnValue(false),
            isInRegistration: jest.fn(),
        };

        const mockNLPService = {};

        const mockConflictResolutionService = {
            checkAndResolveConflict: jest.fn().mockResolvedValue({
                conflictType: 'none',
                message: ''
            }),
            isConflictHelpRequest: jest.fn().mockReturnValue(false),
            getConflictHelpMessage: jest.fn(),
            processEmployeeChoice: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RegistrationHandlerService,
                OnboardingMessagesService,
                {
                    provide: ConversationStateService,
                    useValue: mockConversationStateService,
                },
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
                {
                    provide: NLPService,
                    useValue: mockNLPService,
                },
                {
                    provide: ConflictResolutionService,
                    useValue: mockConflictResolutionService,
                },
            ],
        }).compile();

        registrationHandler = module.get<RegistrationHandlerService>(RegistrationHandlerService);
        conversationState = module.get<ConversationStateService>(ConversationStateService);
    });

    it('should reproduce the exact bug scenario described by user', async () => {
        // User scenario:
        // 1. User types: "créer une nouvelle entreprise"
        // 2. Gets: "Réponse non reconnue" + type selection message
        // 3. User types: "1"
        // 4. Gets: Welcome message asking to type "créer une nouvelle entreprise" again

        // Step 1: User types "créer une nouvelle entreprise"
        (conversationState.getRegistrationState as jest.Mock).mockReturnValue(null);
        
        const step1Response = await registrationHandler.handleRegistrationMessage(
            testPhoneNumber, 
            'créer une nouvelle entreprise'
        );

        console.log('=== STEP 1: User types "créer une nouvelle entreprise" ===');
        console.log('Response:', step1Response.message);
        console.log('Next step:', step1Response.nextStep);
        console.log('');

        // This should NOT show "Réponse non reconnue" anymore
        expect(step1Response.message).not.toContain('Réponse non reconnue');
        expect(step1Response.message).toContain('CRÉATION D\'UNE NOUVELLE ENTREPRISE');
        expect(step1Response.nextStep).toBe('merchant_onboarding_start');

        // Step 2: User types "1" (should be accepted as confirmation)
        (conversationState.getRegistrationState as jest.Mock).mockReturnValue({
            step: 'merchant_onboarding_start',
            type: 'merchant',
            phoneNumber: testPhoneNumber
        });

        const step2Response = await registrationHandler.handleRegistrationMessage(
            testPhoneNumber, 
            '1'
        );

        console.log('=== STEP 2: User types "1" ===');
        console.log('Response:', step2Response.message);
        console.log('Next step:', step2Response.nextStep);
        console.log('');

        // This should NOT ask to type "créer une nouvelle entreprise" again
        expect(step2Response.message).not.toContain('créer une nouvelle entreprise');
        expect(step2Response.message).toContain('NOM DE L\'ENTREPRISE');
        expect(step2Response.nextStep).toBe('merchant_business_name');

        console.log('✅ Bug is FIXED! The flow now works correctly.');
    });

    it('should also accept traditional confirmation words', async () => {
        // Test that "continuer" and "oui" still work
        (conversationState.getRegistrationState as jest.Mock).mockReturnValue({
            step: 'merchant_onboarding_start',
            type: 'merchant',
            phoneNumber: testPhoneNumber
        });

        const responses = ['continuer', 'oui', 'ok'];
        
        for (const word of responses) {
            const response = await registrationHandler.handleRegistrationMessage(
                testPhoneNumber, 
                word
            );

            expect(response.nextStep).toBe('merchant_business_name');
            expect(response.message).toContain('NOM DE L\'ENTREPRISE');
        }
    });
});