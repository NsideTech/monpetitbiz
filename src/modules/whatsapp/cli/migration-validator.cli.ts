#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../../../app.module';
import { MigrationValidationService } from '../services/migration-validation.service';
import { DualProviderService } from '../services/dual-provider.service';

interface CliOptions {
  command: string;
  phone?: string;
  message?: string;
  count?: number;
  phase?: string;
  reason?: string;
  planId?: string;
  verbose?: boolean;
}

class MigrationValidatorCli {
  private readonly logger = new Logger(MigrationValidatorCli.name);
  private migrationService: MigrationValidationService;
  private dualProviderService: DualProviderService;

  async initialize(): Promise<void> {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    this.migrationService = app.get(MigrationValidationService);
    this.dualProviderService = app.get(DualProviderService);

    this.logger.log('Migration Validator CLI initialized');
  }

  async run(options: CliOptions): Promise<void> {
    try {
      await this.initialize();

      switch (options.command) {
        case 'status':
          await this.showStatus(options);
          break;
        case 'compare':
          await this.compareProviders(options);
          break;
        case 'test-batch':
          await this.runBatchTest(options);
          break;
        case 'validate':
          await this.validateReadiness(options);
          break;
        case 'set-phase':
          await this.setPhase(options);
          break;
        case 'rollback':
          await this.executeRollback(options);
          break;
        case 'health':
          await this.checkHealth(options);
          break;
        default:
          this.showHelp();
      }
    } catch (error) {
      this.logger.error(`CLI execution failed: ${error.message}`);
      process.exit(1);
    }
  }

  private async showStatus(options: CliOptions): Promise<void> {
    console.log('\n=== Migration Status ===');
    
    const status = this.migrationService.getMigrationStatus();
    
    console.log(`Phase: ${status.phase}`);
    console.log(`Started: ${status.startedAt.toISOString()}`);
    console.log(`Last Updated: ${status.lastUpdated.toISOString()}`);
    console.log(`Completed Tasks: ${status.completedTasks.length}`);
    console.log(`Failed Tasks: ${status.failedTasks.length}`);
    
    console.log('\n=== Metrics ===');
    console.log(`Total Messages: ${status.metrics.totalMessages}`);
    console.log(`Successful: ${status.metrics.successfulMessages}`);
    console.log(`Failed: ${status.metrics.failedMessages}`);
    console.log(`Error Rate: ${(status.metrics.errorRate * 100).toFixed(2)}%`);
    console.log(`Avg Response Time: ${status.metrics.averageResponseTime.toFixed(0)}ms`);
    
    if (options.verbose) {
      console.log('\n=== Completed Tasks ===');
      status.completedTasks.forEach(task => console.log(`✓ ${task}`));
      
      if (status.failedTasks.length > 0) {
        console.log('\n=== Failed Tasks ===');
        status.failedTasks.forEach(task => console.log(`✗ ${task}`));
      }
    }
  }

  private async compareProviders(options: CliOptions): Promise<void> {
    if (!options.phone || !options.message) {
      console.error('Error: --phone and --message are required for compare command');
      return;
    }

    console.log(`\n=== Comparing Providers ===`);
    console.log(`Phone: ${options.phone}`);
    console.log(`Message: ${options.message}`);
    
    const comparison = await this.migrationService.compareProviderResponses(
      options.phone,
      options.message,
      true
    );

    console.log('\n=== Results ===');
    
    if (comparison.metaResult) {
      console.log(`Meta: ${comparison.metaResult.success ? '✓' : '✗'} (${comparison.metaResult.responseTime}ms)`);
      if (!comparison.metaResult.success) {
        console.log(`  Error: ${comparison.metaResult.error}`);
      }
    }
    
    if (comparison.twilioResult) {
      console.log(`Twilio: ${comparison.twilioResult.success ? '✓' : '✗'} (${comparison.twilioResult.responseTime}ms)`);
      if (!comparison.twilioResult.success) {
        console.log(`  Error: ${comparison.twilioResult.error}`);
      }
    }

    console.log('\n=== Comparison ===');
    console.log(`Both Succeeded: ${comparison.comparison.bothSucceeded}`);
    console.log(`Both Failed: ${comparison.comparison.bothFailed}`);
    console.log(`Only Meta Succeeded: ${comparison.comparison.onlyMetaSucceeded}`);
    console.log(`Only Twilio Succeeded: ${comparison.comparison.onlyTwilioSucceeded}`);
    
    if (comparison.comparison.responseTimeDifference !== 0) {
      const faster = comparison.comparison.responseTimeDifference < 0 ? 'Twilio' : 'Meta';
      const diff = Math.abs(comparison.comparison.responseTimeDifference);
      console.log(`${faster} was ${diff}ms faster`);
    }
  }

  private async runBatchTest(options: CliOptions): Promise<void> {
    if (!options.phone) {
      console.error('Error: --phone is required for batch test');
      return;
    }

    const count = options.count || 5;
    const baseMessage = options.message || 'Migration test message';

    console.log(`\n=== Running Batch Test ===`);
    console.log(`Phone: ${options.phone}`);
    console.log(`Count: ${count}`);
    
    const results = [];
    
    for (let i = 1; i <= count; i++) {
      const message = `${baseMessage} #${i}`;
      console.log(`\nTest ${i}/${count}: ${message}`);
      
      try {
        const comparison = await this.migrationService.compareProviderResponses(
          options.phone,
          message,
          true
        );
        
        results.push(comparison);
        
        const metaStatus = comparison.metaResult?.success ? '✓' : '✗';
        const twilioStatus = comparison.twilioResult?.success ? '✓' : '✗';
        
        console.log(`  Meta: ${metaStatus}, Twilio: ${twilioStatus}`);
        
        // Wait between tests to avoid rate limiting
        if (i < count) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.log(`  Error: ${error.message}`);
      }
    }

    // Summary
    console.log('\n=== Batch Test Summary ===');
    const metaSuccesses = results.filter(r => r.metaResult?.success).length;
    const twilioSuccesses = results.filter(r => r.twilioResult?.success).length;
    const bothSuccesses = results.filter(r => r.comparison.bothSucceeded).length;
    
    console.log(`Meta Success Rate: ${metaSuccesses}/${count} (${(metaSuccesses/count*100).toFixed(1)}%)`);
    console.log(`Twilio Success Rate: ${twilioSuccesses}/${count} (${(twilioSuccesses/count*100).toFixed(1)}%)`);
    console.log(`Both Succeeded: ${bothSuccesses}/${count} (${(bothSuccesses/count*100).toFixed(1)}%)`);
    
    const avgMetaTime = results
      .filter(r => r.metaResult)
      .reduce((sum, r) => sum + r.metaResult!.responseTime, 0) / results.length;
    const avgTwilioTime = results
      .filter(r => r.twilioResult)
      .reduce((sum, r) => sum + r.twilioResult!.responseTime, 0) / results.length;
    
    console.log(`Avg Meta Response Time: ${avgMetaTime.toFixed(0)}ms`);
    console.log(`Avg Twilio Response Time: ${avgTwilioTime.toFixed(0)}ms`);
  }

  private async validateReadiness(options: CliOptions): Promise<void> {
    console.log('\n=== Validating Migration Readiness ===');
    
    const validation = await this.migrationService.validateMigrationReadiness();
    
    console.log(`Ready: ${validation.ready ? '✓' : '✗'}`);
    
    if (validation.issues.length > 0) {
      console.log('\n=== Issues ===');
      validation.issues.forEach(issue => console.log(`✗ ${issue}`));
    }
    
    if (validation.recommendations.length > 0) {
      console.log('\n=== Recommendations ===');
      validation.recommendations.forEach(rec => console.log(`• ${rec}`));
    }
    
    // Provider health
    const providerHealth = await this.dualProviderService.getProviderHealth();
    console.log('\n=== Provider Health ===');
    console.log(`Meta: ${providerHealth.meta ? '✓' : '✗'}`);
    console.log(`Twilio: ${providerHealth.twilio ? '✓' : '✗'}`);
    
    // Provider configuration
    const providerConfig = this.dualProviderService.getProviderConfiguration();
    console.log('\n=== Provider Configuration ===');
    console.log(`Meta Configured: ${providerConfig.meta.configured ? '✓' : '✗'}`);
    console.log(`Twilio Configured: ${providerConfig.twilio.configured ? '✓' : '✗'}`);
    console.log(`Primary Provider: ${providerConfig.dualProvider.primaryProvider}`);
    console.log(`Twilio Sending: ${providerConfig.dualProvider.featureFlags.enableTwilioSending ? '✓' : '✗'}`);
    console.log(`Twilio Webhooks: ${providerConfig.dualProvider.featureFlags.enableTwilioWebhooks ? '✓' : '✗'}`);
  }

  private async setPhase(options: CliOptions): Promise<void> {
    if (!options.phase) {
      console.error('Error: --phase is required');
      return;
    }

    const validPhases = ['preparation', 'testing', 'partial', 'complete', 'rollback'];
    if (!validPhases.includes(options.phase)) {
      console.error(`Error: Invalid phase. Valid phases: ${validPhases.join(', ')}`);
      return;
    }

    console.log(`\n=== Setting Migration Phase ===`);
    console.log(`New Phase: ${options.phase}`);
    console.log(`Reason: ${options.reason || 'CLI command'}`);
    
    await this.migrationService.updateMigrationPhase(
      options.phase as any,
      options.reason || 'CLI command'
    );
    
    console.log('✓ Phase updated successfully');
  }

  private async executeRollback(options: CliOptions): Promise<void> {
    if (!options.planId) {
      console.error('Error: --plan-id is required for rollback');
      return;
    }

    console.log(`\n=== Executing Rollback ===`);
    console.log(`Plan ID: ${options.planId}`);
    
    try {
      await this.migrationService.executeRollback(options.planId);
      console.log('✓ Rollback executed successfully');
    } catch (error) {
      console.error(`✗ Rollback failed: ${error.message}`);
    }
  }

  private async checkHealth(options: CliOptions): Promise<void> {
    console.log('\n=== Health Check ===');
    
    try {
      const providerHealth = await this.dualProviderService.getProviderHealth();
      const migrationStatus = this.migrationService.getMigrationStatus();
      
      console.log(`Migration Service: ✓`);
      console.log(`Migration Phase: ${migrationStatus.phase}`);
      console.log(`Meta Provider: ${providerHealth.meta ? '✓' : '✗'}`);
      console.log(`Twilio Provider: ${providerHealth.twilio ? '✓' : '✗'}`);
      
      const overallHealth = providerHealth.meta && providerHealth.twilio;
      console.log(`Overall Health: ${overallHealth ? '✓' : '✗'}`);
      
    } catch (error) {
      console.error(`✗ Health check failed: ${error.message}`);
    }
  }

  private showHelp(): void {
    console.log(`
Migration Validator CLI

Usage: npm run migration:validate -- <command> [options]

Commands:
  status                    Show current migration status
  compare                   Compare providers for a single message
  test-batch               Run batch comparison test
  validate                 Validate migration readiness
  set-phase                Set migration phase
  rollback                 Execute rollback plan
  health                   Check service health

Options:
  --phone <number>         Phone number for testing (required for compare/test-batch)
  --message <text>         Message text (default: "Migration test message")
  --count <number>         Number of tests for batch (default: 5)
  --phase <phase>          Migration phase (preparation|testing|partial|complete|rollback)
  --reason <text>          Reason for phase change
  --plan-id <id>           Rollback plan ID
  --verbose                Show detailed output

Examples:
  npm run migration:validate -- status --verbose
  npm run migration:validate -- compare --phone "+1234567890" --message "Test message"
  npm run migration:validate -- test-batch --phone "+1234567890" --count 10
  npm run migration:validate -- validate
  npm run migration:validate -- set-phase --phase testing --reason "Starting test phase"
  npm run migration:validate -- health
`);
  }
}

// Parse command line arguments
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    command: args[0] || 'help',
  };

  for (let i = 1; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '');
    const value = args[i + 1];

    switch (key) {
      case 'phone':
        options.phone = value;
        break;
      case 'message':
        options.message = value;
        break;
      case 'count':
        options.count = parseInt(value, 10);
        break;
      case 'phase':
        options.phase = value;
        break;
      case 'reason':
        options.reason = value;
        break;
      case 'plan-id':
        options.planId = value;
        break;
      case 'verbose':
        options.verbose = true;
        i--; // No value for this flag
        break;
    }
  }

  return options;
}

// Main execution
if (require.main === module) {
  const cli = new MigrationValidatorCli();
  const options = parseArgs();
  
  cli.run(options).catch(error => {
    console.error('CLI execution failed:', error);
    process.exit(1);
  });
}

export { MigrationValidatorCli };