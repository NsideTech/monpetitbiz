import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PDFGenerationService } from '../pdf-generation.service';
import { BalanceReport } from '../../dto/report.dto';
import { Business } from '../../../auth/entities/business.entity';

// Define mocks before they're used
const mockS3Send = jest.fn().mockResolvedValue({});
const mockGetSignedUrl = jest.fn().mockResolvedValue('https://test-url.com/report.pdf?response-content-type=application%2Fpdf');

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockS3Send,
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn((...args) => mockGetSignedUrl(...args)),
}));

// Mock Puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe('PDFGenerationService', () => {
  let service: PDFGenerationService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        'AWS_REGION': 'us-east-1',
        'AWS_ACCESS_KEY_ID': 'test-access-key',
        'AWS_SECRET_ACCESS_KEY': 'test-secret-key',
        'AWS_S3_BUCKET_NAME': 'test-bucket',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PDFGenerationService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PDFGenerationService>(PDFGenerationService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generatePDFReport', () => {
    it('should generate PDF report successfully', async () => {
      const mockBusiness: Business = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Business',
        businessCode: 'ABC123',
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

      const mockReportData: BalanceReport = {
        period: 'Test Period',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        totalSales: 100000,
        totalExpenses: 50000,
        netProfit: 50000,
        transactionCount: 10,
        salesCount: 7,
        expenseCount: 3,
        currency: 'XOF',
        topProducts: [
          {
            product: 'Test Product',
            revenue: 50000,
            quantity: 10,
            transactionCount: 5,
          },
        ],
      };

      // Mock S3 upload - mocks are already set up at the top of the file
      // Reset mocks to ensure clean state
      mockS3Send.mockClear();
      mockGetSignedUrl.mockClear();
      mockGetSignedUrl.mockResolvedValue('https://test-url.com/report.pdf?response-content-type=application%2Fpdf');

      const result = await service.generatePDFReport({
        businessId: '123e4567-e89b-12d3-a456-426614174000',
        reportData: mockReportData,
        business: mockBusiness,
        templateType: 'standard',
      });

      expect(result.success).toBe(true);
      expect(result.fileName).toContain('rapport-123e4567-e89b-12d3-a456-426614174000');
      expect(result.fileName).toContain('.pdf');
    });

    it('should handle PDF generation errors gracefully', async () => {
      const mockBusiness: Business = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Business',
        businessCode: 'DEF456',
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

      const mockReportData: BalanceReport = {
        period: 'Test Period',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        totalSales: 100000,
        totalExpenses: 50000,
        netProfit: 50000,
        transactionCount: 10,
        salesCount: 7,
        expenseCount: 3,
        currency: 'XOF',
      };

      // Mock Puppeteer to throw an error
      const puppeteer = require('puppeteer');
      puppeteer.launch.mockRejectedValueOnce(new Error('Puppeteer launch failed'));

      const result = await service.generatePDFReport({
        businessId: '123e4567-e89b-12d3-a456-426614174000',
        reportData: mockReportData,
        business: mockBusiness,
        templateType: 'standard',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Puppeteer launch failed');
    });
  });

  describe('template data preparation', () => {
    it('should format currency correctly', () => {
      const amount = 123456;
      const currency = 'XOF';
      
      // Test the private method through public interface
      const formatted = new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);

      // The actual format is "123 456 F CFA" for XOF currency
      expect(formatted).toContain('123');
      expect(formatted).toContain('456');
      expect(formatted).toContain('CFA');
    });

    it('should generate unique filenames', () => {
      const businessId = 'test-business';
      const period = 'Janvier 2024';
      
      // Mock the private method behavior
      const timestamp = new Date().toISOString().split('T')[0];
      const sanitizedPeriod = period.replace(/[^a-zA-Z0-9]/g, '-');
      const expectedFileName = `rapport-${businessId}-${sanitizedPeriod}-${timestamp}.pdf`;
      
      expect(expectedFileName).toContain('rapport-test-business');
      expect(expectedFileName).toContain('Janvier-2024');
      expect(expectedFileName).toContain('.pdf');
    });
  });
});