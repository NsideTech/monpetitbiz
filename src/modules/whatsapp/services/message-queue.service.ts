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
  private processingStarted = false; // Track if processing has started
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
    // On Vercel, we need to ensure processing starts before the function can terminate
    if (!this.isProcessing && !this.processingStarted) {
      this.processingStarted = true;
      
      // Use setImmediate to ensure processQueue starts even on Vercel
      // This guarantees the async task is scheduled before the function can terminate
      setImmediate(() => {
        this.logger.log(`[enqueue] Scheduling processQueue() for ${this.messageQueue.length} messages via setImmediate`);
        this.processQueue().catch(error => {
          this.logger.error('[enqueue] Error in processQueue:', error);
          this.logger.error(`[enqueue] Error stack: ${error.stack}`);
          this.isProcessing = false;
          this.processingStarted = false; // Reset flag on error so it can be retried
        });
      });
      
      // Also try process.nextTick as a backup
      process.nextTick(() => {
        if (!this.isProcessing && this.messageQueue.length > 0) {
          this.logger.log(`[enqueue] Backup: Starting processQueue() via process.nextTick`);
          this.processQueue().catch(error => {
            this.logger.error('[enqueue] Backup processQueue error:', error);
            this.isProcessing = false;
            this.processingStarted = false;
          });
        }
      });
      
      this.logger.log(`[enqueue] processQueue() scheduled (setImmediate + process.nextTick)`);
    } else {
      this.logger.debug(`[enqueue] Queue processing already ${this.isProcessing ? 'running' : 'started'}, skipping`);
    }
  }

  /**
   * Process messages in the queue
   */
  private async processQueue(): Promise<void> {
    this.logger.log(`[processQueue] Called - isProcessing: ${this.isProcessing}, queueLength: ${this.messageQueue.length}`);
    
    if (this.isProcessing) {
      this.logger.debug(`[processQueue] Already processing, skipping`);
      return;
    }
    
    if (this.messageQueue.length === 0) {
      this.logger.debug(`[processQueue] Queue is empty, skipping`);
      return;
    }

    this.isProcessing = true;
    this.logger.log(`[processQueue] Starting message queue processing: ${this.messageQueue.length} messages in queue`);

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (!message) {
        this.logger.warn(`[processQueue] Shifted null/undefined message from queue`);
        continue;
      }

      try {
        this.logger.log(`[processQueue] Processing message ${message.messageId} from ${message.from}: "${message.body}"`);
        await this.processMessage(message);
        this.logger.log(`[processQueue] Successfully processed message ${message.messageId}`);
      } catch (error) {
        this.logger.error(`[processQueue] Failed to process message ${message.messageId}:`, error);
        this.logger.error(`[processQueue] Error details: ${error.message}`, error.stack);
        await this.handleFailedMessage(message, error);
      }
    }

    this.isProcessing = false;
    this.processingStarted = false; // Reset flag when done
    this.logger.log(`[processQueue] Message queue processing completed. Remaining queue: ${this.messageQueue.length}`);
    
    // If there are still messages in queue, restart processing
    if (this.messageQueue.length > 0) {
      this.logger.log(`[processQueue] Restarting processing for ${this.messageQueue.length} remaining messages`);
      this.processingStarted = true;
      setImmediate(() => {
        this.processQueue().catch(error => {
          this.logger.error('[processQueue] Error in restart:', error);
          this.isProcessing = false;
          this.processingStarted = false;
        });
      });
    }
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
   * Get the bot controller for direct message processing
   * Used for synchronous processing of critical messages on Vercel
   */
  getBotController(): IBotController | null {
    return this.botController;
  }

  /**
   * Process message using bot controller
   */
  private async simulateProcessing(message: QueuedMessage): Promise<void> {
    this.logger.log(`[simulateProcessing] Processing message ${message.messageId} from ${message.from}: "${message.body}"`);
    
    if (this.botController) {
      try {
        // Use the bot controller to process the message
        this.logger.log(`[simulateProcessing] Calling botController.processMessage for message ${message.messageId}`);
        const result = await this.botController.processMessage(message);
        this.logger.log(`[simulateProcessing] Bot controller processed message ${message.messageId}:`, {
          success: result.success,
          messageLength: result.message?.length || 0,
          hasMessage: !!result.message
        });
        
        if (result.message) {
          this.logger.debug(`[simulateProcessing] Response message preview: ${result.message.substring(0, 100)}...`);
        }
      } catch (error) {
        this.logger.error(`[simulateProcessing] Bot controller error processing message ${message.messageId}:`, error);
        this.logger.error(`[simulateProcessing] Error stack: ${error.stack}`);
        throw error;
      }
    } else {
      // Fallback: just log the message
      this.logger.error('[simulateProcessing] No bot controller set, message processing skipped');
      this.logger.error(`[simulateProcessing] Message ${message.messageId} from ${message.from} will not be processed`);
      throw new Error('Bot controller not set');
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