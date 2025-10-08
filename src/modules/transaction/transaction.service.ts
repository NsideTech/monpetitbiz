import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionType } from './entities/transaction.entity';

export interface CreateTransactionDto {
  businessId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  product?: string;
  description?: string;
  currency?: string;
}

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  /**
   * Record a new transaction (sale or expense)
   */
  async recordTransaction(dto: CreateTransactionDto): Promise<Transaction> {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    if (!dto.businessId || !dto.userId) {
      throw new BadRequestException('Business ID and User ID are required');
    }

    const transaction = this.transactionRepository.create({
      businessId: dto.businessId,
      userId: dto.userId,
      type: dto.type,
      amount: dto.amount,
      currency: dto.currency || 'XOF',
      product: dto.product?.trim() || null,
      description: dto.description?.trim() || null,
    });

    return await this.transactionRepository.save(transaction);
  }

  /**
   * Record a sale transaction
   */
  async recordSale(
    businessId: string,
    userId: string,
    amount: number,
    product?: string,
    description?: string
  ): Promise<Transaction> {
    return this.recordTransaction({
      businessId,
      userId,
      type: TransactionType.SALE,
      amount,
      product,
      description,
    });
  }

  /**
   * Record an expense transaction
   */
  async recordExpense(
    businessId: string,
    userId: string,
    amount: number,
    product?: string,
    description?: string
  ): Promise<Transaction> {
    return this.recordTransaction({
      businessId,
      userId,
      type: TransactionType.EXPENSE,
      amount,
      product,
      description,
    });
  }

  /**
   * Get transactions for a business
   */
  async getTransactions(
    businessId: string,
    limit?: number,
    offset?: number,
    type?: TransactionType
  ): Promise<Transaction[]> {
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.businessId = :businessId', { businessId })
      .orderBy('transaction.createdAt', 'DESC');

    if (type) {
      query.andWhere('transaction.type = :type', { type });
    }

    if (limit) {
      query.limit(limit);
    }

    if (offset) {
      query.offset(offset);
    }

    return await query.getMany();
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(id: string): Promise<Transaction | null> {
    return await this.transactionRepository.findOne({
      where: { id },
      relations: ['business', 'user'],
    });
  }
}