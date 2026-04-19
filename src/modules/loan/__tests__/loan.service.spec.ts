import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { LoanService } from '../loan.service';
import { Loan } from '../entities/loan.entity';
import { LoanPayment } from '../entities/loan-payment.entity';

describe('LoanService', () => {
  let service: LoanService;

  const mockLoanCreate = jest.fn();
  const mockLoanSave = jest.fn();
  const mockLoanFindOne = jest.fn();
  const mockLoanFind = jest.fn();
  const mockLoanUpdate = jest.fn();
  const mockLoanGetMany = jest.fn();

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getMany: mockLoanGetMany,
  };

  const mockLoanRepository = {
    create: mockLoanCreate,
    save: mockLoanSave,
    findOne: mockLoanFindOne,
    find: mockLoanFind,
    update: mockLoanUpdate,
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  const mockPaymentCreate = jest.fn();
  const mockPaymentSave = jest.fn();

  const mockPaymentRepository = {
    create: mockPaymentCreate,
    save: mockPaymentSave,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoanService,
        {
          provide: getRepositoryToken(Loan),
          useValue: mockLoanRepository,
        },
        {
          provide: getRepositoryToken(LoanPayment),
          useValue: mockPaymentRepository,
        },
      ],
    }).compile();

    service = module.get<LoanService>(LoanService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw BadRequestException when lenderName is empty', async () => {
      await expect(
        service.create('biz-1', 'user-1', {
          lenderName: '   ',
          loanType: 'supplier',
          amount: 1000,
          dueDate: new Date(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when amount is zero or negative', async () => {
      await expect(
        service.create('biz-1', 'user-1', {
          lenderName: 'John',
          loanType: 'supplier',
          amount: 0,
          dueDate: new Date(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when dueDate is missing', async () => {
      await expect(
        service.create('biz-1', 'user-1', {
          lenderName: 'John',
          loanType: 'supplier',
          amount: 1000,
          dueDate: undefined as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when loanType is invalid', async () => {
      await expect(
        service.create('biz-1', 'user-1', {
          lenderName: 'John',
          loanType: 'invalid' as any,
          amount: 1000,
          dueDate: new Date(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create loan with valid dto', async () => {
      const dto = {
        lenderName: '  Fournisseur ABC  ',
        lenderPhone: ' +226701234567 ',
        loanType: 'supplier' as const,
        amount: 50000,
        dueDate: new Date('2025-12-31'),
        description: '  Prêt fournisseur  ',
      };
      const savedLoan = {
        id: 'loan-1',
        businessId: 'biz-1',
        lenderName: 'Fournisseur ABC',
        lenderPhone: '+226701234567',
        loanType: 'supplier',
        amount: 50000,
        amountPaid: 0,
        status: 'open',
      };
      mockLoanCreate.mockReturnValue(savedLoan);
      mockLoanSave.mockResolvedValue(savedLoan);

      const result = await service.create('biz-1', 'user-1', dto);

      expect(mockLoanCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz-1',
          lenderName: 'Fournisseur ABC',
          lenderPhone: '+226701234567',
          loanType: 'supplier',
          amount: 50000,
          amountPaid: 0,
          description: 'Prêt fournisseur',
          dueDate: dto.dueDate,
          createdBy: 'user-1',
        }),
      );
      expect(result).toEqual(savedLoan);
    });
  });

  describe('findAll', () => {
    it('should return loans with optional filters', async () => {
      const mockLoans = [{ id: 'loan-1', businessId: 'biz-1', status: 'open' }];
      mockLoanGetMany.mockResolvedValue(mockLoans);

      const result = await service.findAll('biz-1', {
        status: 'open',
        limit: 10,
        offset: 5,
      });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('l.businessId = :businessId', {
        businessId: 'biz-1',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('l.status = :status', {
        status: 'open',
      });
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
      expect(result).toEqual(mockLoans);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when loan not found', async () => {
      mockLoanFindOne.mockResolvedValue(null);

      await expect(service.findOne('biz-1', 'loan-unknown')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('biz-1', 'loan-unknown')).rejects.toThrow('Prêt non trouvé');
    });

    it('should return loan when found', async () => {
      const mockLoan = { id: 'loan-1', businessId: 'biz-1', lenderName: 'John' };
      mockLoanFindOne.mockResolvedValue(mockLoan);

      const result = await service.findOne('biz-1', 'loan-1');

      expect(mockLoanFindOne).toHaveBeenCalledWith({
        where: { id: 'loan-1', businessId: 'biz-1' },
        relations: ['payments'],
      });
      expect(result).toEqual(mockLoan);
    });
  });

  describe('recordPayment', () => {
    it('should throw BadRequestException when amount is zero or negative', async () => {
      const mockLoan = {
        id: 'loan-1',
        businessId: 'biz-1',
        amount: 10000,
        amountPaid: 0,
        dueDate: new Date('2025-12-31'),
      };
      mockLoanFindOne.mockResolvedValue(mockLoan);

      await expect(
        service.recordPayment('biz-1', 'loan-1', 'user-1', 0),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.recordPayment('biz-1', 'loan-1', 'user-1', -100),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when amount exceeds outstanding', async () => {
      const mockLoan = {
        id: 'loan-1',
        businessId: 'biz-1',
        amount: 10000,
        amountPaid: 5000,
        dueDate: new Date('2025-12-31'),
      };
      mockLoanFindOne.mockResolvedValue(mockLoan);

      await expect(
        service.recordPayment('biz-1', 'loan-1', 'user-1', 6000),
      ).rejects.toThrow(BadRequestException);
    });

    it('should record payment and update loan', async () => {
      const mockLoan = {
        id: 'loan-1',
        businessId: 'biz-1',
        amount: 10000,
        amountPaid: 3000,
        dueDate: new Date('2025-12-31'),
      };
      const updatedLoan = { ...mockLoan, amountPaid: 5000, status: 'partial' };
      mockLoanFindOne
        .mockResolvedValueOnce(mockLoan)
        .mockResolvedValueOnce(updatedLoan);
      mockPaymentCreate.mockReturnValue({});
      mockPaymentSave.mockResolvedValue({});
      mockLoanUpdate.mockResolvedValue({});

      const result = await service.recordPayment('biz-1', 'loan-1', 'user-1', 2000);

      expect(mockPaymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          loan: mockLoan,
          amount: 2000,
          notes: null,
          createdBy: 'user-1',
        }),
      );
      expect(mockLoanUpdate).toHaveBeenCalledWith(
        { id: 'loan-1', businessId: 'biz-1' },
        { amountPaid: 5000, status: expect.any(String) },
      );
      expect(mockLoanFindOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('recordFullPayment', () => {
    it('should delegate to recordPayment with outstanding amount', async () => {
      const mockLoan = {
        id: 'loan-1',
        businessId: 'biz-1',
        amount: 10000,
        amountPaid: 0,
        dueDate: new Date('2025-12-31'),
      };
      const paidLoan = { ...mockLoan, amountPaid: 10000, status: 'paid' };
      mockLoanFindOne
        .mockResolvedValueOnce(mockLoan)
        .mockResolvedValueOnce(mockLoan)
        .mockResolvedValueOnce(paidLoan);
      mockPaymentCreate.mockReturnValue({});
      mockPaymentSave.mockResolvedValue({});
      mockLoanUpdate.mockResolvedValue({});

      const result = await service.recordFullPayment('biz-1', 'loan-1', 'user-1');

      expect(mockPaymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10000,
        }),
      );
      expect(result).toEqual(paidLoan);
    });
  });

  describe('getSummary', () => {
    it('should return summary with totalOutstanding, count, overdueCount', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const pastDate = new Date(today);
      pastDate.setDate(pastDate.getDate() - 1);

      const mockLoans = [
        { amount: 10000, amountPaid: 0, dueDate: today },
        { amount: 5000, amountPaid: 2000, dueDate: pastDate },
        { amount: 3000, amountPaid: 3000, dueDate: today },
      ];
      mockLoanFind.mockResolvedValue(mockLoans);

      const result = await service.getSummary('biz-1');

      expect(result.totalOutstanding).toBe(13000);
      expect(result.count).toBe(2);
      expect(result.overdueCount).toBe(1);
    });
  });

  describe('findByLender', () => {
    it('should return loans with case-insensitive lender name search', async () => {
      const mockLoans = [{ id: 'loan-1', lenderName: 'John Doe' }];
      mockLoanGetMany.mockResolvedValue(mockLoans);

      const result = await service.findByLender('biz-1', '  JOHN DOE  ');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('l.businessId = :businessId', {
        businessId: 'biz-1',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('LOWER(l.lenderName) = :name', {
        name: 'john doe',
      });
      expect(result).toEqual(mockLoans);
    });
  });
});
