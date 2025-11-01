import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardService } from '../dashboard.service';
import { Transaction, TransactionType } from '../../transaction/entities/transaction.entity';
import { StockItem } from '../../stock/entities/stock-item.entity';
import { Business } from '../../auth/entities/business.entity';
import { ReportService } from '../../report/report.service';
import { StockService } from '../../stock/stock.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let transactionRepository: Repository<Transaction>;
  let stockRepository: Repository<StockItem>;
  let businessRepository: Repository<Business>;
  let reportService: ReportService;
  let stockService: StockService;

  const mockTransactionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockStockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockBusinessRepository = {
    findOne: jest.fn(),
  };

  const mockReportService = {
    generateBalanceReport: jest.fn(),
  };

  const mockStockService = {
    getStockWarnings: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: getRepositoryToken(StockItem),
          useValue: mockStockRepository,
        },
        {
          provide: getRepositoryToken(Business),
          useValue: mockBusinessRepository,
        },
        {
          provide: ReportService,
          useValue: mockReportService,
        },
        {
          provide: StockService,
          useValue: mockStockService,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    transactionRepository = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    stockRepository = module.get<Repository<StockItem>>(getRepositoryToken(StockItem));
    businessRepository = module.get<Repository<Business>>(getRepositoryToken(Business));
    reportService = module.get<ReportService>(ReportService);
    stockService = module.get<StockService>(StockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSummaryCards', () => {
    it('should return summary cards with daily, weekly, and monthly totals', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      const mockBusiness = { id: businessId, currency: 'XOF' };
      const mockTransactions = [
        {
          id: '1',
          type: TransactionType.SALE,
          amount: 1000,
          createdAt: new Date(),
        },
        {
          id: '2',
          type: TransactionType.EXPENSE,
          amount: 500,
          createdAt: new Date(),
        },
      ];

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockTransactionRepository.find.mockResolvedValue(mockTransactions);

      const result = await service.getSummaryCards(businessId);

      expect(result).toBeDefined();
      expect(result.currency).toBe('XOF');
      expect(typeof result.todaySales).toBe('number');
      expect(typeof result.todayExpenses).toBe('number');
      expect(typeof result.todayProfit).toBe('number');
      expect(mockBusinessRepository.findOne).toHaveBeenCalledWith({ where: { id: businessId } });
    });

    it('should use default currency when business currency is not set', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      const mockBusiness = { id: businessId, currency: null };

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockTransactionRepository.find.mockResolvedValue([]);

      const result = await service.getSummaryCards(businessId);

      expect(result.currency).toBe('XOF');
    });
  });

  describe('getChartData', () => {
    it('should return chart data for the specified number of days', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      const days = 7;
      const mockTransactions = [
        {
          id: '1',
          type: TransactionType.SALE,
          amount: 1000,
          createdAt: new Date(),
        },
      ];

      mockTransactionRepository.find.mockResolvedValue(mockTransactions);

      const result = await service.getChartData(businessId, days);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(days);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('sales');
      expect(result[0]).toHaveProperty('expenses');
      expect(result[0]).toHaveProperty('profit');
    });
  });

  describe('getStockWarnings', () => {
    it('should return stock warnings for low stock items', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      const threshold = 5;
      const mockStockItems = [
        {
          id: '1',
          businessId,
          product: 'pain',
          quantity: 2,
          updatedAt: new Date(),
        },
        {
          id: '2',
          businessId,
          product: 'lait',
          quantity: 0,
          updatedAt: new Date(),
        },
      ];

      mockStockRepository.find.mockResolvedValue(mockStockItems);

      const result = await service.getStockWarnings(businessId, threshold);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty('product');
      expect(result[0]).toHaveProperty('currentQuantity');
      expect(result[0]).toHaveProperty('status');
      expect(result[0]).toHaveProperty('message');
      expect(result[1].status).toBe('out');
    });
  });

  describe('exportTransactionDataAsCSV', () => {
    it('should export transaction data as CSV format', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      const mockBusiness = { id: businessId, currency: 'XOF' };
      const mockTransactions = [
        {
          id: '1',
          type: TransactionType.SALE,
          amount: 1000,
          currency: 'XOF',
          product: 'pain',
          description: 'Vente de pain',
          createdAt: new Date('2023-01-01'),
          user: { phoneNumber: '+226123456789' },
        },
      ];

      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      mockTransactionRepository.find.mockResolvedValue(mockTransactions);

      const result = await service.exportTransactionDataAsCSV(businessId);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('"Date","Type","Montant","Devise","Produit","Description","Utilisateur"');
      expect(result).toContain('pain');
      expect(result).toContain('1000');
    });
  });

  describe('getDashboardMetrics', () => {
    it('should return dashboard metrics for a specific period', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      const mockTransactions = [
        {
          id: '1',
          type: TransactionType.SALE,
          amount: 1000,
          product: 'pain',
          createdAt: new Date(),
        },
        {
          id: '2',
          type: TransactionType.EXPENSE,
          amount: 500,
          createdAt: new Date(),
        },
      ];

      mockTransactionRepository.find.mockResolvedValue(mockTransactions);

      const result = await service.getDashboardMetrics(businessId, 'day');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('totalSales');
      expect(result).toHaveProperty('totalExpenses');
      expect(result).toHaveProperty('netProfit');
      expect(result).toHaveProperty('transactionCount');
      expect(result).toHaveProperty('topProducts');
      expect(Array.isArray(result.topProducts)).toBe(true);
    });
  });
});