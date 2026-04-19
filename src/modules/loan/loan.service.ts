import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Loan } from './entities/loan.entity';
import { LoanPayment } from './entities/loan-payment.entity';
import type { LoanStatus } from './entities/loan.entity';

export interface CreateLoanDto {
  lenderName: string;
  lenderPhone?: string;
  loanType: 'supplier' | 'microcredit';
  amount: number;
  dueDate: Date;
  description?: string;
}

export interface LoansSummary {
  totalOutstanding: number;
  count: number;
  overdueCount: number;
}

@Injectable()
export class LoanService {
  constructor(
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(LoanPayment)
    private readonly paymentRepository: Repository<LoanPayment>,
  ) {}

  async create(
    businessId: string,
    userId: string,
    dto: CreateLoanDto,
  ): Promise<Loan> {
    if (!dto.lenderName?.trim()) {
      throw new BadRequestException('Le nom du prêteur est requis');
    }
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Le montant doit être positif');
    }
    if (!dto.dueDate) {
      throw new BadRequestException('La date d\'échéance est requise');
    }
    if (!['supplier', 'microcredit'].includes(dto.loanType)) {
      throw new BadRequestException('Le type doit être "supplier" ou "microcredit"');
    }

    const status = this.computeStatus(
      dto.amount,
      0,
      new Date(dto.dueDate),
    );

    const loan = this.loanRepository.create({
      businessId,
      lenderName: dto.lenderName.trim(),
      lenderPhone: dto.lenderPhone?.trim() || null,
      loanType: dto.loanType,
      amount: dto.amount,
      amountPaid: 0,
      currency: 'XOF',
      description: dto.description?.trim() || null,
      dueDate: dto.dueDate,
      status,
      createdBy: userId,
    });

    return await this.loanRepository.save(loan);
  }

  async findAll(
    businessId: string,
    filters?: { status?: LoanStatus; limit?: number; offset?: number },
  ): Promise<Loan[]> {
    const qb = this.loanRepository
      .createQueryBuilder('l')
      .where('l.businessId = :businessId', { businessId })
      .orderBy('l.createdAt', 'DESC');

    if (filters?.status) {
      qb.andWhere('l.status = :status', { status: filters.status });
    }

    if (filters?.limit != null) {
      qb.take(filters.limit);
    }
    if (filters?.offset != null) {
      qb.skip(filters.offset);
    }

    return qb.getMany();
  }

  async findOne(businessId: string, id: string): Promise<Loan> {
    const loan = await this.loanRepository.findOne({
      where: { id, businessId },
      relations: ['payments'],
    });
    if (!loan) {
      throw new NotFoundException('Prêt non trouvé');
    }
    return loan;
  }

  async recordPayment(
    businessId: string,
    loanId: string,
    userId: string,
    amount: number,
    paymentDate?: Date,
    notes?: string,
  ): Promise<Loan> {
    const loan = await this.findOne(businessId, loanId);
    const outstanding = Number(loan.amount) - Number(loan.amountPaid);

    if (amount <= 0) {
      throw new BadRequestException('Le montant du remboursement doit être positif');
    }
    if (amount > outstanding) {
      throw new BadRequestException(
        `Le montant ne peut pas dépasser le solde restant (${outstanding.toLocaleString('fr-FR')} F CFA)`,
      );
    }

    const date = paymentDate ? new Date(paymentDate) : new Date();
    const newAmountPaid = Number(loan.amountPaid) + amount;

    const payment = this.paymentRepository.create({
      loan,
      amount,
      paymentDate: date,
      notes: notes?.trim() || null,
      createdBy: userId,
    });
    await this.paymentRepository.save(payment);

    const status = this.computeStatus(
      Number(loan.amount),
      newAmountPaid,
      new Date(loan.dueDate),
    );

    await this.loanRepository.update(
      { id: loanId, businessId },
      { amountPaid: newAmountPaid, status },
    );

    return this.findOne(businessId, loanId);
  }

  async recordFullPayment(
    businessId: string,
    loanId: string,
    userId: string,
    paymentDate?: Date,
    notes?: string,
  ): Promise<Loan> {
    const loan = await this.findOne(businessId, loanId);
    const outstanding = Number(loan.amount) - Number(loan.amountPaid);
    return this.recordPayment(
      businessId,
      loanId,
      userId,
      outstanding,
      paymentDate,
      notes,
    );
  }

  async getSummary(businessId: string): Promise<LoansSummary> {
    const loans = await this.loanRepository.find({
      where: { businessId },
    });

    let totalOutstanding = 0;
    let overdueCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const l of loans) {
      const amount = Number(l.amount);
      const paid = Number(l.amountPaid);
      const outstanding = amount - paid;
      if (outstanding > 0) {
        totalOutstanding += outstanding;
        if (l.dueDate && new Date(l.dueDate) < today) {
          overdueCount += 1;
        }
      }
    }

    const count = loans.filter(
      (l) => Number(l.amount) - Number(l.amountPaid) > 0,
    ).length;

    return { totalOutstanding, count, overdueCount };
  }

  async findByLender(
    businessId: string,
    lenderName: string,
  ): Promise<Loan[]> {
    const normalized = lenderName.trim().toLowerCase();
    return this.loanRepository
      .createQueryBuilder('l')
      .where('l.businessId = :businessId', { businessId })
      .andWhere('LOWER(l.lenderName) = :name', { name: normalized })
      .orderBy('l.createdAt', 'DESC')
      .getMany();
  }

  private computeStatus(
    amount: number,
    amountPaid: number,
    dueDate: Date,
  ): LoanStatus {
    const outstanding = amount - amountPaid;
    if (outstanding <= 0) return 'paid';
    if (amountPaid > 0) return 'partial';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    if (due < today) return 'overdue';

    return 'open';
  }
}
