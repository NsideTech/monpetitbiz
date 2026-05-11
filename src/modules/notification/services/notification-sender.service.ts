import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from '../entities/notification.entity';
import { TwilioWhatsAppService } from '../../whatsapp/services/twilio-whatsapp.service';

@Injectable()
export class NotificationSenderService {
  private readonly logger = new Logger(NotificationSenderService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly twilioWhatsApp: TwilioWhatsAppService,
  ) {}

  async createAndSend(
    businessId: string,
    userId: string | null,
    type: NotificationType,
    content: string,
    phoneNumber: string,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      businessId,
      userId,
      type,
      content,
      status: 'pending',
    });
    await this.notificationRepository.save(notification);

    try {
      await this.twilioWhatsApp.sendMessage(phoneNumber, content);
      notification.status = 'sent';
      notification.sentAt = new Date();
    } catch (err) {
      notification.status = 'failed';
      notification.errorMessage = (err as Error).message;
      this.logger.error(
        `Notification ${notification.id} (${type}) failed for business ${businessId}`,
        err,
      );
    }

    return this.notificationRepository.save(notification);
  }
}
