import { Injectable, Logger } from '@nestjs/common';
import { ProcessedMessage } from '../interfaces/webhook.interface';

// Forward declaration to avoid circular dependency
interface IBotController {
  processMessage(message: ProcessedMessage): Promise<any>;
}

interface QueuedMessage extends ProcessedMessage {
  retryCount: number;
  queuedAt: Date;
}

@Injectable()
export class MessageQueueService {
  private readonly logger = new Logger(MessageQueueService.name);
  private readonly messageQueue: QueuedMessage[] = [];
  private readonly processingQueue: Map<string, QueuedMessage> = new Map();
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second
  private isProcessing = false;
  private botController: IBotController | null = null;

  /**
   * Add a message to the processing queue
   */
  async enqueue(message: ProcessedMessage): Promise<void> {
    const queuedMessage: QueuedMessage = {
      ...message,
      retryCount: 0,
      queuedAt: new Date(),
    };

    this.messageQueue.push(queuedMessage);
    this.logger.log(`Message ${message.messageId} added to queue. Queue size: ${this.messageQueue.length}`);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process messages in the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.logger.log('Starting message queue processing');

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (!message) continue;

      try {
        await this.processMessage(message);
        this.logger.log(`Successfully processed message ${message.messageId}`);
      } catch (error) {
        this.logger.error(`Failed to process message ${message.messageId}:`, error);
        await this.handleFailedMessage(message, error);
      }
    }

    this.isProcessing = false;
    this.logger.log('Message queue processing completed');
  }

  /**
   * Process a single message
   */
  private async processMessage(message: QueuedMessage): Promise<void> {
    // Add to processing map to track active processing
    this.processingQueue.set(message.messageId, message);

    try {
      // Simulate message processing - this will be replaced with actual business logic
      await this.simulateProcessing(message);
      
      // Remove from processing map on success
      this.processingQueue.delete(message.messageId);
    } catch (error) {
      // Remove from processing map on error
      this.processingQueue.delete(message.messageId);
      throw error;
    }
  }

  /**
   * Set the bot controller for message processing
   */
  setBotController(botController: IBotController): void {
    this.botController = botController;
    this.logger.log('Bot controller set for message processing');
  }

  /**
   * Process message using bot controller
   */
  private async simulateProcessing(message: QueuedMessage): Promise<void> {
    this.logger.debug(`Processing message from ${message.from}: ${message.body}`);
    
    if (this.botController) {
      // Use the bot controller to process the message
      await this.botController.processMessage(message);
    } else {
      // Fallback: just log the message
      this.logger.warn('No bot controller set, message processing skipped');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Handle failed message processing
   */
  private async handleFailedMessage(message: QueuedMessage, error: any): Promise<void> {
    message.retryCount++;

    if (message.retryCount <= this.maxRetries) {
      this.logger.warn(`Retrying message ${message.messageId} (attempt ${message.retryCount}/${this.maxRetries})`);
      
      // Add delay before retry
      setTimeout(() => {
        this.messageQueue.unshift(message); // Add to front of queue for priority
      }, this.retryDelay * message.retryCount);
    } else {
      this.logger.error(`Message ${message.messageId} failed after ${this.maxRetries} attempts. Moving to dead letter queue.`);
      await this.moveToDeadLetterQueue(message, error);
    }
  }

  /**
   * Move failed messages to dead letter queue for manual review
   */
  private async moveToDeadLetterQueue(message: QueuedMessage, error: any): Promise<void> {
    // TODO: Implement dead letter queue storage (database or external service)
    this.logger.error(`Dead letter queue: Message ${message.messageId} from ${message.from}`, {
      message: message.body,
      error: error.message,
      retryCount: message.retryCount,
      queuedAt: message.queuedAt,
    });
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    queueSize: number;
    processingCount: number;
    isProcessing: boolean;
  } {
    return {
      queueSize: this.messageQueue.length,
      processingCount: this.processingQueue.size,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Clear the queue (for testing purposes)
   */
  clearQueue(): void {
    this.messageQueue.length = 0;
    this.processingQueue.clear();
    this.isProcessing = false;
    this.logger.log('Message queue cleared');
  }
}