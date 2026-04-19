import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Transaction, TransactionType, PaymentMethod } from './entities/transaction.entity';

export interface CreateTransactionDto {
  businessId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  product?: string;
  quantity?: number;
  description?: string;
  currency?: string;
  isCreditSale?: boolean;
  paymentMethod?: PaymentMethod;
}

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  /**
   * Record a new transaction (sale or expense).
   * Pass an EntityManager to participate in a caller-managed DB transaction.
   */
  async recordTransaction(dto: CreateTransactionDto, manager?: EntityManager): Promise<Transaction> {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    if (!dto.businessId || !dto.userId) {
      throw new BadRequestException('Business ID and User ID are required');
    }

    const repo = manager ? manager.getRepository(Transaction) : this.transactionRepository;

    const transaction = repo.create({
      businessId: dto.businessId,
      userId: dto.userId,
      type: dto.type,
      amount: dto.amount,
      currency: dto.currency || 'XOF',
      product: dto.product?.trim() || null,
      quantity: dto.quantity != null && dto.quantity > 0 ? dto.quantity : null,
      description: dto.description?.trim() || null,
      isCreditSale: dto.isCreditSale ? true : false,
      paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
    });

    return await repo.save(transaction);
  }

  /**
   * Record a sale transaction.
   * Pass an EntityManager to participate in a caller-managed DB transaction.
   */
  async recordSale(
    businessId: string,
    userId: string,
    amount: number,
    product?: string,
    description?: string,
    quantity?: number,
    isCreditSale?: boolean,
    manager?: EntityManager,
    paymentMethod?: PaymentMethod,
  ): Promise<Transaction> {
    return this.recordTransaction({
      businessId,
      userId,
      type: TransactionType.SALE,
      amount,
      product,
      quantity,
      description,
      isCreditSale,
      paymentMethod,
    }, manager);
  }

  /**
   * Record an expense transaction
   */
  async recordExpense(
    businessId: string,
    userId: string,
    amount: number,
    product?: string,
    description?: string,
    paymentMethod?: PaymentMethod,
  ): Promise<Transaction> {
    return this.recordTransaction({
      businessId,
      userId,
      type: TransactionType.EXPENSE,
      amount,
      product,
      description,
      paymentMethod,
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

  /**
   * Soft-delete a transaction with audit trail.
   * Sets deleted_by and deletion_reason before invoking TypeORM softDelete
   * so the audit fields are committed atomically with the deletion timestamp.
   */
  async softDeleteTransaction(
    transactionId: string,
    deletedByUserId: string,
    reason: string,
  ): Promise<void> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    if (transaction.deletedAt !== null) {
      throw new BadRequestException(`Transaction ${transactionId} is already deleted`);
    }

    // Persist audit fields before soft-deleting so they land in the same row update
    await this.transactionRepository.update(transactionId, {
      deletedBy: deletedByUserId,
      deletionReason: reason,
    });

    await this.transactionRepository.softDelete(transactionId);
  }
}