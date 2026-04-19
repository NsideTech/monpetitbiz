import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Receivable } from './entities/receivable.entity';
import { ReceivablePayment } from './entities/receivable-payment.entity';
import type { ReceivableStatus } from './entities/receivable.entity';

export interface CreateReceivableDto {
  debtorName: string;
  debtorPhone?: string;
  amount: number;
  description?: string;
  dueDate?: Date;
}

export interface ReceivablesSummary {
  totalOutstanding: number;
  count: number;
  overdueCount: number;
}

@Injectable()
export class ReceivableService {
  constructor(
    @InjectRepository(Receivable)
    private readonly receivableRepository: Repository<Receivable>,
    @InjectRepository(ReceivablePayment)
    private readonly paymentRepository: Repository<ReceivablePayment>,
  ) {}

  async create(
    businessId: string,
    userId: string,
    dto: CreateReceivableDto,
  ): Promise<Receivable> {
    if (!dto.debtorName?.trim()) {
      throw new BadRequestException('Le nom du débiteur est requis');
    }
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Le montant doit être positif');
    }

    const status = this.computeStatus(
      dto.amount,
      0,
      dto.dueDate ? new Date(dto.dueDate) : null,
    );

    const receivable = this.receivableRepository.create({
      businessId,
      debtorName: dto.debtorName.trim(),
      debtorPhone: dto.debtorPhone?.trim() || null,
      amount: dto.amount,
      amountPaid: 0,
      currency: 'XOF',
      description: dto.description?.trim() || null,
      dueDate: dto.dueDate || null,
      status,
      createdBy: userId,
    });

    return await this.receivableRepository.save(receivable);
  }

  async findAll(
    businessId: string,
    filters?: { status?: ReceivableStatus; limit?: number; offset?: number },
  ): Promise<Receivable[]> {
    const qb = this.receivableRepository
      .createQueryBuilder('r')
      .where('r.businessId = :businessId', { businessId })
      .orderBy('r.createdAt', 'DESC');

    if (filters?.status) {
      qb.andWhere('r.status = :status', { status: filters.status });
    }

    if (filters?.limit != null) {
      qb.take(filters.limit);
    }
    if (filters?.offset != null) {
      qb.skip(filters.offset);
    }

    return qb.getMany();
  }

  async findOne(businessId: string, id: string): Promise<Receivable> {
    const receivable = await this.receivableRepository.findOne({
      where: { id, businessId },
      relations: ['payments'],
    });
    if (!receivable) {
      throw new NotFoundException('Créance non trouvée');
    }
    return receivable;
  }

  async recordPayment(
    businessId: string,
    receivableId: string,
    userId: string,
    amount: number,
    paymentDate?: Date,
    notes?: string,
  ): Promise<Receivable> {
    const receivable = await this.findOne(businessId, receivableId);
    const outstanding = Number(receivable.amount) - Number(receivable.amountPaid);

    if (amount <= 0) {
      throw new BadRequestException('Le montant du paiement doit être positif');
    }
    if (amount > outstanding) {
      throw new BadRequestException(
        `Le montant ne peut pas dépasser le solde restant (${outstanding.toLocaleString('fr-FR')} F CFA)`,
      );
    }

    const date = paymentDate ? new Date(paymentDate) : new Date();
    const newAmountPaid = Number(receivable.amountPaid) + amount;

    const payment = this.paymentRepository.create({
      receivable: receivable,
      amount,
      paymentDate: date,
      notes: notes?.trim() || null,
      createdBy: userId,
    });
    await this.paymentRepository.save(payment);

    const status = this.computeStatus(
      Number(receivable.amount),
      newAmountPaid,
      receivable.dueDate ? new Date(receivable.dueDate) : null,
    );

    await this.receivableRepository.update(
      { id: receivableId, businessId },
      { amountPaid: newAmountPaid, status },
    );

    return this.findOne(businessId, receivableId);
  }

  async recordFullPayment(
    businessId: string,
    receivableId: string,
    userId: string,
    paymentDate?: Date,
    notes?: string,
  ): Promise<Receivable> {
    const receivable = await this.findOne(businessId, receivableId);
    const outstanding = Number(receivable.amount) - Number(receivable.amountPaid);
    return this.recordPayment(
      businessId,
      receivableId,
      userId,
      outstanding,
      paymentDate,
      notes,
    );
  }

  async getSummary(businessId: string): Promise<ReceivablesSummary> {
    const receivables = await this.receivableRepository.find({
      where: { businessId },
    });

    let totalOutstanding = 0;
    let overdueCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const r of receivables) {
      const amount = Number(r.amount);
      const paid = Number(r.amountPaid);
      const outstanding = amount - paid;
      if (outstanding > 0) {
        totalOutstanding += outstanding;
        if (r.dueDate && new Date(r.dueDate) < today) {
          overdueCount += 1;
        }
      }
    }

    const count = receivables.filter(
      (r) => Number(r.amount) - Number(r.amountPaid) > 0,
    ).length;

    return { totalOutstanding, count, overdueCount };
  }

  async findByDebtor(
    businessId: string,
    debtorName: string,
  ): Promise<Receivable[]> {
    const normalized = debtorName.trim().toLowerCase();
    return this.receivableRepository
      .createQueryBuilder('r')
      .where('r.businessId = :businessId', { businessId })
      .andWhere('LOWER(r.debtorName) = :name', { name: normalized })
      .orderBy('r.createdAt', 'DESC')
      .getMany();
  }

  private computeStatus(
    amount: number,
    amountPaid: number,
    dueDate: Date | null,
  ): ReceivableStatus {
    const outstanding = amount - amountPaid;
    if (outstanding <= 0) return 'paid';
    if (amountPaid > 0) return 'partial';

    if (dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(dueDate);
      due.setHours(0, 0, 0, 0);
      if (due < today) return 'overdue';
    }

    return 'open';
  }}
