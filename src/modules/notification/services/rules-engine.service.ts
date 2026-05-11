import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, Between } from 'typeorm';
import { Notification, NotificationType } from '../entities/notification.entity';
import { NotificationSenderService } from './notification-sender.service';
import { DailyGoalService } from '../../dashboard/services/daily-goal.service';
import { Transaction, TransactionType } from '../../transaction/entities/transaction.entity';
import { Business } from '../../auth/entities/business.entity';
import { User, UserRole } from '../../auth/entities/user.entity';

@Injectable()
export class RulesEngineService {
  private readonly logger = new Logger(RulesEngineService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationSender: NotificationSenderService,
    private readonly dailyGoalService: DailyGoalService,
  ) {}

  // ─── Règle 1 : Rappel inactivité ─────────────────────────────────────────

  async checkInactivityForAllBusinesses(): Promise<void> {
    const businesses = await this.businessRepository.find({ where: { isActive: true } });
    await Promise.allSettled(
      businesses.map((b) => this.checkInactivity(b).catch((err) =>
        this.logger.error(`Inactivity check failed for business ${b.id}`, err),
      )),
    );
  }

  private async checkInactivity(business: Business): Promise<void> {
    if (await this.alreadySent(business.id, NotificationType.INACTIVITY_REMINDER, 20)) return;

    const todayStart = this.todayStart();
    const saleCount = await this.transactionRepository.count({
      where: {
        businessId: business.id,
        type: TransactionType.SALE,
        createdAt: MoreThan(todayStart),
      },
    });

    if (saleCount > 0) return;

    const owner = await this.resolveOwner(business.id);
    if (!owner) return;

    await this.notificationSender.createAndSend(
      business.id,
      owner.id,
      NotificationType.INACTIVITY_REMINDER,
      `Bonjour ! Vous n'avez pas encore enregistré de vente aujourd'hui.\nTapez 'vente' pour commencer.`,
      owner.phoneNumber,
    );
  }

  // ─── Règle 2 : Alerte baisse d'activité ──────────────────────────────────

  async checkActivityDropForAllBusinesses(): Promise<void> {
    const businesses = await this.businessRepository.find({ where: { isActive: true } });
    await Promise.allSettled(
      businesses.map((b) => this.checkActivityDrop(b).catch((err) =>
        this.logger.error(`Activity drop check failed for business ${b.id}`, err),
      )),
    );
  }

  private async checkActivityDrop(business: Business): Promise<void> {
    if (await this.alreadySent(business.id, NotificationType.ACTIVITY_DROP_ALERT, 20)) return;

    const todayStart = this.todayStart();
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [todayTransactions, last7DaysTransactions] = await Promise.all([
      this.transactionRepository.find({
        where: { businessId: business.id, type: TransactionType.SALE, createdAt: MoreThan(todayStart) },
      }),
      this.transactionRepository.find({
        where: { businessId: business.id, type: TransactionType.SALE, createdAt: Between(sevenDaysAgo, todayStart) },
      }),
    ]);

    const todayRevenue = todayTransactions.reduce((s, t) => s + Number(t.amount), 0);
    const avgLast7Days = last7DaysTransactions.reduce((s, t) => s + Number(t.amount), 0) / 7;

    if (avgLast7Days === 0 || todayRevenue >= avgLast7Days * 0.6) return;

    const owner = await this.resolveOwner(business.id);
    if (!owner) return;

    const currency = business.currency || 'XOF';
    const avg = Math.round(avgLast7Days).toLocaleString('fr-FR');
    const today = Math.round(todayRevenue).toLocaleString('fr-FR');

    await this.notificationSender.createAndSend(
      business.id,
      owner.id,
      NotificationType.ACTIVITY_DROP_ALERT,
      `⚠️ Votre chiffre d'affaires aujourd'hui est en baisse.\nHabituellement : ${avg} ${currency}, aujourd'hui : ${today} ${currency}.`,
      owner.phoneNumber,
    );
  }

  // ─── Règle 3 : Objectif atteint (event-driven) ───────────────────────────

  async evaluateGoalRule(businessId: string, userId: string): Promise<void> {
    if (await this.alreadySent(businessId, NotificationType.GOAL_REACHED, 20)) return;

    const todayStart = this.todayStart();
    const todayTransactions = await this.transactionRepository.find({
      where: { businessId, type: TransactionType.SALE, createdAt: MoreThan(todayStart) },
    });
    const todayRevenue = todayTransactions.reduce((s, t) => s + Number(t.amount), 0);

    const { isReached, goal } = await this.dailyGoalService.getTodayGoalWithProgress(
      businessId,
      todayRevenue,
    );
    if (!isReached || !goal) return;

    const owner = await this.resolveOwner(businessId);
    if (!owner) return;

    const business = await this.businessRepository.findOne({ where: { id: businessId } });
    const currency = business?.currency || 'XOF';
    const amount = Math.round(todayRevenue).toLocaleString('fr-FR');

    await this.notificationSender.createAndSend(
      businessId,
      owner.id,
      NotificationType.GOAL_REACHED,
      `🎯 Objectif du jour atteint ! ${amount} ${currency} enregistrés. Excellente journée !`,
      owner.phoneNumber,
    );
  }

  // ─── Règle 4 : Signal de régularité (hebdomadaire) ───────────────────────

  async checkRegularityForAllBusinesses(): Promise<void> {
    const businesses = await this.businessRepository.find({ where: { isActive: true } });
    await Promise.allSettled(
      businesses.map((b) => this.checkRegularity(b).catch((err) =>
        this.logger.error(`Regularity check failed for business ${b.id}`, err),
      )),
    );
  }

  private async checkRegularity(business: Business): Promise<void> {
    if (await this.alreadySent(business.id, NotificationType.REGULARITY_SIGNAL, 7 * 24)) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const transactions = await this.transactionRepository.find({
      where: {
        businessId: business.id,
        type: TransactionType.SALE,
        createdAt: MoreThan(sevenDaysAgo),
      },
    });

    const activeDays = new Set(
      transactions.map((t) => t.createdAt.toISOString().slice(0, 10)),
    ).size;

    if (activeDays < 5) return;

    const owner = await this.resolveOwner(business.id);
    if (!owner) return;

    await this.notificationSender.createAndSend(
      business.id,
      owner.id,
      NotificationType.REGULARITY_SIGNAL,
      `👏 ${activeDays} jours d'enregistrement cette semaine. Continuez comme ça !`,
      owner.phoneNumber,
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async alreadySent(
    businessId: string,
    type: NotificationType,
    withinHours: number,
  ): Promise<boolean> {
    const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);
    const count = await this.notificationRepository.count({
      where: { businessId, type, status: 'sent', sentAt: MoreThan(since) },
    });
    return count > 0;
  }

  private async resolveOwner(businessId: string): Promise<User | null> {
    const owner = await this.userRepository.findOne({
      where: { businessId, role: UserRole.OWNER, isActive: true },
    });
    if (!owner) {
      this.logger.warn(`No active owner found for business ${businessId} — notification skipped`);
    }
    return owner;
  }

  private todayStart(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
