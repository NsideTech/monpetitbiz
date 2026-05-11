import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationSenderService } from '../services/notification-sender.service';
import { Notification, NotificationType } from '../entities/notification.entity';
import { TwilioWhatsAppService } from '../../whatsapp/services/twilio-whatsapp.service';

const mockNotificationRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
});

const mockTwilioWhatsApp = () => ({
  sendMessage: jest.fn(),
});

describe('NotificationSenderService', () => {
  let service: NotificationSenderService;
  let repo: jest.Mocked<Repository<Notification>>;
  let twilio: jest.Mocked<TwilioWhatsAppService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationSenderService,
        { provide: getRepositoryToken(Notification), useFactory: mockNotificationRepository },
        { provide: TwilioWhatsAppService, useFactory: mockTwilioWhatsApp },
      ],
    }).compile();

    service = module.get(NotificationSenderService);
    repo = module.get(getRepositoryToken(Notification));
    twilio = module.get(TwilioWhatsAppService);
  });

  it('crée la notification avec status sent quand Twilio réussit', async () => {
    const notification = { id: 'notif-1', status: 'pending' } as Notification;
    repo.create.mockReturnValue(notification);
    repo.save.mockResolvedValue({ ...notification, status: 'sent' } as Notification);
    twilio.sendMessage.mockResolvedValue(undefined as any);

    const result = await service.createAndSend(
      'biz-1',
      'user-1',
      NotificationType.GOAL_REACHED,
      '🎯 Objectif atteint !',
      '+22670000001',
    );

    expect(twilio.sendMessage).toHaveBeenCalledWith('+22670000001', '🎯 Objectif atteint !');
    expect(notification.status).toBe('sent');
    expect(notification.sentAt).toBeInstanceOf(Date);
    expect(repo.save).toHaveBeenCalledTimes(2);
    expect(result).toBeDefined();
  });

  it('crée la notification avec status failed quand Twilio échoue', async () => {
    const notification = { id: 'notif-2', status: 'pending' } as Notification;
    repo.create.mockReturnValue(notification);
    repo.save.mockResolvedValue({ ...notification, status: 'failed' } as Notification);
    twilio.sendMessage.mockRejectedValue(new Error('Twilio unreachable'));

    await service.createAndSend(
      'biz-1',
      null,
      NotificationType.INACTIVITY_REMINDER,
      'Bonjour !',
      '+22670000001',
    );

    expect(notification.status).toBe('failed');
    expect(notification.errorMessage).toBe('Twilio unreachable');
    expect(repo.save).toHaveBeenCalledTimes(2);
  });
});
