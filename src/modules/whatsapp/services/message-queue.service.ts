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
    // Note: We don't await this to avoid blocking the webhook response
    // The processing will continue asynchronously after the webhook responds
    if (!this.isProcessing) {
      // Fire and forget, but ensure it starts
      this.processQueue().catch(error => {
        this.logger.error('Error in processQueue:', error);
        this.isProcessing = false; // Reset flag on error so it can be retried
      });
    }
  }

  /**
   * Process messages in the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) {
      this.logger.debug(`Skipping queue processing: isProcessing=${this.isProcessing}, queueLength=${this.messageQueue.length}`);
      return;
    }

    this.isProcessing = true;
    this.logger.log(`Starting message queue processing: ${this.messageQueue.length} messages in queue`);

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (!message) continue;

      try {
        this.logger.debug(`Processing message ${message.messageId} from ${message.from}: "${message.body}"`);
        await this.processMessage(message);
        this.logger.log(`Successfully processed message ${message.messageId}`);
      } catch (error) {
        this.logger.error(`Failed to process message ${message.messageId}:`, error);
        this.logger.error(`Error details: ${error.message}`, error.stack);
        await this.handleFailedMessage(message, error);
      }
    }

    this.isProcessing = false;
    this.logger.log(`Message queue processing completed. Remaining queue: ${this.messageQueue.length}`);
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
    this.logger.debug(`Processing message from ${message.from}: "${message.body}"`);
    
    if (this.botController) {
      try {
        // Use the bot controller to process the message
        this.logger.debug(`Calling botController.processMessage for message ${message.messageId}`);
        const result = await this.botController.processMessage(message);
        this.logger.debug(`Bot controller processed message ${message.messageId}:`, {
          success: result.success,
          messageLength: result.message?.length || 0
        });
      } catch (error) {
        this.logger.error(`Bot controller error processing message ${message.messageId}:`, error);
        this.logger.error(`Error stack: ${error.stack}`);
        throw error;
      }
    } else {
      // Fallback: just log the message
      this.logger.warn('No bot controller set, message processing skipped');
      this.logger.warn(`Message ${message.messageId} from ${message.from} will not be processed`);
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