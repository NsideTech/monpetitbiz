import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RulesEngineService } from './rules-engine.service';

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);

  constructor(private readonly rulesEngine: RulesEngineService) {}

  // Africa/Dakar = UTC+0 : pas de décalage. Si d'autres timezones sont ajoutées,
  // revoir la logique de fenêtre horaire dans RulesEngineService.

  @Cron('0 14 * * *') // 14h00 UTC = 14h00 Dakar
  async runInactivityCheck(): Promise<void> {
    this.logger.log('Cron: inactivity check started');
    await this.rulesEngine.checkInactivityForAllBusinesses();
  }

  @Cron('0 18 * * *') // 18h00 UTC = 18h00 Dakar
  async runActivityDropCheck(): Promise<void> {
    this.logger.log('Cron: activity drop check started');
    await this.rulesEngine.checkActivityDropForAllBusinesses();
  }

  @Cron('0 9 * * 1') // lundi 09h00 UTC
  async runRegularityCheck(): Promise<void> {
    this.logger.log('Cron: regularity check started');
    await this.rulesEngine.checkRegularityForAllBusinesses();
  }
}
