import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DailyGoalService } from '../services/daily-goal.service';
import { DailyGoal } from '../entities/daily-goal.entity';

describe('DailyGoalService', () => {
  let service: DailyGoalService;

  const mockDailyGoalRepository = {
    update: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyGoalService,
        {
          provide: getRepositoryToken(DailyGoal),
          useValue: mockDailyGoalRepository,
        },
      ],
    }).compile();

    service = module.get<DailyGoalService>(DailyGoalService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // upsertGoal
  // ---------------------------------------------------------------------------
  describe('upsertGoal', () => {
    it('should deactivate existing active goal then create a new one', async () => {
      const businessId = 'business-uuid-1';
      const targetAmount = 50000;

      const savedGoal: Partial<DailyGoal> = {
        id: 'goal-uuid-1',
        businessId,
        targetAmount,
        dayOfWeek: null,
        isActive: true,
        createdAt: new Date(),
      };

      mockDailyGoalRepository.update.mockResolvedValue({ affected: 1 });
      mockDailyGoalRepository.create.mockReturnValue(savedGoal);
      mockDailyGoalRepository.save.mockResolvedValue(savedGoal);

      const result = await service.upsertGoal(businessId, targetAmount, null);

      // Should deactivate existing goals without dayOfWeek filter (null = tous les jours)
      expect(mockDailyGoalRepository.update).toHaveBeenCalledWith(
        { businessId, isActive: true },
        { isActive: false },
      );
      expect(mockDailyGoalRepository.create).toHaveBeenCalledWith({
        businessId,
        targetAmount,
        dayOfWeek: null,
        isActive: true,
      });
      expect(mockDailyGoalRepository.save).toHaveBeenCalled();
      expect(result).toEqual(savedGoal);
    });

    it('should include dayOfWeek in the where clause when provided', async () => {
      const businessId = 'business-uuid-1';
      const targetAmount = 30000;
      const dayOfWeek = 1; // lundi

      const savedGoal: Partial<DailyGoal> = {
        id: 'goal-uuid-2',
        businessId,
        targetAmount,
        dayOfWeek,
        isActive: true,
        createdAt: new Date(),
      };

      mockDailyGoalRepository.update.mockResolvedValue({ affected: 0 });
      mockDailyGoalRepository.create.mockReturnValue(savedGoal);
      mockDailyGoalRepository.save.mockResolvedValue(savedGoal);

      await service.upsertGoal(businessId, targetAmount, dayOfWeek);

      expect(mockDailyGoalRepository.update).toHaveBeenCalledWith(
        { businessId, dayOfWeek, isActive: true },
        { isActive: false },
      );
    });

    it('should throw BadRequestException when targetAmount is zero', async () => {
      await expect(service.upsertGoal('business-uuid-1', 0, null)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockDailyGoalRepository.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when targetAmount is negative', async () => {
      await expect(service.upsertGoal('business-uuid-1', -100, null)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockDailyGoalRepository.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getTodayGoalWithProgress
  // ---------------------------------------------------------------------------
  describe('getTodayGoalWithProgress', () => {
    it('should return goal with correct progress when goal exists', async () => {
      const businessId = 'business-uuid-1';
      const todaySales = 30000;
      const targetAmount = 50000;

      const mockGoal: Partial<DailyGoal> = {
        id: 'goal-uuid-1',
        businessId,
        targetAmount,
        dayOfWeek: null,
        isActive: true,
        createdAt: new Date(),
      };

      mockDailyGoalRepository.find.mockResolvedValue([mockGoal]);

      const result = await service.getTodayGoalWithProgress(businessId, todaySales);

      expect(result.goal).toEqual(mockGoal);
      expect(result.progress).toBe(todaySales);
      expect(result.progressPercent).toBe(60); // 30000/50000 * 100 = 60
      expect(result.isReached).toBe(false);
    });

    it('should mark isReached=true when todaySales meets or exceeds target', async () => {
      const businessId = 'business-uuid-1';
      const targetAmount = 50000;
      const todaySales = 50000; // exact

      const mockGoal: Partial<DailyGoal> = {
        id: 'goal-uuid-1',
        businessId,
        targetAmount,
        dayOfWeek: null,
        isActive: true,
        createdAt: new Date(),
      };

      mockDailyGoalRepository.find.mockResolvedValue([mockGoal]);

      const result = await service.getTodayGoalWithProgress(businessId, todaySales);

      expect(result.isReached).toBe(true);
      expect(result.progressPercent).toBe(100);
    });

    it('should mark isReached=true when todaySales exceeds target', async () => {
      const businessId = 'business-uuid-1';
      const targetAmount = 50000;
      const todaySales = 65000;

      const mockGoal: Partial<DailyGoal> = {
        id: 'goal-uuid-1',
        businessId,
        targetAmount,
        dayOfWeek: null,
        isActive: true,
        createdAt: new Date(),
      };

      mockDailyGoalRepository.find.mockResolvedValue([mockGoal]);

      const result = await service.getTodayGoalWithProgress(businessId, todaySales);

      expect(result.isReached).toBe(true);
      expect(result.progressPercent).toBe(130); // 65000/50000 * 100
    });

    it('should return null goal with zero progressPercent when no active goal exists', async () => {
      const businessId = 'business-uuid-1';
      const todaySales = 20000;

      mockDailyGoalRepository.find.mockResolvedValue([]);

      const result = await service.getTodayGoalWithProgress(businessId, todaySales);

      expect(result.goal).toBeNull();
      expect(result.progress).toBe(todaySales);
      expect(result.progressPercent).toBe(0);
      expect(result.isReached).toBe(false);
    });

    it('should return progressPercent=0 when goal has targetAmount=0 (guard against division by zero)', async () => {
      const businessId = 'business-uuid-1';
      const todaySales = 10000;

      // Simulate a corrupted record with targetAmount=0 (should not exist thanks to upsert guard,
      // but the service must not throw NaN)
      const mockGoal: Partial<DailyGoal> = {
        id: 'goal-uuid-1',
        businessId,
        targetAmount: 0,
        dayOfWeek: null,
        isActive: true,
        createdAt: new Date(),
      };

      mockDailyGoalRepository.find.mockResolvedValue([mockGoal]);

      const result = await service.getTodayGoalWithProgress(businessId, todaySales);

      expect(result.progressPercent).toBe(0);
      expect(Number.isNaN(result.progressPercent)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // getTodayGoal (internal — tested via getTodayGoalWithProgress, but also directly)
  // ---------------------------------------------------------------------------
  describe('getTodayGoal', () => {
    it('should prioritize day-specific goal over catch-all (dayOfWeek=null)', async () => {
      const businessId = 'business-uuid-1';
      const specificGoal: Partial<DailyGoal> = {
        id: 'goal-specific',
        businessId,
        targetAmount: 80000,
        dayOfWeek: new Date().getDay(), // today
        isActive: true,
        createdAt: new Date(),
      };

      // find() returns specific goal first (orderBy DESC puts non-null dayOfWeek first)
      mockDailyGoalRepository.find.mockResolvedValue([specificGoal]);

      const result = await service.getTodayGoal(businessId);

      expect(result).toEqual(specificGoal);
    });

    it('should return null when no active goal exists', async () => {
      mockDailyGoalRepository.find.mockResolvedValue([]);

      const result = await service.getTodayGoal('business-uuid-1');

      expect(result).toBeNull();
    });
  });
});
