// Entities
export { User, UserRole } from './entities/user.entity';
export { Business } from './entities/business.entity';
export { OtpSession } from './entities/otp-session.entity';

// Services
export { AuthService } from './auth.service';
export { PhoneValidationService } from './services/phone-validation.service';
export type { PhoneValidationResult, PhoneNumberStatus } from './services/phone-validation.service';

// Guards
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { PermissionGuard, RequirePermission } from './guards/permission.guard';

// Decorators
export { CurrentUser } from './decorators/current-user.decorator';
export { Permissions, PERMISSIONS } from './decorators/permissions.decorator';

// Middleware
export { WhatsAppAuthMiddleware } from './middleware/whatsapp-auth.middleware';

// Module
export { AuthModule } from './auth.module';