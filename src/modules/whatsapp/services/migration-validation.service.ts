import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappService } from '../whatsapp.service';
import { TwilioWhatsAppService } from './twilio-whatsapp.service';
import { DualProviderService, WhatsAppProvider } from './dual-provider.service';

export interface MigrationStatus {
  phase: 'preparation' | 'testing' | 'partial' | 'complete' | 'rollback';
  startedAt: Date;
  lastUpdated: Date;
  completedTasks: string[];
  failedTasks: string[];
  metrics: MigrationMetrics;
}

export interface MigrationMetrics {
  totalMessages: number;
  successfulMessages: number;
  failedMessages: number;
  metaMessages: number;
  twilioMessages: number;
  averageResponseTime: number;
  errorRate: number;
  lastCalculated: Date;
}

export interface ProviderComparison {
  messageId: string;
  timestamp: Date;
  to: string;
  message: string;
  metaResult?: {
    success: boolean;
    responseTime: number;
    messageId?: string;
    error?: string;
  };
  twilioResult?: {
    success: boolean;
    responseTime: number;
    messageId?: string;
    error?: string;
  };
  comparison: {
    bothSucceeded: boolean;
    bothFailed: boolean;
    onlyMetaSucceeded: boolean;
    onlyTwilioSucceeded: boolean;
    responseTimeDifference: number;
  };
}

export interface RollbackPlan {
  id: string;
  createdAt: Date;
  reason: string;
  steps: RollbackStep[];
  status: 'prepared' | 'executing' | 'completed' | 'failed';
}

export interface RollbackStep {
  id: string;
  description: string;
  action: 'config_change' | 'service_restart' | 'database_update' | 'validation';
  parameters: Record<string, any>;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  error?: string;
}

@Injectable()
export class MigrationValidationService {
  private readonly logger = new Logger(MigrationValidationService.name);
  private migrationStatus: MigrationStatus;
  private comparisonResults: ProviderComparison[] = [];
  private rollbackPlans: RollbackPlan[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly whatsappService: WhatsappService,
    private readonly twilioService: TwilioWhatsAppService,
    private readonly dualProviderService: DualProviderService,
  ) {
    this.initializeMigrationStatus();
  }

  /**
   * Initialize migration status from configuration or defaults
   */
  private initializeMigrationStatus(): void {
    this.migrationStatus = {
      phase: this.configService.get<string>('MIGRATION_PHASE', 'preparation') as any,
      startedAt: new Date(this.configService.get<string>('MIGRATION_STARTED_AT', new Date().toISOString())),
      lastUpdated: new Date(),
      completedTasks: this.configService.get<string>('MIGRATION_COMPLETED_TASKS', '').split(',').filter(Boolean),
      failedTasks: this.configService.get<string>('MIGRATION_FAILED_TASKS', '').split(',').filter(Boolean),
      metrics: {
        totalMessages: 0,
        successfulMessages: 0,
        failedMessages: 0,
        metaMessages: 0,
        twilioMessages: 0,
        averageResponseTime: 0,
        errorRate: 0,
        lastCalculated: new Date(),
      },
    };
  }

  /**
   * Compare message sending between Meta and Twilio providers
   */
  async compareProviderResponses(
    to: string,
    message: string,
    testBoth: boolean = true
  ): Promise<ProviderComparison> {
    const comparisonId = `comparison_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();

    this.logger.debug(`Starting provider comparison for message to ${to}`);

    const comparison: ProviderComparison = {
      messageId: comparisonId,
      timestamp,
      to,
      message,
      comparison: {
        bothSucceeded: false,
        bothFailed: false,
        onlyMetaSucceeded: false,
        onlyTwilioSucceeded: false,
        responseTimeDifference: 0,
      },
    };

    // Test Meta provider
    if (testBoth || this.shouldTestProvider('meta')) {
      const metaStartTime = Date.now();
      try {
        await this.whatsappService.sendMessageWithProvider(to, message, 'meta');
        const metaEndTime = Date.now();
        
        comparison.metaResult = {
          success: true,
          responseTime: metaEndTime - metaStartTime,
          messageId: `meta_${comparisonId}`,
        };
        
        this.logger.debug(`Meta provider succeeded in ${comparison.metaResult.responseTime}ms`);
      } catch (error) {
        const metaEndTime = Date.now();
        comparison.metaResult = {
          success: false,
          responseTime: metaEndTime - metaStartTime,
          error: error.message,
        };
        
        this.logger.warn(`Meta provider failed: ${error.message}`);
      }
    }

    // Test Twilio provider
    if (testBoth || this.shouldTestProvider('twilio')) {
      const twilioStartTime = Date.now();
      try {
        const result = await this.twilioService.sendMessage(to, message);
        const twilioEndTime = Date.now();
        
        comparison.twilioResult = {
          success: true,
          responseTime: twilioEndTime - twilioStartTime,
          messageId: result.sid,
        };
        
        this.logger.debug(`Twilio provider succeeded in ${comparison.twilioResult.responseTime}ms`);
      } catch (error) {
        const twilioEndTime = Date.now();
        comparison.twilioResult = {
          success: false,
          responseTime: twilioEndTime - twilioStartTime,
          error: error.message,
        };
        
        this.logger.warn(`Twilio provider failed: ${error.message}`);
      }
    }

    // Calculate comparison results
    this.calculateComparison(comparison);

    // Store comparison result
    this.comparisonResults.push(comparison);

    // Update metrics
    this.updateMigrationMetrics(comparison);

    this.logger.log(`Provider comparison completed: ${JSON.stringify(comparison.comparison)}`);

    return comparison;
  }

  /**
   * Get current migration status
   */
  getMigrationStatus(): MigrationStatus {
    return { ...this.migrationStatus };
  }

  /**
   * Update migration phase
   */
  async updateMigrationPhase(
    phase: MigrationStatus['phase'],
    reason?: string
  ): Promise<void> {
    const previousPhase = this.migrationStatus.phase;
    
    this.migrationStatus.phase = phase;
    this.migrationStatus.lastUpdated = new Date();

    this.logger.log(`Migration phase updated from ${previousPhase} to ${phase}${reason ? `: ${reason}` : ''}`);

    // Create rollback plan if moving to a critical phase
    if (phase === 'partial' || phase === 'complete') {
      await this.createRollbackPlan(`Phase transition to ${phase}`, previousPhase);
    }
  }

  /**
   * Mark a migration task as completed
   */
  markTaskCompleted(taskId: string): void {
    if (!this.migrationStatus.completedTasks.includes(taskId)) {
      this.migrationStatus.completedTasks.push(taskId);
      this.migrationStatus.lastUpdated = new Date();
      
      // Remove from failed tasks if it was there
      this.migrationStatus.failedTasks = this.migrationStatus.failedTasks.filter(id => id !== taskId);
      
      this.logger.log(`Migration task completed: ${taskId}`);
    }
  }

  /**
   * Mark a migration task as failed
   */
  markTaskFailed(taskId: string, error?: string): void {
    if (!this.migrationStatus.failedTasks.includes(taskId)) {
      this.migrationStatus.failedTasks.push(taskId);
      this.migrationStatus.lastUpdated = new Date();
      
      this.logger.error(`Migration task failed: ${taskId}${error ? ` - ${error}` : ''}`);
    }
  }

  /**
   * Get comparison results with optional filtering
   */
  getComparisonResults(
    limit?: number,
    onlyFailures?: boolean
  ): ProviderComparison[] {
    let results = [...this.comparisonResults];

    if (onlyFailures) {
      results = results.filter(r => 
        (r.metaResult && !r.metaResult.success) || 
        (r.twilioResult && !r.twilioResult.success)
      );
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (limit) {
      results = results.slice(0, limit);
    }

    return results;
  }

  /**
   * Create a rollback plan
   */
  async createRollbackPlan(
    reason: string,
    targetPhase?: MigrationStatus['phase']
  ): Promise<RollbackPlan> {
    const rollbackId = `rollback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const rollbackPlan: RollbackPlan = {
      id: rollbackId,
      createdAt: new Date(),
      reason,
      status: 'prepared',
      steps: this.generateRollbackSteps(targetPhase),
    };

    this.rollbackPlans.push(rollbackPlan);
    
    this.logger.log(`Rollback plan created: ${rollbackId} - ${reason}`);
    
    return rollbackPlan;
  }

  /**
   * Execute a rollback plan
   */
  async executeRollback(rollbackId: string): Promise<void> {
    const plan = this.rollbackPlans.find(p => p.id === rollbackId);
    if (!plan) {
      throw new Error(`Rollback plan not found: ${rollbackId}`);
    }

    if (plan.status !== 'prepared') {
      throw new Error(`Rollback plan ${rollbackId} is not in prepared state`);
    }

    this.logger.warn(`Starting rollback execution: ${rollbackId} - ${plan.reason}`);
    
    plan.status = 'executing';

    try {
      for (const step of plan.steps) {
        await this.executeRollbackStep(step);
      }

      plan.status = 'completed';
      this.logger.log(`Rollback completed successfully: ${rollbackId}`);
      
      // Update migration status to rollback
      await this.updateMigrationPhase('rollback', `Rollback executed: ${plan.reason}`);
      
    } catch (error) {
      plan.status = 'failed';
      this.logger.error(`Rollback failed: ${rollbackId} - ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all rollback plans
   */
  getRollbackPlans(): RollbackPlan[] {
    return [...this.rollbackPlans];
  }

  /**
   * Validate migration readiness
   */
  async validateMigrationReadiness(): Promise<{
    ready: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check provider configurations
    const providerConfig = this.dualProviderService.getProviderConfiguration();
    
    if (!providerConfig.twilio.configured) {
      issues.push('Twilio provider is not properly configured');
    }

    if (!providerConfig.meta.configured) {
      issues.push('Meta provider is not properly configured');
    }

    // Check provider health
    const providerHealth = await this.dualProviderService.getProviderHealth();
    
    if (!providerHealth.twilio) {
      issues.push('Twilio provider is not healthy');
    }

    if (!providerHealth.meta) {
      issues.push('Meta provider is not healthy');
    }

    // Check comparison results for patterns
    const recentComparisons = this.getComparisonResults(10);
    const failureRate = recentComparisons.length > 0 
      ? recentComparisons.filter(c => 
          (c.twilioResult && !c.twilioResult.success) || 
          (c.metaResult && !c.metaResult.success)
        ).length / recentComparisons.length 
      : 0;

    if (failureRate > 0.1) { // More than 10% failure rate
      issues.push(`High failure rate detected: ${(failureRate * 100).toFixed(1)}%`);
      recommendations.push('Run more comparison tests before proceeding');
    }

    // Check migration metrics
    if (this.migrationStatus.metrics.errorRate > 0.05) { // More than 5% error rate
      issues.push(`High error rate in migration metrics: ${(this.migrationStatus.metrics.errorRate * 100).toFixed(1)}%`);
    }

    // Recommendations based on current phase
    switch (this.migrationStatus.phase) {
      case 'preparation':
        recommendations.push('Run comprehensive comparison tests');
        recommendations.push('Validate all configurations');
        break;
      case 'testing':
        recommendations.push('Monitor error rates closely');
        recommendations.push('Test all business workflows');
        break;
      case 'partial':
        recommendations.push('Monitor production traffic');
        recommendations.push('Have rollback plan ready');
        break;
    }

    return {
      ready: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * Calculate comparison results between providers
   */
  private calculateComparison(comparison: ProviderComparison): void {
    const metaSuccess = comparison.metaResult?.success ?? false;
    const twilioSuccess = comparison.twilioResult?.success ?? false;

    comparison.comparison.bothSucceeded = metaSuccess && twilioSuccess;
    comparison.comparison.bothFailed = !metaSuccess && !twilioSuccess;
    comparison.comparison.onlyMetaSucceeded = metaSuccess && !twilioSuccess;
    comparison.comparison.onlyTwilioSucceeded = !metaSuccess && twilioSuccess;

    // Calculate response time difference
    if (comparison.metaResult && comparison.twilioResult) {
      comparison.comparison.responseTimeDifference = 
        comparison.twilioResult.responseTime - comparison.metaResult.responseTime;
    }
  }

  /**
   * Update migration metrics based on comparison results
   */
  private updateMigrationMetrics(comparison: ProviderComparison): void {
    const metrics = this.migrationStatus.metrics;
    
    metrics.totalMessages++;
    
    if (comparison.metaResult) {
      metrics.metaMessages++;
      if (comparison.metaResult.success) {
        metrics.successfulMessages++;
      } else {
        metrics.failedMessages++;
      }
    }
    
    if (comparison.twilioResult) {
      metrics.twilioMessages++;
      if (comparison.twilioResult.success) {
        metrics.successfulMessages++;
      } else {
        metrics.failedMessages++;
      }
    }

    // Calculate error rate
    metrics.errorRate = metrics.totalMessages > 0 
      ? metrics.failedMessages / metrics.totalMessages 
      : 0;

    // Calculate average response time
    const responseTimes = this.comparisonResults
      .flatMap(c => [c.metaResult?.responseTime, c.twilioResult?.responseTime])
      .filter(Boolean) as number[];
    
    metrics.averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    metrics.lastCalculated = new Date();
  }

  /**
   * Check if a provider should be tested based on current configuration
   */
  private shouldTestProvider(provider: WhatsAppProvider): boolean {
    const config = this.dualProviderService.getProviderConfiguration();
    
    if (provider === 'meta') {
      return config.meta.configured && config.dualProvider.featureFlags.enableMetaFallback;
    }
    
    if (provider === 'twilio') {
      return config.twilio.configured && config.dualProvider.featureFlags.enableTwilioSending;
    }
    
    return false;
  }

  /**
   * Generate rollback steps based on current state
   */
  private generateRollbackSteps(targetPhase?: MigrationStatus['phase']): RollbackStep[] {
    const steps: RollbackStep[] = [];

    // Always start with configuration backup
    steps.push({
      id: 'backup_config',
      description: 'Backup current configuration',
      action: 'config_change',
      parameters: { backup: true },
      status: 'pending',
    });

    // Switch primary provider back to Meta
    steps.push({
      id: 'switch_to_meta',
      description: 'Switch primary provider to Meta',
      action: 'config_change',
      parameters: { 
        WHATSAPP_PRIMARY_PROVIDER: 'meta',
        WHATSAPP_ENABLE_TWILIO_SENDING: false,
        WHATSAPP_ENABLE_TWILIO_WEBHOOKS: false,
      },
      status: 'pending',
    });

    // Disable Twilio features
    steps.push({
      id: 'disable_twilio',
      description: 'Disable Twilio features',
      action: 'config_change',
      parameters: {
        WHATSAPP_ENABLE_TWILIO_SENDING: false,
        WHATSAPP_ENABLE_TWILIO_WEBHOOKS: false,
        WHATSAPP_ENABLE_META_FALLBACK: true,
      },
      status: 'pending',
    });

    // Restart services
    steps.push({
      id: 'restart_services',
      description: 'Restart WhatsApp services',
      action: 'service_restart',
      parameters: { services: ['whatsapp', 'dual-provider'] },
      status: 'pending',
    });

    // Validate rollback
    steps.push({
      id: 'validate_rollback',
      description: 'Validate rollback success',
      action: 'validation',
      parameters: { 
        checkProviderHealth: true,
        sendTestMessage: true,
      },
      status: 'pending',
    });

    return steps;
  }

  /**
   * Execute a single rollback step
   */
  private async executeRollbackStep(step: RollbackStep): Promise<void> {
    this.logger.debug(`Executing rollback step: ${step.id} - ${step.description}`);
    
    step.status = 'executing';

    try {
      switch (step.action) {
        case 'config_change':
          await this.executeConfigChange(step.parameters);
          break;
        case 'service_restart':
          await this.executeServiceRestart(step.parameters);
          break;
        case 'database_update':
          await this.executeDatabaseUpdate(step.parameters);
          break;
        case 'validation':
          await this.executeValidation(step.parameters);
          break;
        default:
          throw new Error(`Unknown rollback action: ${step.action}`);
      }

      step.status = 'completed';
      this.logger.debug(`Rollback step completed: ${step.id}`);
      
    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      this.logger.error(`Rollback step failed: ${step.id} - ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute configuration changes
   */
  private async executeConfigChange(parameters: Record<string, any>): Promise<void> {
    // In a real implementation, this would update environment variables
    // or configuration files. For now, we'll just log the changes.
    this.logger.log(`Configuration changes would be applied: ${JSON.stringify(parameters)}`);
    
    // Simulate configuration update delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Execute service restart
   */
  private async executeServiceRestart(parameters: Record<string, any>): Promise<void> {
    const services = parameters.services || [];
    this.logger.log(`Services would be restarted: ${services.join(', ')}`);
    
    // Simulate service restart delay
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * Execute database updates
   */
  private async executeDatabaseUpdate(parameters: Record<string, any>): Promise<void> {
    this.logger.log(`Database updates would be applied: ${JSON.stringify(parameters)}`);
    
    // Simulate database update delay
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  /**
   * Execute validation checks
   */
  private async executeValidation(parameters: Record<string, any>): Promise<void> {
    if (parameters.checkProviderHealth) {
      const health = await this.dualProviderService.getProviderHealth();
      if (!health.meta) {
        throw new Error('Meta provider health check failed after rollback');
      }
    }

    if (parameters.sendTestMessage) {
      // In a real implementation, this would send a test message
      this.logger.log('Test message would be sent to validate rollback');
    }

    this.logger.log('Validation checks completed successfully');
  }
}