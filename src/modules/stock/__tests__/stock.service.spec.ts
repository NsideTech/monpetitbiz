import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { StockService } from '../stock.service';
import { StockItem } from '../entities/stock-item.entity';

describe('StockService', () => {
  let service: StockService;
  let stockItemRepository: Repository<StockItem>;

  const mockStockItemRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        {
          provide: getRepositoryToken(StockItem),
          useValue: mockStockItemRepository,
        },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
    stockItemRepository = module.get<Repository<StockItem>>(getRepositoryToken(StockItem));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateStock', () => {
    it('should update existing stock item', async () => {
      const businessId = 'business-id';
      const product = 'Pain';
      const quantity = 50;
      
      const existingStockItem = {
        id: 'stock-id',
        businessId,
        product: 'pain',
        quantity: 20,
        updatedAt: new Date(),
      };

      mockStockItemRepository.findOne.mockResolvedValue(existingStockItem);
      mockStockItemRepository.save.mockResolvedValue({
        ...existingStockItem,
        quantity: 50,
      });

      const result = await service.updateStock(businessId, product, quantity);

      expect(result.quantity).toBe(50);
      expect(mockStockItemRepository.findOne).toHaveBeenCalledWith({
        where: { businessId, product: 'pain' }
      });
    });

    it('should create new stock item if not exists', async () => {
      const businessId = 'business-id';
      const product = 'Pain';
      const quantity = 30;

      mockStockItemRepository.findOne.mockResolvedValue(null);
      mockStockItemRepository.create.mockReturnValue({
        businessId,
        product: 'pain',
        quantity: 30,
      });
      mockStockItemRepository.save.mockResolvedValue({
        id: 'new-stock-id',
        businessId,
        product: 'pain',
        quantity: 30,
      });

      const result = await service.updateStock(businessId, product, quantity);

      expect(result.quantity).toBe(30);
      expect(mockStockItemRepository.create).toHaveBeenCalledWith({
        businessId,
        product: 'pain',
        quantity: 30,
      });
    });

    it('should throw error for negative quantity', async () => {
      const businessId = 'business-id';
      const product = 'Pain';
      const quantity = -5;

      await expect(service.updateStock(businessId, product, quantity))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw error for empty product name', async () => {
      const businessId = 'business-id';
      const product = '';
      const quantity = 10;

      await expect(service.updateStock(businessId, product, quantity))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('getStock', () => {
    it('should return specific product stock', async () => {
      const businessId = 'business-id';
      const product = 'Pain';
      
      const stockItem = {
        id: 'stock-id',
        businessId,
        product: 'pain',
        quantity: 25,
      };

      mockStockItemRepository.findOne.mockResolvedValue(stockItem);

      const result = await service.getStock(businessId, product);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(stockItem);
      expect(mockStockItemRepository.findOne).toHaveBeenCalledWith({
        where: { businessId, product: 'pain' }
      });
    });

    it('should throw error if product not found', async () => {
      const businessId = 'business-id';
      const product = 'NonExistent';

      mockStockItemRepository.findOne.mockResolvedValue(null);

      await expect(service.getStock(businessId, product))
        .rejects.toThrow(NotFoundException);
    });

    it('should return all stock items when no product specified', async () => {
      const businessId = 'business-id';
      
      const stockItems = [
        { id: '1', businessId, product: 'pain', quantity: 25 },
        { id: '2', businessId, product: 'lait', quantity: 10 },
      ];

      mockStockItemRepository.find.mockResolvedValue(stockItems);

      const result = await service.getStock(businessId);

      expect(result).toHaveLength(2);
      expect(mockStockItemRepository.find).toHaveBeenCalledWith({
        where: { businessId },
        order: { product: 'ASC' }
      });
    });
  });

  describe('decrementStock', () => {
    it('should decrement stock successfully', async () => {
      const businessId = 'business-id';
      const product = 'Pain';
      const quantity = 2;
      
      const stockItem = {
        id: 'stock-id',
        businessId,
        product: 'pain',
        quantity: 10,
        updatedAt: new Date(),
      };

      mockStockItemRepository.findOne.mockResolvedValue(stockItem);
      mockStockItemRepository.save.mockResolvedValue({
        ...stockItem,
        quantity: 8,
      });

      const result = await service.decrementStock(businessId, product, quantity);

      expect(result).toBe(true);
      expect(mockStockItemRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 8 })
      );
    });

    it('should return false for insufficient stock', async () => {
      const businessId = 'business-id';
      const product = 'Pain';
      const quantity = 15;
      
      const stockItem = {
        id: 'stock-id',
        businessId,
        product: 'pain',
        quantity: 5,
        updatedAt: new Date(),
      };

      mockStockItemRepository.findOne.mockResolvedValue(stockItem);
      mockStockItemRepository.save.mockResolvedValue({
        ...stockItem,
        quantity: 0,
      });

      const result = await service.decrementStock(businessId, product, quantity);

      expect(result).toBe(false);
      expect(mockStockItemRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 0 })
      );
    });

    it('should return false if product not in stock system', async () => {
      const businessId = 'business-id';
      const product = 'NonExistent';
      const quantity = 1;

      mockStockItemRepository.findOne.mockResolvedValue(null);

      const result = await service.decrementStock(businessId, product, quantity);

      expect(result).toBe(false);
      expect(mockStockItemRepository.save).not.toHaveBeenCalled();
    });

    it('should return false for empty product name', async () => {
      const businessId = 'business-id';
      const product = '';
      const quantity = 1;

      const result = await service.decrementStock(businessId, product, quantity);

      expect(result).toBe(false);
      expect(mockStockItemRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('getStockWarnings', () => {
    it('should return warnings for low stock items', async () => {
      const businessId = 'business-id';
      const warningThreshold = 5;
      
      const stockItems = [
        { id: '1', businessId, product: 'pain', quantity: 3 },
        { id: '2', businessId, product: 'lait', quantity: 0 },
        { id: '3', businessId, product: 'sucre', quantity: 10 },
      ];

      mockStockItemRepository.find.mockResolvedValue(stockItems);

      const result = await service.getStockWarnings(businessId, warningThreshold);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        product: 'pain',
        currentQuantity: 3,
        warningLevel: 5,
        message: 'pain is running low (3 remaining)'
      });
      expect(result[1]).toEqual({
        product: 'lait',
        currentQuantity: 0,
        warningLevel: 5,
        message: 'lait is out of stock'
      });
    });
  });

  describe('getStockLevel', () => {
    it('should return stock level for existing product', async () => {
      const businessId = 'business-id';
      const product = 'Pain';
      
      const stockItem = {
        id: 'stock-id',
        businessId,
        product: 'pain',
        quantity: 15,
      };

      mockStockItemRepository.findOne.mockResolvedValue(stockItem);

      const result = await service.getStockLevel(businessId, product);

      expect(result).toBe(15);
    });

    it('should return 0 for non-existing product', async () => {
      const businessId = 'business-id';
      const product = 'NonExistent';

      mockStockItemRepository.findOne.mockResolvedValue(null);

      const result = await service.getStockLevel(businessId, product);

      expect(result).toBe(0);
    });

    it('should return 0 for empty product name', async () => {
      const businessId = 'business-id';
      const product = '';

      const result = await service.getStockLevel(businessId, product);

      expect(result).toBe(0);
      expect(mockStockItemRepository.findOne).not.toHaveBeenCalled();
    });
  });
});