import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard that validates service/admin tokens for admin endpoints
 * This allows the admin portal to access any business data using a shared service token
 */
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Service token is required');
    }

    const serviceToken = this.configService.get<string>('SERVICE_TOKEN');

    if (!serviceToken) {
      throw new UnauthorizedException('Service token is not configured on the server');
    }

    if (token !== serviceToken) {
      throw new UnauthorizedException('Invalid service token');
    }

    // Set a flag to indicate this is a service token request
    // This allows controllers to bypass business ownership checks
    request.isServiceToken = true;

    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

