import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TransactionService } from '../transaction.service';
import { Transaction, TransactionType } from '../entities/transaction.entity';

describe('TransactionService', () => {
  let service: TransactionService;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;

  const mockCreate = jest.fn();
  const mockSave = jest.fn();
  const mockFindOne = jest.fn();
  const mockGetMany = jest.fn();

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    getMany: mockGetMany,
  };

  const mockTransactionRepository = {
    create: mockCreate,
    save: mockSave,
    findOne: mockFindOne,
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    transactionRepository = module.get(getRepositoryToken(Transaction));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordTransaction', () => {
    it('should throw BadRequestException when amount is zero or negative', async () => {
      await expect(
        service.recordTransaction({
          businessId: 'biz-1',
          userId: 'user-1',
          type: TransactionType.SALE,
          amount: 0,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.recordTransaction({
          businessId: 'biz-1',
          userId: 'user-1',
          type: TransactionType.SALE,
          amount: -100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when businessId or userId is missing', async () => {
      await expect(
        service.recordTransaction({
          businessId: '',
          userId: 'user-1',
          type: TransactionType.SALE,
          amount: 100,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.recordTransaction({
          businessId: 'biz-1',
          userId: '',
          type: TransactionType.SALE,
          amount: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create and save transaction with default currency XOF', async () => {
      const dto = {
        businessId: 'biz-1',
        userId: 'user-1',
        type: TransactionType.SALE,
        amount: 5000,
      };
      const savedTransaction = { id: 'tx-1', ...dto, currency: 'XOF' };
      mockCreate.mockReturnValue(savedTransaction);
      mockSave.mockResolvedValue(savedTransaction);

      const result = await service.recordTransaction(dto);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz-1',
          userId: 'user-1',
          type: TransactionType.SALE,
          amount: 5000,
          currency: 'XOF',
          product: null,
          quantity: null,
          description: null,
          isCreditSale: false,
        }),
      );
      expect(mockSave).toHaveBeenCalledWith(savedTransaction);
      expect(result).toEqual(savedTransaction);
    });

    it('should trim product and description', async () => {
      const dto = {
        businessId: 'biz-1',
        userId: 'user-1',
        type: TransactionType.SALE,
        amount: 100,
        product: '  pain  ',
        description: '  vente  ',
      };
      const savedTransaction = { id: 'tx-1', ...dto };
      mockCreate.mockReturnValue(savedTransaction);
      mockSave.mockResolvedValue(savedTransaction);

      await service.recordTransaction(dto);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          product: 'pain',
          description: 'vente',
        }),
      );
    });

    it('should use quantity when positive', async () => {
      const dto = {
        businessId: 'biz-1',
        userId: 'user-1',
        type: TransactionType.SALE,
        amount: 100,
        quantity: 5,
      };
      const savedTransaction = { id: 'tx-1', ...dto };
      mockCreate.mockReturnValue(savedTransaction);
      mockSave.mockResolvedValue(savedTransaction);

      await service.recordTransaction(dto);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 5,
        }),
      );
    });

    it('should set isCreditSale to true when provided', async () => {
      const dto = {
        businessId: 'biz-1',
        userId: 'user-1',
        type: TransactionType.SALE,
        amount: 100,
        isCreditSale: true,
      };
      const savedTransaction = { id: 'tx-1', ...dto };
      mockCreate.mockReturnValue(savedTransaction);
      mockSave.mockResolvedValue(savedTransaction);

      await service.recordTransaction(dto);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          isCreditSale: true,
        }),
      );
    });
  });

  describe('recordSale', () => {
    it('should delegate to recordTransaction with SALE type', async () => {
      const savedTransaction = {
        id: 'tx-1',
        businessId: 'biz-1',
        userId: 'user-1',
        type: TransactionType.SALE,
        amount: 1000,
      };
      mockCreate.mockReturnValue(savedTransaction);
      mockSave.mockResolvedValue(savedTransaction);

      const result = await service.recordSale('biz-1', 'user-1', 1000, 'pain', 'desc', 2);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz-1',
          userId: 'user-1',
          type: TransactionType.SALE,
          amount: 1000,
          product: 'pain',
          description: 'desc',
          quantity: 2,
        }),
      );
      expect(result).toEqual(savedTransaction);
    });
  });

  describe('recordExpense', () => {
    it('should delegate to recordTransaction with EXPENSE type', async () => {
      const savedTransaction = {
        id: 'tx-1',
        businessId: 'biz-1',
        userId: 'user-1',
        type: TransactionType.EXPENSE,
        amount: 500,
      };
      mockCreate.mockReturnValue(savedTransaction);
      mockSave.mockResolvedValue(savedTransaction);

      const result = await service.recordExpense('biz-1', 'user-1', 500, 'achat', 'marchandise');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz-1',
          userId: 'user-1',
          type: TransactionType.EXPENSE,
          amount: 500,
          product: 'achat',
          description: 'marchandise',
        }),
      );
      expect(result).toEqual(savedTransaction);
    });
  });

  describe('getTransactions', () => {
    it('should return transactions with optional filters', async () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          businessId: 'biz-1',
          type: TransactionType.SALE,
          amount: 1000,
        },
      ];
      mockGetMany.mockResolvedValue(mockTransactions);

      const result = await service.getTransactions('biz-1', 10, 5, TransactionType.SALE);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'transaction.businessId = :businessId',
        { businessId: 'biz-1' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('transaction.type = :type', {
        type: TransactionType.SALE,
      });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(5);
      expect(result).toEqual(mockTransactions);
    });

    it('should work without optional filters', async () => {
      mockGetMany.mockResolvedValue([]);

      await service.getTransactions('biz-1');

      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
      expect(mockGetMany).toHaveBeenCalled();
    });
  });

  describe('getTransactionById', () => {
    it('should return transaction when found', async () => {
      const mockTransaction = { id: 'tx-1', businessId: 'biz-1' };
      mockFindOne.mockResolvedValue(mockTransaction);

      const result = await service.getTransactionById('tx-1');

      expect(mockFindOne).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        relations: ['business', 'user'],
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should return null when not found', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await service.getTransactionById('tx-unknown');

      expect(result).toBeNull();
    });
  });
});
