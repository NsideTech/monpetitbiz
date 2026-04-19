import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportSchedulerService } from '../report-scheduler.service';
import { ReportService } from '../../report.service';
import { WhatsappService } from '../../../whatsapp/whatsapp.service';
import { Business } from '../../../auth/entities/business.entity';
import { User, UserRole } from '../../../auth/entities/user.entity';
import { BalanceReport, ReportPeriod } from '../../dto/report.dto';

describe('ReportSchedulerService', () => {
  let service: ReportSchedulerService;
  let businessRepository: Repository<Business>;
  let userRepository: Repository<User>;
  let reportService: ReportService;
  let whatsappService: WhatsappService;

  const mockBusiness: Business = {
    id: 'business-1',
    name: 'Test Business',
    businessCode: 'GHI789',
    currency: 'XOF',
    timezone: 'Africa/Dakar',
    ownerName: 'Test Owner',
    country: 'SEN',
    city: null,
    activityType: null,
    preferredChannel: 'whatsapp',
    isActive: true,
    deletedAt: null,
    createdAt: new Date(),
    users: [],
    transactions: [],
    stockItems: [],
    productUnits: [],
    stockMovements: [],
  };

  const mockUser: User = {
    id: 'user-1',
    phoneNumber: '+226701234567',
    employeeName: null,
    businessId: 'business-1',
    role: UserRole.OWNER,
    language: 'fr',
    isActive: true,
    invitedBy: null,
    joinedAt: null,
    createdAt: new Date(),
    business: mockBusiness,
    transactions: [],
  };

  const mockReport: BalanceReport = {
    period: 'Test Period',
    startDate: new Date(),
    endDate: new Date(),
    totalSales: 50000,
    totalExpenses: 20000,
    netProfit: 30000,
    transactionCount: 10,
    salesCount: 7,
    expenseCount: 3,
    currency: 'XOF',
    topProducts: [
      { product: 'Pain', revenue: 25000, quantity: 50, transactionCount: 5 }
    ]
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportSchedulerService,
        {
          provide: getRepositoryToken(Business),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: ReportService,
          useValue: {
            generateDailyReport: jest.fn(),
          },
        },
        {
          provide: WhatsappService,
          useValue: {
            sendMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReportSchedulerService>(ReportSchedulerService);
    businessRepository = module.get<Repository<Business>>(getRepositoryToken(Business));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    reportService = module.get<ReportService>(ReportService);
    whatsappService = module.get<WhatsappService>(WhatsappService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateAndSendDailyReport', () => {
    it('should generate and send daily report successfully', async () => {
      // Arrange
      const businessWithUsers = { ...mockBusiness, users: [mockUser] };
      jest.spyOn(reportService, 'generateDailyReport').mockResolvedValue(mockReport);
      jest.spyOn(whatsappService, 'sendMessage').mockResolvedValue();

      // Act
      await service.generateAndSendDailyReport(businessWithUsers);

      // Assert
      expect(reportService.generateDailyReport).toHaveBeenCalledWith('business-1');
      expect(whatsappService.sendMessage).toHaveBeenCalledWith(
        '+226701234567',
        expect.stringMatching(/Rapport quotidien/),
        'twilio'
      );
    });

    it('should handle business with no activity', async () => {
      // Arrange
      const noActivityReport = { ...mockReport, transactionCount: 0, salesCount: 0, expenseCount: 0 };
      const businessWithUsers = { ...mockBusiness, users: [mockUser] };
      jest.spyOn(reportService, 'generateDailyReport').mockResolvedValue(noActivityReport);
      jest.spyOn(whatsappService, 'sendMessage').mockResolvedValue();

      // Act
      await service.generateAndSendDailyReport(businessWithUsers);

      // Assert
      expect(whatsappService.sendMessage).toHaveBeenCalledWith(
        '+226701234567',
        expect.stringMatching(/Aucune activité aujourd'hui/),
        'twilio'
      );
    });

    it('should skip business with no active owners', async () => {
      // Arrange
      const businessWithNoOwners = { ...mockBusiness, users: [] };
      jest.spyOn(reportService, 'generateDailyReport').mockResolvedValue(mockReport);
      const sendMessageSpy = jest.spyOn(whatsappService, 'sendMessage');

      // Act
      await service.generateAndSendDailyReport(businessWithNoOwners);

      // Assert
      expect(sendMessageSpy).not.toHaveBeenCalled();
    });
  });

  describe('triggerDailyReportForBusiness', () => {
    it('should trigger daily report for specific business', async () => {
      // Arrange
      const businessWithUsers = { ...mockBusiness, users: [mockUser] };
      jest.spyOn(businessRepository, 'findOne').mockResolvedValue(businessWithUsers);
      jest.spyOn(reportService, 'generateDailyReport').mockResolvedValue(mockReport);
      jest.spyOn(whatsappService, 'sendMessage').mockResolvedValue();

      // Act
      await service.triggerDailyReportForBusiness('business-1');

      // Assert
      expect(businessRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'business-1' },
        relations: ['users'],
      });
      expect(reportService.generateDailyReport).toHaveBeenCalledWith('business-1');
    });

    it('should throw error for non-existent business', async () => {
      // Arrange
      jest.spyOn(businessRepository, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(service.triggerDailyReportForBusiness('non-existent')).rejects.toThrow(
        'Business with ID non-existent not found'
      );
    });
  });

  describe('getSchedulerStatus', () => {
    it('should return scheduler status', () => {
      // Act
      const status = service.getSchedulerStatus();

      // Assert
      expect(status).toEqual({
        isActive: true,
        nextRunTime: expect.any(String),
        timezone: 'UTC (checks all business timezones)',
      });
    });
  });
});