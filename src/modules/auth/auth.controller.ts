import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Request,
  UsePipes,
  ValidationPipe
} from '@nestjs/common';
import {
  IsString,
  IsPhoneNumber,
  IsEnum,
  IsOptional,
  Length,
  IsNotEmpty
} from 'class-validator';

import { AuthService, SendOtpDto, VerifyOtpDto, RegisterUserDto, AuthResult } from './auth.service';
import { UserRole } from './entities/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// DTOs for request validation
export class SendOtpRequestDto implements SendOtpDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}

export class VerifyOtpRequestDto implements VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @Length(6, 6)
  code: string;
}

export class RegisterUserRequestDto implements RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  businessName: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsString()
  language?: string;
}

@Controller('auth')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  /**
   * Send OTP to phone number
   */
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() sendOtpDto: SendOtpRequestDto) {
    const result = await this.authService.sendOTP(sendOtpDto.phoneNumber);

    return {
      success: true,
      message: result,
    };
  }

  /**
   * Verify OTP and authenticate user
   */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpRequestDto): Promise<{
    success: boolean;
    data?: AuthResult;
    needsRegistration?: boolean;
    phoneNumber?: string;
    message?: string;
  }> {
    const result = await this.authService.verifyOTP(
      verifyOtpDto.phoneNumber,
      verifyOtpDto.code
    );

    // Check if result indicates need for registration
    if ('needsRegistration' in result) {
      return {
        success: true,
        needsRegistration: true,
        phoneNumber: result.phoneNumber,
        message: 'Phone number verified. Please complete registration.',
      };
    }

    // User exists and is authenticated
    return {
      success: true,
      data: result as AuthResult,
      message: 'Authentication successful.',
    };
  }

  /**
   * Register new user with business
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterUserRequestDto) {
    const result = await this.authService.registerUser(registerDto);

    return {
      success: true,
      data: {
        user: {
          id: result.user.id,
          phoneNumber: result.user.phoneNumber,
          role: result.user.role,
          language: result.user.language,
          businessId: result.user.businessId,
          business: result.user.business,
        },
        accessToken: result.accessToken,
      },
      message: 'User registered and authenticated successfully.',
    };
  }

  /**
   * Get current user profile (protected route)
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    const user = req.user;

    return {
      success: true,
      data: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        language: user.language,
        businessId: user.businessId,
        business: user.business,
        isActive: user.isActive,
      },
    };
  }

  /**
   * Complete registration after OTP verification
   */
  @Post('complete-registration')
  @HttpCode(HttpStatus.CREATED)
  async completeRegistration(@Body() body: {
    phoneNumber: string;
    businessName: string;
    role: UserRole;
    language?: string;
  }) {
    // This endpoint is called after OTP verification indicates needsRegistration: true
    const result = await this.authService.registerUser({
      phoneNumber: body.phoneNumber,
      businessName: body.businessName,
      role: body.role,
      language: body.language,
    });

    return {
      success: true,
      data: {
        user: {
          id: result.user.id,
          phoneNumber: result.user.phoneNumber,
          role: result.user.role,
          language: result.user.language,
          businessId: result.user.businessId,
          business: result.user.business,
        },
        accessToken: result.accessToken,
      },
      message: 'Registration completed and user authenticated successfully.',
    };
  }

  /**
   * Check user permissions for specific action
   */
  @Post('check-permission')
  @UseGuards(JwtAuthGuard)
  async checkPermission(
    @Request() req,
    @Body() body: { action: string }
  ) {
    const hasPermission = await this.authService.hasPermission(
      req.user.id,
      body.action
    );

    return {
      success: true,
      data: {
        hasPermission,
        action: body.action,
      },
    };
  }

  /**
   * Debug endpoint to check OTP sessions (development only)
   */
  @Get('debug/otp-sessions')
  async debugOtpSessions() {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Debug endpoint not available in production' };
    }

    const sessions = await this.authService.getAllOtpSessions();
    return {
      success: true,
      data: sessions,
      count: sessions.length,
    };
  }

  /**
   * Debug endpoint to check all users (development only)
   */
  @Get('debug/users')
  async debugUsers() {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Debug endpoint not available in production' };
    }

    const users = await this.authService.getAllUsers();
    return {
      success: true,
      data: users,
      count: users.length,
    };
  }
}