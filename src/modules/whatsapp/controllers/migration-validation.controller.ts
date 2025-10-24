import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Body, 
  Param, 
  Query, 
  HttpStatus, 
  HttpException,
  Logger 
} from '@nestjs/common';
import { MigrationValidationService, MigrationStatus, ProviderComparison, RollbackPlan } from '../services/migration-validation.service';

export interface CompareProvidersDto {
  to: string;
  message: string;
  testBoth?: boolean;
}

export interface UpdateMigrationPhaseDto {
  phase: MigrationStatus['phase'];
  reason?: string;
}

export interface CreateRollbackPlanDto {
  reason: string;
  targetPhase?: MigrationStatus['phase'];
}

export interface MigrationValidationResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

@Controller('api/migration')
export class MigrationValidationController {
  private readonly logger = new Logger(MigrationValidationController.name);

  constructor(
    private readonly migrationValidationService: MigrationValidationService,
  ) {}

  /**
   * Get current migration status
   */
  @Get('status')
  async getMigrationStatus(): Promise<MigrationValidationResponse<MigrationStatus>> {
    try {
      const status = this.migrationValidationService.getMigrationStatus();
      
      return {
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get migration status:', error);
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Update migration phase
   */
  @Put('status/phase')
  async updateMigrationPhase(
    @Body() updateDto: UpdateMigrationPhaseDto
  ): Promise<MigrationValidationResponse> {
    try {
      await this.migrationValidationService.updateMigrationPhase(
        updateDto.phase,
        updateDto.reason
      );

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to update migration phase:', error);
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Mark a migration task as completed
   */
  @Post('tasks/:taskId/complete')
  async markTaskCompleted(
    @Param('taskId') taskId: string
  ): Promise<MigrationValidationResponse> {
    try {
      this.migrationValidationService.markTaskCompleted(taskId);

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to mark task ${taskId} as completed:`, error);
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Mark a migration task as failed
   */
  @Post('tasks/:taskId/fail')
  async markTaskFailed(
    @Param('taskId') taskId: string,
    @Body() body: { error?: string }
  ): Promise<MigrationValidationResponse> {
    try {
      this.migrationValidationService.markTaskFailed(taskId, body.error);

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to mark task ${taskId} as failed:`, error);
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Compare provider responses for a test message
   */
  @Post('compare')
  async compareProviders(
    @Body() compareDto: CompareProvidersDto
  ): Promise<MigrationValidationResponse<ProviderComparison>> {
    try {
      const comparison = await this.migrationValidationService.compareProviderResponses(
        compareDto.to,
        compareDto.message,
        compareDto.testBoth
      );

      return {
        success: true,
        data: comparison,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to compare providers:', error);
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get comparison results with optional filtering
   */
  @Get('comparisons')
  async getComparisonResults(
    @Query('limit') limit?: string,
    @Query('onlyFailures') onlyFailures?: string
  ): Promise<MigrationValidationResponse<ProviderComparison[]>> {
    try {
      const limitNum = limit ? parseInt(limit, 10) : undefined;
      const onlyFailuresBool = onlyFailures === 'true';

      const results = this.migrationValidationService.getComparisonResults(
        limitNum,
        onlyFailuresBool
      );

      return {
        success: true,
        data: results,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get comparison results:', error);
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Validate migration readiness
   */
  @Get('validate')
  async validateMigrationReadiness(): Promise<MigrationValidationResponse<{
    ready: boolean;
    issues: string[];
    recommendations: string[];
  }>> {
    try {
      const validation = await this.migrationValidationService.validateMigrationReadiness();

      return {
        success: true,
        data: validation,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to validate migration readiness:', error);
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Create a rollback plan
   */
  @Post('rollback/plan')
  async createRollbackPlan(
    @Body() createDto: CreateRollbackPlanDto
  ): Promise<MigrationValidationResponse<RollbackPlan>> {
    try {
      const plan = await this.migrationValidationService.createRollbackPlan(
        createDto.reason,
        createDto.targetPhase
      );

      return {
        success: true,
        data: plan,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to create rollback plan:', error);
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get all rollback plans
   */
  @Get('rollback/plans')
  async getRollbackPlans(): Promise<MigrationValidationResponse<RollbackPlan[]>> {
    try {
      const plans = this.migrationValidationService.getRollbackPlans();

      return {
        success: true,
        data: plans,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get rollback plans:', error);
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Execute a rollback plan
   */
  @Post('rollback/execute/:planId')
  async executeRollback(
    @Param('planId') planId: string
  ): Promise<MigrationValidationResponse> {
    try {
      await this.migrationValidationService.executeRollback(planId);

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to execute rollback plan ${planId}:`, error);
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get migration metrics and statistics
   */
  @Get('metrics')
  async getMigrationMetrics(): Promise<MigrationValidationResponse<{
    status: MigrationStatus;
    recentComparisons: ProviderComparison[];
    rollbackPlans: RollbackPlan[];
    readiness: {
      ready: boolean;
      issues: string[];
      recommendations: string[];
    };
  }>> {
    try {
      const [status, recentComparisons, rollbackPlans, readiness] = await Promise.all([
        Promise.resolve(this.migrationValidationService.getMigrationStatus()),
        Promise.resolve(this.migrationValidationService.getComparisonResults(5)),
        Promise.resolve(this.migrationValidationService.getRollbackPlans()),
        this.migrationValidationService.validateMigrationReadiness(),
      ]);

      return {
        success: true,
        data: {
          status,
          recentComparisons,
          rollbackPlans,
          readiness,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get migration metrics:', error);
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Health check endpoint for migration validation service
   */
  @Get('health')
  async getHealth(): Promise<MigrationValidationResponse<{
    service: string;
    status: string;
    timestamp: string;
    migrationPhase: string;
  }>> {
    try {
      const migrationStatus = this.migrationValidationService.getMigrationStatus();

      return {
        success: true,
        data: {
          service: 'migration-validation',
          status: 'healthy',
          timestamp: new Date().toISOString(),
          migrationPhase: migrationStatus.phase,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Migration validation health check failed:', error);
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}