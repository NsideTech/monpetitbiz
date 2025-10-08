import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportSchedulerService } from '../report-scheduler.service';
import { ReportService } from '../../report.service';
import { WhatsappService } from '../../../whatsapp/whatsapp.service';
import { Business } from '../../../auth/entities/business.entity';
import { User } from '../../../auth/entities/user.entity';

describe('ReportSchedulerService - Timezone Handling', () => {
  let service: ReportSchedulerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportSchedulerService,
        {
          provide: getRepositoryToken(Business),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { find: jest.fn() },
        },
        {
          provide: ReportService,
          useValue: { generateDailyReport: jest.fn() },
        },
        {
          provide: WhatsappService,
          useValue: { sendMessage: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ReportSchedulerService>(ReportSchedulerService);
  });

  describe('timezone awareness', () => {
    it('should correctly identify 8 PM in different timezones', () => {
      // Create a test date that represents 8 PM in Dakar (UTC+0)
      const testDate = new Date('2024-01-15T20:00:00.000Z'); // 8 PM UTC
      
      // Test with Africa/Dakar timezone (UTC+0)
      const isDakarReportTime = service['isReportTime'](testDate, 'Africa/Dakar');
      expect(isDakarReportTime).toBe(true);

      // Test with a different time (not 8 PM)
      const nonReportTime = new Date('2024-01-15T19:00:00.000Z'); // 7 PM UTC
      const isNotReportTime = service['isReportTime'](nonReportTime, 'Africa/Dakar');
      expect(isNotReportTime).toBe(false);
    });

    it('should handle invalid timezones gracefully', () => {
      const testDate = new Date('2024-01-15T20:00:00.000Z');
      
      // Test with invalid timezone - should fallback to Africa/Dakar
      const isReportTime = service['isReportTime'](testDate, 'Invalid/Timezone');
      expect(isReportTime).toBe(true); // Should use fallback timezone
    });

    it('should format amounts correctly', () => {
      const formattedAmount = service['formatAmount'](1234567, 'XOF');
      expect(formattedAmount).toMatch(/1[\s\u00A0]234[\s\u00A0]567/); // Handle both regular space and non-breaking space
      expect(formattedAmount).toContain('XOF');
    });
  });

  describe('message formatting', () => {
    const mockReport = {
      period: '15 janvier 2024',
      totalSales: 50000,
      totalExpenses: 20000,
      netProfit: 30000,
      transactionCount: 10,
      salesCount: 7,
      expenseCount: 3,
      topProducts: [
        { product: 'Pain', revenue: 25000, quantity: 50, transactionCount: 5 }
      ]
    };

    const mockBusiness = {
      name: 'Test Business',
      currency: 'XOF'
    };

    it('should format French message correctly', () => {
      const message = service['formatDailyReportMessage'](mockReport as any, mockBusiness as any, 'fr');
      
      expect(message).toContain('Rapport quotidien - Test Business');
      expect(message).toMatch(/50[\s\u00A0]000/);
      expect(message).toMatch(/20[\s\u00A0]000/);
      expect(message).toMatch(/30[\s\u00A0]000/);
      expect(message).toMatch(/Pain:[\s\u00A0]*25[\s\u00A0]000/);
      expect(message).toContain('Bonne soirée ! 🌙');
    });

    it('should format English message correctly', () => {
      const message = service['formatDailyReportMessage'](mockReport as any, mockBusiness as any, 'en');
      
      expect(message).toContain('Daily Report - Test Business');
      expect(message).toMatch(/50[\s\u00A0]000/);
      expect(message).toMatch(/20[\s\u00A0]000/);
      expect(message).toMatch(/30[\s\u00A0]000/);
      expect(message).toMatch(/Pain:[\s\u00A0]*25[\s\u00A0]000/);
      expect(message).toContain('Good evening! 🌙');
    });

    it('should handle no activity message', () => {
      const noActivityReport = { ...mockReport, transactionCount: 0 };
      const message = service['formatDailyReportMessage'](noActivityReport as any, mockBusiness as any, 'fr');
      
      expect(message).toContain('Aucune activité aujourd\'hui');
      expect(message).toContain('Bonne soirée ! 🌙');
    });
  });
});