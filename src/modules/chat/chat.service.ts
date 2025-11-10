import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {ChatMessage} from './entities/chat-message.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
  ) {}

  /**
   * Save message to history
   */
  async saveMessage(data: {
    userId: string;
    businessId: string;
    message: string;
    response: string;
    messageId: string;
    timestamp: Date;
  }): Promise<ChatMessage> {
    const chatMessage = this.chatMessageRepository.create({
      userId: data.userId,
      businessId: data.businessId,
      message: data.message,
      response: data.response,
      messageId: data.messageId,
      timestamp: data.timestamp,
    });

    return await this.chatMessageRepository.save(chatMessage);
  }

  /**
   * Get chat history for a user
   */
  async getHistory(
    userId: string,
    limit?: number,
  ): Promise<{
    messages: Array<{
      id: string;
      message: string;
      response: string;
      timestamp: string;
    }>;
    total: number;
  }> {
    const query = this.chatMessageRepository
      .createQueryBuilder('chat')
      .where('chat.userId = :userId', {userId})
      .orderBy('chat.timestamp', 'DESC');

    if (limit) {
      query.limit(limit);
    }

    const [messages, total] = await query.getManyAndCount();

    return {
      messages: messages.map((msg) => ({
        id: msg.id,
        message: msg.message,
        response: msg.response,
        timestamp: msg.timestamp.toISOString(),
      })),
      total,
    };
  }
}

