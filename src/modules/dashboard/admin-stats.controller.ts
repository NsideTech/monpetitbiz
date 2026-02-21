import { 
  Controller, 
  Get, 
  UseGuards
} from '@nestjs/common';
import { ServiceTokenGuard } from '../auth/guards/service-token.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../auth/entities/business.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { User } from '../auth/entities/user.entity';

/**
 * Admin Statistics Controller
 * 
 * Provides admin endpoints for platform-wide statistics.
 * Uses service token authentication to allow admin portal access.
 */
@Controller('admin/stats')
@UseGuards(ServiceTokenGuard)
export class AdminStatsController {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Get platform-wide statistics
   */
  @Get()
  async getPlatformStats() {
    const [
      totalBusinesses,
      totalTransactions,
      totalSales,
      totalExpenses,
      activeUsers,
    ] = await Promise.all([
      this.businessRepository.count(),
      this.transactionRepository.count(),
      this.getTotalSales(),
      this.getTotalExpenses(),
      this.getActiveUsersCount(),
    ]);

    return {
      totalBusinesses,
      totalTransactions,
      totalSales,
      totalExpenses,
      profit: totalSales - totalExpenses,
      activeUsers,
    };
  }

  /**
   * Get all businesses with their statistics
   */
  @Get('businesses')
  async getAllBusinessesWithStats() {
    const businesses = await this.businessRepository.find({
      order: { createdAt: 'DESC' },
    });

    const businessesWithStats = await Promise.all(
      businesses.map(async (business) => {
        const [transactionCount, totalSales, totalExpenses, userCount] = await Promise.all([
          this.transactionRepository.count({ where: { businessId: business.id } }),
          this.getBusinessSales(business.id),
          this.getBusinessExpenses(business.id),
          this.userRepository.count({ 
            where: { businessId: business.id, isActive: true } 
          }),
        ]);

        return {
          business: {
            id: business.id,
            name: business.name,
            businessCode: business.businessCode,
            currency: business.currency,
            timezone: business.timezone,
            ownerName: business.ownerName,
            country: business.country,
            createdAt: business.createdAt.toISOString(),
          },
          transactionCount,
          totalSales,
          totalExpenses,
          profit: totalSales - totalExpenses,
          userCount,
        };
      })
    );

    return businessesWithStats;
  }

  private async getTotalSales(): Promise<number> {
    const result = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('COALESCE(SUM(transaction.amount), 0)', 'total')
      .where('transaction.type = :type', { type: 'sale' })
      .getRawOne();
    
    return Number(result?.total || 0);
  }

  private async getTotalExpenses(): Promise<number> {
    const result = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('COALESCE(SUM(transaction.amount), 0)', 'total')
      .where('transaction.type = :type', { type: 'expense' })
      .getRawOne();
    
    return Number(result?.total || 0);
  }

  private async getBusinessSales(businessId: string): Promise<number> {
    const result = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('COALESCE(SUM(transaction.amount), 0)', 'total')
      .where('transaction.businessId = :businessId', { businessId })
      .andWhere('transaction.type = :type', { type: 'sale' })
      .getRawOne();
    
    return Number(result?.total || 0);
  }

  private async getBusinessExpenses(businessId: string): Promise<number> {
    const result = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('COALESCE(SUM(transaction.amount), 0)', 'total')
      .where('transaction.businessId = :businessId', { businessId })
      .andWhere('transaction.type = :type', { type: 'expense' })
      .getRawOne();
    
    return Number(result?.total || 0);
  }

  private async getActiveUsersCount(): Promise<number> {
    return await this.userRepository.count({ where: { isActive: true } });
  }
}

