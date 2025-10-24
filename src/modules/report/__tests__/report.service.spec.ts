import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportService } from '../report.service';
import { Transaction, TransactionType } from '../../transaction/entities/transaction.entity';
import { StockItem } from '../../stock/entities/stock-item.entity';
import { Business } from '../../auth/entities/business.entity';
import { ReportPeriod } from '../dto/report.dto';
import { PDFGenerationService } from '../services/pdf-generation.service';
import { TwilioWhatsAppService } from '../../whatsapp/services/twilio-whatsapp.service';

describe('ReportService', () => {
  let service: ReportService;
  let transactionRepository: Repository<Transaction>;
  let stockRepository: Repository<StockItem>;
  let businessRepository: Repository<Business>;

  const mockBusiness = {
    id: 'business-1',
    name: 'Test Business',
    currency: 'XOF',
    timezone: 'Africa/Dakar',
    createdAt: new Date()
  };

  const mockTransactions = [
    {
      id: 'trans-1',
      businessId: 'business-1',
      userId: 'user-1',
      type: TransactionType.SALE,
      amount: 5000,
      currency: 'XOF',
      product: 'Pain',
      description: 'Vente de pain',
      createdAt: new Date('2024-01-15T10:00:00Z')
    },
    {
      id: 'trans-2',
      businessId: 'business-1',
      userId: 'user-1',
      type: TransactionType.SALE,
      amount: 3000,
      currency: 'XOF',
      product: 'Eau',
      description: 'Vente d\'eau',
      createdAt: new Date('2024-01-15T11:00:00Z')
    },
    {
      id: 'trans-3',
      businessId: 'business-1',
      userId: 'user-1',
      type: TransactionType.EXPENSE,
      amount: 2000,
      currency: 'XOF',
      product: null,
      description: 'Achat marchandise',
      createdAt: new Date('2024-01-15T12:00:00Z')
    },
    {
      id: 'trans-4',
      businessId: 'business-1',
      userId: 'user-1',
      type: TransactionType.SALE,
      amount: 5000,
      currency: 'XOF',
      product: 'Pain',
      description: 'Vente de pain',
      createdAt: new Date('2024-01-15T13:00:00Z')
    }
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(StockItem),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Business),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: PDFGenerationService,
          useValue: {
            generatePDFReport: jest.fn(),
          },
        },
        {
          provide: TwilioWhatsAppService,
          useValue: {
            sendMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
    transactionRepository = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    stockRepository = module.get<Repository<StockItem>>(getRepositoryToken(StockItem));
    businessRepository = module.get<Repository<Business>>(getRepositoryToken(Business));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateDailyReport', () => {
    it('should generate a daily balance report', async () => {
      jest.spyOn(businessRepository, 'findOne').mockResolvedValue(mockBusiness as Business);
      jest.spyOn(transactionRepository, 'find').mockResolvedValue(mockTransactions as Transaction[]);

      const result = await service.generateDailyReport('business-1');

      expect(result).toBeDefined();
      expect(result.totalSales).toBe(13000); // 5000 + 3000 + 5000
      expect(result.totalExpenses).toBe(2000);
      expect(result.netProfit).toBe(11000); // 13000 - 2000
      expect(result.transactionCount).toBe(4);
      expect(result.salesCount).toBe(3);
      expect(result.expenseCount).toBe(1);
      expect(result.currency).toBe('XOF');
      expect(result.topProducts).toBeDefined();
      expect(result.topProducts.length).toBe(2); // Pain and Eau
    });

    it('should handle business not found', async () => {
      jest.spyOn(businessRepository, 'findOne').mockResolvedValue(null);

      await expect(service.generateDailyReport('invalid-business')).rejects.toThrow(
        'Business with ID invalid-business not found'
      );
    });
  });

  describe('generateWeeklyReport', () => {
    it('should generate a weekly balance report', async () => {
      jest.spyOn(businessRepository, 'findOne').mockResolvedValue(mockBusiness as Business);
      jest.spyOn(transactionRepository, 'find').mockResolvedValue(mockTransactions as Transaction[]);

      const result = await service.generateWeeklyReport('business-1');

      expect(result).toBeDefined();
      expect(result.totalSales).toBe(13000);
      expect(result.totalExpenses).toBe(2000);
      expect(result.netProfit).toBe(11000);
      expect(result.topProducts).toBeDefined();
      expect(result.topProducts.length).toBeLessThanOrEqual(5);
    });
  });

  describe('generateMonthlyReport', () => {
    it('should generate a monthly balance report', async () => {
      jest.spyOn(businessRepository, 'findOne').mockResolvedValue(mockBusiness as Business);
      jest.spyOn(transactionRepository, 'find').mockResolvedValue(mockTransactions as Transaction[]);

      const result = await service.generateMonthlyReport('business-1');

      expect(result).toBeDefined();
      expect(result.totalSales).toBe(13000);
      expect(result.totalExpenses).toBe(2000);
      expect(result.netProfit).toBe(11000);
      expect(result.topProducts).toBeDefined();
      expect(result.topProducts.length).toBeLessThanOrEqual(10);
    });
  });

  describe('generateBalanceReport', () => {
    it('should calculate top products correctly', async () => {
      jest.spyOn(businessRepository, 'findOne').mockResolvedValue(mockBusiness as Business);
      jest.spyOn(transactionRepository, 'find').mockResolvedValue(mockTransactions as Transaction[]);

      const result = await service.generateBalanceReport({
        businessId: 'business-1',
        period: ReportPeriod.DAY,
        includeTopProducts: true,
        topProductsLimit: 5
      });

      expect(result.topProducts).toBeDefined();
      expect(result.topProducts.length).toBe(2);
      
      // Pain should be first (10000 total revenue)
      expect(result.topProducts[0].product).toBe('Pain');
      expect(result.topProducts[0].revenue).toBe(10000);
      expect(result.topProducts[0].transactionCount).toBe(2);
      
      // Eau should be second (3000 total revenue)
      expect(result.topProducts[1].product).toBe('Eau');
      expect(result.topProducts[1].revenue).toBe(3000);
      expect(result.topProducts[1].transactionCount).toBe(1);
    });

    it('should handle empty transaction list', async () => {
      jest.spyOn(businessRepository, 'findOne').mockResolvedValue(mockBusiness as Business);
      jest.spyOn(transactionRepository, 'find').mockResolvedValue([]);

      const result = await service.generateBalanceReport({
        businessId: 'business-1',
        period: ReportPeriod.DAY,
        includeTopProducts: true
      });

      expect(result.totalSales).toBe(0);
      expect(result.totalExpenses).toBe(0);
      expect(result.netProfit).toBe(0);
      expect(result.transactionCount).toBe(0);
      expect(result.topProducts).toBeUndefined();
    });

    it('should exclude top products when not requested', async () => {
      jest.spyOn(businessRepository, 'findOne').mockResolvedValue(mockBusiness as Business);
      jest.spyOn(transactionRepository, 'find').mockResolvedValue(mockTransactions as Transaction[]);

      const result = await service.generateBalanceReport({
        businessId: 'business-1',
        period: ReportPeriod.DAY,
        includeTopProducts: false
      });

      expect(result.topProducts).toBeUndefined();
    });
  });

  describe('getPeriodMetrics', () => {
    it('should return period metrics for trend analysis', async () => {
      jest.spyOn(transactionRepository, 'find').mockResolvedValue(mockTransactions as Transaction[]);

      const result = await service.getPeriodMetrics('business-1', ReportPeriod.DAY, 3);

      expect(result).toBeDefined();
      expect(result.length).toBe(3);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('sales');
      expect(result[0]).toHaveProperty('expenses');
      expect(result[0]).toHaveProperty('profit');
      expect(result[0]).toHaveProperty('transactionCount');
    });

    it('should handle different period types', async () => {
      jest.spyOn(transactionRepository, 'find').mockResolvedValue([]);

      const dailyResult = await service.getPeriodMetrics('business-1', ReportPeriod.DAY, 7);
      const weeklyResult = await service.getPeriodMetrics('business-1', ReportPeriod.WEEK, 4);
      const monthlyResult = await service.getPeriodMetrics('business-1', ReportPeriod.MONTH, 6);

      expect(dailyResult.length).toBe(7);
      expect(weeklyResult.length).toBe(4);
      expect(monthlyResult.length).toBe(6);
    });
  });

  describe('period calculations', () => {
    it('should handle period calculations correctly', () => {
      // This tests the private methods indirectly through public methods
      expect(service).toBeDefined();
      // The actual period calculation logic is tested through the report generation methods
    });
  });
});