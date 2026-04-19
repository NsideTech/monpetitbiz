import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyGoal } from '../entities/daily-goal.entity';

export interface DailyGoalProgress {
  goal: DailyGoal | null;
  progress: number;
  progressPercent: number;
  isReached: boolean;
}

@Injectable()
export class DailyGoalService {
  constructor(
    @InjectRepository(DailyGoal)
    private readonly dailyGoalRepository: Repository<DailyGoal>,
  ) {}

  /**
   * Upsert : désactive l'objectif actif existant pour ce jour avant d'en créer un nouveau.
   * dayOfWeek=null signifie "tous les jours".
   */
  async upsertGoal(
    businessId: string,
    targetAmount: number,
    dayOfWeek: number | null = null,
  ): Promise<DailyGoal> {
    if (targetAmount <= 0) {
      throw new BadRequestException('Le montant cible doit être positif');
    }

    // Désactiver l'objectif actif existant pour ce créneau (jour spécifique ou "tous les jours")
    const whereClause: Partial<DailyGoal> = { businessId, isActive: true };
    if (dayOfWeek !== null) {
      whereClause.dayOfWeek = dayOfWeek;
    }
    await this.dailyGoalRepository.update(whereClause, { isActive: false });

    const goal = this.dailyGoalRepository.create({
      businessId,
      targetAmount,
      dayOfWeek,
      isActive: true,
    });
    return this.dailyGoalRepository.save(goal);
  }

  /**
   * Retourne l'objectif du jour courant.
   * Priorité : objectif pour le jour spécifique > objectif "tous les jours" (dayOfWeek null).
   */
  async getTodayGoal(businessId: string): Promise<DailyGoal | null> {
    const today = new Date().getDay(); // 0=dim, 1=lun ... 6=sam
    const goals = await this.dailyGoalRepository.find({
      where: [
        { businessId, isActive: true, dayOfWeek: today },
        { businessId, isActive: true, dayOfWeek: null },
      ],
      order: { dayOfWeek: 'DESC' }, // priorité au jour spécifique sur "tous les jours"
    });
    return goals[0] ?? null;
  }

  /**
   * Retourne l'objectif du jour et la progression en fonction du CA réalisé aujourd'hui.
   */
  async getTodayGoalWithProgress(
    businessId: string,
    todaySales: number,
  ): Promise<DailyGoalProgress> {
    const goal = await this.getTodayGoal(businessId);
    if (!goal) {
      return { goal: null, progress: todaySales, progressPercent: 0, isReached: false };
    }

    const target = Number(goal.targetAmount);
    const progressPercent = target > 0 ? Math.round((todaySales / target) * 100) : 0;

    return {
      goal,
      progress: todaySales,
      progressPercent,
      isReached: todaySales >= target,
    };
  }
}
