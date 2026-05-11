import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RulesEngineService } from '../services/rules-engine.service';
import { Notification, NotificationType } from '../entities/notification.entity';
import { Transaction, TransactionType } from '../../transaction/entities/transaction.entity';
import { Business } from '../../auth/entities/business.entity';
import { User, UserRole } from '../../auth/entities/user.entity';
import { NotificationSenderService } from '../services/notification-sender.service';
import { DailyGoalService } from '../../dashboard/services/daily-goal.service';

const makeRepo = (overrides = {}) => ({
  count: jest.fn().mockResolvedValue(0),
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  ...overrides,
});

const mockSender = () => ({ createAndSend: jest.fn().mockResolvedValue({}) });
const mockGoalService = () => ({
  getTodayGoalWithProgress: jest.fn().mockResolvedValue({ isReached: false, goal: null }),
});

const owner: Partial<User> = {
  id: 'user-owner',
  phoneNumber: '+22670000001',
  role: UserRole.OWNER,
  isActive: true,
  businessId: 'biz-1',
};

const business: Partial<Business> = {
  id: 'biz-1',
  isActive: true,
  currency: 'XOF',
  timezone: 'Africa/Dakar',
};

describe('RulesEngineService', () => {
  let service: RulesEngineService;
  let notifRepo: ReturnType<typeof makeRepo>;
  let transactionRepo: ReturnType<typeof makeRepo>;
  let businessRepo: ReturnType<typeof makeRepo>;
  let userRepo: ReturnType<typeof makeRepo>;
  let sender: jest.Mocked<NotificationSenderService>;
  let goalService: jest.Mocked<DailyGoalService>;

  beforeEach(async () => {
    notifRepo = makeRepo();
    transactionRepo = makeRepo();
    businessRepo = makeRepo({ find: jest.fn().mockResolvedValue([business]), findOne: jest.fn().mockResolvedValue(business) });
    userRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(owner) });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RulesEngineService,
        { provide: getRepositoryToken(Notification), useValue: notifRepo },
        { provide: getRepositoryToken(Transaction), useValue: transactionRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: NotificationSenderService, useFactory: mockSender },
        { provide: DailyGoalService, useFactory: mockGoalService },
      ],
    }).compile();

    service = module.get(RulesEngineService);
    sender = module.get(NotificationSenderService);
    goalService = module.get(DailyGoalService);
  });

  describe('checkInactivityForAllBusinesses', () => {
    it('envoie un rappel si aucune vente aujourd\'hui', async () => {
      transactionRepo.count.mockResolvedValue(0);

      await service.checkInactivityForAllBusinesses();

      expect(sender.createAndSend).toHaveBeenCalledWith(
        'biz-1',
        'user-owner',
        NotificationType.INACTIVITY_REMINDER,
        expect.stringContaining("n'avez pas encore enregistré"),
        '+22670000001',
      );
    });

    it('n\'envoie pas si des ventes existent aujourd\'hui', async () => {
      notifRepo.count.mockResolvedValue(0);
      transactionRepo.count.mockResolvedValue(3);

      await service.checkInactivityForAllBusinesses();

      expect(sender.createAndSend).not.toHaveBeenCalled();
    });

    it('n\'envoie pas si déjà envoyé dans les 20 dernières heures', async () => {
      notifRepo.count.mockResolvedValue(1);

      await service.checkInactivityForAllBusinesses();

      expect(sender.createAndSend).not.toHaveBeenCalled();
    });
  });

  describe('checkActivityDropForAllBusinesses', () => {
    it('envoie une alerte si CA du jour < 60% de la moyenne des 7 derniers jours', async () => {
      notifRepo.count.mockResolvedValue(0);
      transactionRepo.find
        .mockResolvedValueOnce([{ amount: 5000, createdAt: new Date() }])   // today
        .mockResolvedValueOnce(
          Array(7).fill(null).map(() => ({ amount: 20000, createdAt: new Date() })), // last 7 days
        );

      await service.checkActivityDropForAllBusinesses();

      expect(sender.createAndSend).toHaveBeenCalledWith(
        'biz-1',
        'user-owner',
        NotificationType.ACTIVITY_DROP_ALERT,
        expect.stringContaining('en baisse'),
        '+22670000001',
      );
    });

    it('n\'envoie pas si CA du jour >= 60% de la moyenne', async () => {
      notifRepo.count.mockResolvedValue(0);
      transactionRepo.find
        .mockResolvedValueOnce([{ amount: 14000, createdAt: new Date() }])  // today
        .mockResolvedValueOnce(
          Array(7).fill(null).map(() => ({ amount: 20000, createdAt: new Date() })),
        );

      await service.checkActivityDropForAllBusinesses();

      expect(sender.createAndSend).not.toHaveBeenCalled();
    });
  });

  describe('evaluateGoalRule', () => {
    it('envoie un message si l\'objectif est atteint', async () => {
      notifRepo.count.mockResolvedValue(0);
      transactionRepo.find.mockResolvedValue([{ amount: 20000, createdAt: new Date() }]);
      goalService.getTodayGoalWithProgress.mockResolvedValue({
        isReached: true,
        goal: { targetAmount: 20000 } as any,
        progress: 20000,
        progressPercent: 100,
      });

      await service.evaluateGoalRule('biz-1', 'user-owner');

      expect(sender.createAndSend).toHaveBeenCalledWith(
        'biz-1',
        'user-owner',
        NotificationType.GOAL_REACHED,
        expect.stringContaining('Objectif du jour atteint'),
        '+22670000001',
      );
    });

    it('n\'envoie pas si l\'objectif n\'est pas atteint', async () => {
      notifRepo.count.mockResolvedValue(0);
      transactionRepo.find.mockResolvedValue([{ amount: 5000, createdAt: new Date() }]);
      goalService.getTodayGoalWithProgress.mockResolvedValue({
        isReached: false,
        goal: { targetAmount: 20000 } as any,
        progress: 5000,
        progressPercent: 25,
      });

      await service.evaluateGoalRule('biz-1', 'user-owner');

      expect(sender.createAndSend).not.toHaveBeenCalled();
    });
  });

  describe('checkRegularityForAllBusinesses', () => {
    it('envoie un signal si >= 5 jours actifs sur 7', async () => {
      notifRepo.count.mockResolvedValue(0);
      const dates = ['2026-04-18', '2026-04-19', '2026-04-20', '2026-04-21', '2026-04-22'];
      transactionRepo.find.mockResolvedValue(
        dates.map((d) => ({ amount: 1000, createdAt: new Date(d) })),
      );

      await service.checkRegularityForAllBusinesses();

      expect(sender.createAndSend).toHaveBeenCalledWith(
        'biz-1',
        'user-owner',
        NotificationType.REGULARITY_SIGNAL,
        expect.stringContaining("jours d'enregistrement"),
        '+22670000001',
      );
    });

    it('n\'envoie pas si < 5 jours actifs', async () => {
      notifRepo.count.mockResolvedValue(0);
      const dates = ['2026-04-18', '2026-04-19', '2026-04-20'];
      transactionRepo.find.mockResolvedValue(
        dates.map((d) => ({ amount: 1000, createdAt: new Date(d) })),
      );

      await service.checkRegularityForAllBusinesses();

      expect(sender.createAndSend).not.toHaveBeenCalled();
    });
  });
});
