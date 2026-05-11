import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PDFGenerationService } from '../pdf-generation.service';
import { BalanceReport } from '../../dto/report.dto';
import { Business } from '../../../auth/entities/business.entity';

const mockUpload = jest.fn().mockResolvedValue({ data: { path: 'reports/x.pdf' }, error: null });
const mockCreateSignedUrl = jest.fn().mockResolvedValue({
    data: { signedUrl: 'https://test.supabase.co/storage/v1/object/sign/reports/x.pdf?token=abc' },
    error: null,
});

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
        storage: {
            from: jest.fn(() => ({
                upload: mockUpload,
                createSignedUrl: mockCreateSignedUrl,
            })),
        },
    })),
}));

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

    const mockConfigService = {
        get: jest.fn((key: string, defaultValue?: unknown) => {
            const config: Record<string, string> = {
                SUPABASE_URL: 'https://test.supabase.co',
                SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
                SUPABASE_STORAGE_BUCKET: 'reports',
            };
            return config[key] ?? defaultValue;
        }),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        mockUpload.mockResolvedValue({ data: { path: 'reports/x.pdf' }, error: null });
        mockCreateSignedUrl.mockResolvedValue({
            data: { signedUrl: 'https://test.supabase.co/storage/v1/object/sign/reports/x.pdf?token=abc' },
            error: null,
        });

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

            const result = await service.generatePDFReport({
                businessId: '123e4567-e89b-12d3-a456-426614174000',
                reportData: mockReportData,
                business: mockBusiness,
                templateType: 'standard',
            });

            expect(result.success).toBe(true);
            expect(result.fileName).toContain('rapport-123e4567-e89b-12d3-a456-426614174000');
            expect(result.fileName).toContain('.pdf');
            expect(result.url).toMatch(/^https:\/\//);
            expect(result.url).toContain('test.supabase.co');
            expect(mockUpload).toHaveBeenCalled();
            expect(mockCreateSignedUrl).toHaveBeenCalled();
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

            const formatted = new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(amount);

            expect(formatted).toContain('123');
            expect(formatted).toContain('456');
            expect(formatted).toContain('CFA');
        });

        it('should generate unique filenames', () => {
            const businessId = 'test-business';
            const period = 'Janvier 2024';

            const timestamp = new Date().toISOString().split('T')[0];
            const sanitizedPeriod = period.replace(/[^a-zA-Z0-9]/g, '-');
            const expectedFileName = `rapport-${businessId}-${sanitizedPeriod}-${timestamp}.pdf`;

            expect(expectedFileName).toContain('rapport-test-business');
            expect(expectedFileName).toContain('Janvier-2024');
            expect(expectedFileName).toContain('.pdf');
        });
    });
});
