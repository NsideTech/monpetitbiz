import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DashboardService } from '../dashboard.service';
import { Transaction, TransactionType } from '../../transaction/entities/transaction.entity';
import { StockItem } from '../../stock/entities/stock-item.entity';
import { Business } from '../../auth/entities/business.entity';
import { ReportService } from '../../report/report.service';
import { StockService } from '../../stock/stock.service';
import { ProductNormalizerService } from '../../stock/services/product-normalizer.service';
import { TransactionService } from '../../transaction/transaction.service';
import { StockMovementService } from '../../stock/services/stock-movement.service';
import { ReceivableService } from '../../receivable/receivable.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let transactionRepository: Repository<Transaction>;
  let stockRepository: Repository<StockItem>;
  let businessRepository: Repository<Business>;
  let reportService: ReportService;
  let stockService: StockService;

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };

  const mockTransactionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
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
    updateStock: jest.fn(),
  };

  const mockProductNormalizer = {
    normalize: jest.fn(),
    findBestMatch: jest.fn(),
  };

  const mockTransactionService = {
    createTransaction: jest.fn(),
    findAll: jest.fn(),
  };

  const mockStockMovementService = {
    getMovements: jest.fn(),
    recordMovement: jest.fn(),
  };

  const mockReceivableService = {
    getSummary: jest.fn().mockResolvedValue({ totalOutstanding: 0, count: 0, overdueCount: 0 }),
  };

  const mockDataSource = {
    transaction: jest.fn((cb) => cb({ getRepository: jest.fn(() => mockTransactionRepository) })),
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
        {
          provide: ProductNormalizerService,
          useValue: mockProductNormalizer,
        },
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
        {
          provide: StockMovementService,
          useValue: mockStockMovementService,
        },
        {
          provide: ReceivableService,
          useValue: mockReceivableService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
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

  // ---------------------------------------------------------------------------
  // B2 — getSummaryCards : champs comparatifs
  // ---------------------------------------------------------------------------
  describe('getSummaryCards — B2 comparative fields', () => {
    it('should include yesterdaySales, variationVsYesterday, averageLast7Days, variationVsAverage', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      mockBusinessRepository.findOne.mockResolvedValue({ id: businessId, currency: 'XOF' });
      mockTransactionRepository.find.mockResolvedValue([]);

      const result = await service.getSummaryCards(businessId);

      expect(result).toHaveProperty('yesterdaySales');
      expect(result).toHaveProperty('variationVsYesterday');
      expect(result).toHaveProperty('averageLast7Days');
      expect(result).toHaveProperty('variationVsAverage');
      expect(typeof result.yesterdaySales).toBe('number');
      expect(typeof result.variationVsYesterday).toBe('number');
      expect(typeof result.averageLast7Days).toBe('number');
      expect(typeof result.variationVsAverage).toBe('number');
    });

    it('should compute variationVsYesterday=100 when yesterday=0 and today>0', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      mockBusinessRepository.findOne.mockResolvedValue({ id: businessId, currency: 'XOF' });

      const todaySale = { id: '1', type: TransactionType.SALE, amount: 5000, createdAt: new Date() };

      // 5 calls to find(): today, week, month, yesterday, last7days
      mockTransactionRepository.find
        .mockResolvedValueOnce([todaySale]) // today
        .mockResolvedValueOnce([todaySale]) // week
        .mockResolvedValueOnce([todaySale]) // month
        .mockResolvedValueOnce([])          // yesterday (empty)
        .mockResolvedValueOnce([]);         // last7days (empty)

      const result = await service.getSummaryCards(businessId);

      expect(result.todaySales).toBe(5000);
      expect(result.yesterdaySales).toBe(0);
      expect(result.variationVsYesterday).toBe(100);
    });

    it('should compute variationVsYesterday=0 when both today and yesterday are 0', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      mockBusinessRepository.findOne.mockResolvedValue({ id: businessId, currency: 'XOF' });
      mockTransactionRepository.find.mockResolvedValue([]);

      const result = await service.getSummaryCards(businessId);

      expect(result.variationVsYesterday).toBe(0);
    });

    it('should compute averageLast7Days as total_last7days / 7', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      mockBusinessRepository.findOne.mockResolvedValue({ id: businessId, currency: 'XOF' });

      const saleTxn = { id: '1', type: TransactionType.SALE, amount: 7000, createdAt: new Date() };

      mockTransactionRepository.find
        .mockResolvedValueOnce([])           // today
        .mockResolvedValueOnce([])           // week
        .mockResolvedValueOnce([])           // month
        .mockResolvedValueOnce([])           // yesterday
        .mockResolvedValueOnce([saleTxn]);   // last7days — total = 7000

      const result = await service.getSummaryCards(businessId);

      expect(result.averageLast7Days).toBe(Math.round(7000 / 7)); // 1000
    });
  });

  // ---------------------------------------------------------------------------
  // B3 — getTopProducts
  // ---------------------------------------------------------------------------
  describe('getTopProducts', () => {
    it('should return mapped top products for the week period', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      const rawRows = [
        { product: 'pain', totalRevenue: '15000', totalQuantity: '30', transactionCount: '15' },
        { product: 'lait', totalRevenue: '8000', totalQuantity: '40', transactionCount: '20' },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(rawRows);

      const result = await service.getTopProducts(businessId, 'week', 5);

      expect(mockTransactionRepository.createQueryBuilder).toHaveBeenCalledWith('t');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        product: 'pain',
        totalRevenue: 15000,
        totalQuantity: 30,
        transactionCount: 15,
      });
      expect(result[1]).toEqual({
        product: 'lait',
        totalRevenue: 8000,
        totalQuantity: 40,
        transactionCount: 20,
      });
    });

    it('should return empty array when no sales with products exist', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getTopProducts(businessId, 'day', 5);

      expect(result).toEqual([]);
    });

    it('should enforce the limit parameter', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      await service.getTopProducts(businessId, 'month', 3);

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(3);
    });

    it('should cast decimal and count strings to numbers', async () => {
      const businessId = '123e4567-e89b-12d3-a456-426614174000';
      const rawRows = [
        { product: 'savon', totalRevenue: '12500.50', totalQuantity: '25', transactionCount: '10' },
      ];
      mockQueryBuilder.getRawMany.mockResolvedValue(rawRows);

      const result = await service.getTopProducts(businessId, 'week', 5);

      expect(typeof result[0].totalRevenue).toBe('number');
      expect(typeof result[0].totalQuantity).toBe('number');
      expect(typeof result[0].transactionCount).toBe('number');
      expect(result[0].totalRevenue).toBeCloseTo(12500.5);
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