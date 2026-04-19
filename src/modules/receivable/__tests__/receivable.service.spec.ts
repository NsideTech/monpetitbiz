import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReceivableService } from '../receivable.service';
import { Receivable } from '../entities/receivable.entity';
import { ReceivablePayment } from '../entities/receivable-payment.entity';

describe('ReceivableService', () => {
  let service: ReceivableService;

  const mockReceivableCreate = jest.fn();
  const mockReceivableSave = jest.fn();
  const mockReceivableFindOne = jest.fn();
  const mockReceivableFind = jest.fn();
  const mockReceivableUpdate = jest.fn();
  const mockReceivableGetMany = jest.fn();

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getMany: mockReceivableGetMany,
  };

  const mockReceivableRepository = {
    create: mockReceivableCreate,
    save: mockReceivableSave,
    findOne: mockReceivableFindOne,
    find: mockReceivableFind,
    update: mockReceivableUpdate,
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
        ReceivableService,
        {
          provide: getRepositoryToken(Receivable),
          useValue: mockReceivableRepository,
        },
        {
          provide: getRepositoryToken(ReceivablePayment),
          useValue: mockPaymentRepository,
        },
      ],
    }).compile();

    service = module.get<ReceivableService>(ReceivableService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw BadRequestException when debtorName is empty', async () => {
      await expect(
        service.create('biz-1', 'user-1', {
          debtorName: '   ',
          amount: 1000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when amount is zero or negative', async () => {
      await expect(
        service.create('biz-1', 'user-1', {
          debtorName: 'Client A',
          amount: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create receivable with valid dto', async () => {
      const dto = {
        debtorName: '  Client ABC  ',
        debtorPhone: ' +226701234567 ',
        amount: 25000,
        description: '  Vente à crédit  ',
        dueDate: new Date('2025-12-31'),
      };
      const savedReceivable = {
        id: 'rec-1',
        businessId: 'biz-1',
        debtorName: 'Client ABC',
        debtorPhone: '+226701234567',
        amount: 25000,
        amountPaid: 0,
        status: 'open',
      };
      mockReceivableCreate.mockReturnValue(savedReceivable);
      mockReceivableSave.mockResolvedValue(savedReceivable);

      const result = await service.create('biz-1', 'user-1', dto);

      expect(mockReceivableCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz-1',
          debtorName: 'Client ABC',
          debtorPhone: '+226701234567',
          amount: 25000,
          amountPaid: 0,
          description: 'Vente à crédit',
          dueDate: dto.dueDate,
          createdBy: 'user-1',
        }),
      );
      expect(result).toEqual(savedReceivable);
    });

    it('should create receivable without optional dueDate', async () => {
      const dto = {
        debtorName: 'Client B',
        amount: 5000,
      };
      const savedReceivable = { id: 'rec-2', ...dto, dueDate: null };
      mockReceivableCreate.mockReturnValue(savedReceivable);
      mockReceivableSave.mockResolvedValue(savedReceivable);

      const result = await service.create('biz-1', 'user-1', dto);

      expect(mockReceivableCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          dueDate: null,
        }),
      );
      expect(result).toEqual(savedReceivable);
    });
  });

  describe('findAll', () => {
    it('should return receivables with optional filters', async () => {
      const mockReceivables = [{ id: 'rec-1', businessId: 'biz-1', status: 'open' }];
      mockReceivableGetMany.mockResolvedValue(mockReceivables);

      const result = await service.findAll('biz-1', {
        status: 'open',
        limit: 10,
        offset: 5,
      });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('r.businessId = :businessId', {
        businessId: 'biz-1',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('r.status = :status', {
        status: 'open',
      });
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
      expect(result).toEqual(mockReceivables);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when receivable not found', async () => {
      mockReceivableFindOne.mockResolvedValue(null);

      await expect(service.findOne('biz-1', 'rec-unknown')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('biz-1', 'rec-unknown')).rejects.toThrow(
        'Créance non trouvée',
      );
    });

    it('should return receivable when found', async () => {
      const mockReceivable = { id: 'rec-1', businessId: 'biz-1', debtorName: 'Client A' };
      mockReceivableFindOne.mockResolvedValue(mockReceivable);

      const result = await service.findOne('biz-1', 'rec-1');

      expect(mockReceivableFindOne).toHaveBeenCalledWith({
        where: { id: 'rec-1', businessId: 'biz-1' },
        relations: ['payments'],
      });
      expect(result).toEqual(mockReceivable);
    });
  });

  describe('recordPayment', () => {
    it('should throw BadRequestException when amount is zero or negative', async () => {
      const mockReceivable = {
        id: 'rec-1',
        businessId: 'biz-1',
        amount: 10000,
        amountPaid: 0,
        dueDate: new Date('2025-12-31'),
      };
      mockReceivableFindOne.mockResolvedValue(mockReceivable);

      await expect(
        service.recordPayment('biz-1', 'rec-1', 'user-1', 0),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.recordPayment('biz-1', 'rec-1', 'user-1', -100),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when amount exceeds outstanding', async () => {
      const mockReceivable = {
        id: 'rec-1',
        businessId: 'biz-1',
        amount: 10000,
        amountPaid: 5000,
        dueDate: new Date('2025-12-31'),
      };
      mockReceivableFindOne.mockResolvedValue(mockReceivable);

      await expect(
        service.recordPayment('biz-1', 'rec-1', 'user-1', 6000),
      ).rejects.toThrow(BadRequestException);
    });

    it('should record payment and update receivable', async () => {
      const mockReceivable = {
        id: 'rec-1',
        businessId: 'biz-1',
        amount: 10000,
        amountPaid: 3000,
        dueDate: new Date('2025-12-31'),
      };
      const updatedReceivable = { ...mockReceivable, amountPaid: 5000, status: 'partial' };
      mockReceivableFindOne
        .mockResolvedValueOnce(mockReceivable)
        .mockResolvedValueOnce(updatedReceivable);
      mockPaymentCreate.mockReturnValue({});
      mockPaymentSave.mockResolvedValue({});
      mockReceivableUpdate.mockResolvedValue({});

      const result = await service.recordPayment('biz-1', 'rec-1', 'user-1', 2000);

      expect(mockPaymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          receivable: mockReceivable,
          amount: 2000,
          notes: null,
          createdBy: 'user-1',
        }),
      );
      expect(mockReceivableUpdate).toHaveBeenCalledWith(
        { id: 'rec-1', businessId: 'biz-1' },
        { amountPaid: 5000, status: expect.any(String) },
      );
      expect(mockReceivableFindOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('recordFullPayment', () => {
    it('should delegate to recordPayment with outstanding amount', async () => {
      const mockReceivable = {
        id: 'rec-1',
        businessId: 'biz-1',
        amount: 10000,
        amountPaid: 0,
        dueDate: new Date('2025-12-31'),
      };
      const paidReceivable = { ...mockReceivable, amountPaid: 10000, status: 'paid' };
      mockReceivableFindOne
        .mockResolvedValueOnce(mockReceivable)
        .mockResolvedValueOnce(mockReceivable)
        .mockResolvedValueOnce(paidReceivable);
      mockPaymentCreate.mockReturnValue({});
      mockPaymentSave.mockResolvedValue({});
      mockReceivableUpdate.mockResolvedValue({});

      const result = await service.recordFullPayment('biz-1', 'rec-1', 'user-1');

      expect(mockPaymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10000,
        }),
      );
      expect(result).toEqual(paidReceivable);
    });
  });

  describe('getSummary', () => {
    it('should return summary with totalOutstanding, count, overdueCount', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const pastDate = new Date(today);
      pastDate.setDate(pastDate.getDate() - 1);

      const mockReceivables = [
        { amount: 10000, amountPaid: 0, dueDate: today },
        { amount: 5000, amountPaid: 2000, dueDate: pastDate },
        { amount: 3000, amountPaid: 3000, dueDate: today },
      ];
      mockReceivableFind.mockResolvedValue(mockReceivables);

      const result = await service.getSummary('biz-1');

      expect(result.totalOutstanding).toBe(13000);
      expect(result.count).toBe(2);
      expect(result.overdueCount).toBe(1);
    });
  });

  describe('findByDebtor', () => {
    it('should return receivables with case-insensitive debtor name search', async () => {
      const mockReceivables = [{ id: 'rec-1', debtorName: 'Client Doe' }];
      mockReceivableGetMany.mockResolvedValue(mockReceivables);

      const result = await service.findByDebtor('biz-1', '  CLIENT DOE  ');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('r.businessId = :businessId', {
        businessId: 'biz-1',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('LOWER(r.debtorName) = :name', {
        name: 'client doe',
      });
      expect(result).toEqual(mockReceivables);
    });
  });
});
