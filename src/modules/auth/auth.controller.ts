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
  ValidationPipe,
  Param,
  Delete
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
import { EmployeeService } from './services/employee.service';
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

export class RegisterBusinessOwnerRequestDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  businessName: string;

  @IsOptional()
  @IsString()
  language?: string;
}

export class RegisterEmployeeRequestDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  businessCode: string;

  @IsString()
  @IsNotEmpty()
  employeeName: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['seller', 'manager'])
  role: 'seller' | 'manager';

  @IsOptional()
  @IsString()
  language?: string;
}

export class AddOwnerRequestDto {
  @IsString()
  @IsNotEmpty()
  ownerPhoneNumber: string;

  @IsString()
  @IsNotEmpty()
  newOwnerPhoneNumber: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  newOwnerName: string;

  @IsOptional()
  @IsString()
  language?: string;
}

@Controller('auth')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly employeeService: EmployeeService,
  ) { }

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
   * Register new business owner with generated business code
   */
  @Post('register-business-owner')
  @HttpCode(HttpStatus.CREATED)
  async registerBusinessOwner(@Body() registerDto: RegisterBusinessOwnerRequestDto) {
    try {
      const result = await this.authService.registerBusinessOwner({
        phoneNumber: registerDto.phoneNumber,
        businessName: registerDto.businessName,
        role: UserRole.OWNER,
        language: registerDto.language,
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
            business: {
              id: result.user.business.id,
              name: result.user.business.name,
              businessCode: result.user.business.businessCode,
            },
          },
          accessToken: result.accessToken,
          businessCode: result.user.business.businessCode,
        },
        message: `Entreprise créée avec succès! Code d'invitation: ${result.user.business.businessCode}. Partagez ce code avec vos employés.`,
      };
    } catch (error) {
      if (error.status === 409) {
        return {
          success: false,
          error: 'PHONE_EXISTS',
          message: 'Un utilisateur avec ce numéro de téléphone existe déjà.',
        };
      }
      
      return {
        success: false,
        error: 'REGISTRATION_FAILED',
        message: 'Erreur lors de la création de l\'entreprise. Veuillez réessayer.',
      };
    }
  }

  /**
   * Register new employee with business code validation
   */
  @Post('register-employee')
  @HttpCode(HttpStatus.CREATED)
  async registerEmployee(@Body() registerDto: RegisterEmployeeRequestDto) {
    try {
      const result = await this.authService.registerEmployee(
        registerDto.phoneNumber,
        registerDto.businessCode,
        registerDto.employeeName,
        registerDto.role,
        registerDto.language
      );

      // Get role display name in French
      const roleDisplayName = registerDto.role === 'manager' ? 'Manager' : 'Vendeur';
      
      // Get permissions based on role
      const permissions = registerDto.role === 'manager' 
        ? ['Enregistrer ventes', 'Enregistrer dépenses', 'Gérer stock', 'Voir rapports']
        : ['Enregistrer ventes', 'Gérer stock'];

      return {
        success: true,
        data: {
          user: {
            id: result.user.id,
            phoneNumber: result.user.phoneNumber,
            employeeName: result.user.employeeName,
            role: result.user.role,
            language: result.user.language,
            businessId: result.user.businessId,
            business: {
              id: result.user.business.id,
              name: result.user.business.name,
            },
          },
          accessToken: result.accessToken,
          permissions,
        },
        message: `✅ Inscription réussie! Bienvenue ${registerDto.employeeName} chez ${result.user.business.name}. Rôle: ${roleDisplayName}`,
      };
    } catch (error) {
      if (error.status === 409) {
        return {
          success: false,
          error: 'PHONE_EXISTS',
          message: 'Un utilisateur avec ce numéro de téléphone existe déjà.',
        };
      }
      
      if (error.status === 400 && error.message.includes('Invalid business code')) {
        return {
          success: false,
          error: 'INVALID_BUSINESS_CODE',
          message: 'Code d\'entreprise invalide. Vérifiez avec votre patron.',
        };
      }
      
      return {
        success: false,
        error: 'REGISTRATION_FAILED',
        message: 'Erreur lors de l\'inscription. Veuillez réessayer.',
      };
    }
  }

  /**
   * Add another owner (administrator) to an existing business
   * Only existing owners can add other owners
   */
  @Post('add-owner')
  @HttpCode(HttpStatus.CREATED)
  async addOwner(@Body() addOwnerDto: AddOwnerRequestDto) {
    try {
      const result = await this.authService.addOwnerToBusiness(
        addOwnerDto.ownerPhoneNumber,
        addOwnerDto.newOwnerPhoneNumber,
        addOwnerDto.newOwnerName,
        addOwnerDto.language
      );

      return {
        success: true,
        data: {
          user: {
            id: result.user.id,
            phoneNumber: result.user.phoneNumber,
            employeeName: result.user.employeeName,
            role: result.user.role,
            language: result.user.language,
            businessId: result.user.businessId,
            business: {
              id: result.user.business.id,
              name: result.user.business.name,
              businessCode: result.user.business.businessCode,
            },
          },
          accessToken: result.accessToken,
        },
        message: `✅ Administrateur ajouté avec succès! ${addOwnerDto.newOwnerName} est maintenant propriétaire de ${result.user.business.name}.`,
      };
    } catch (error) {
      if (error.status === 403) {
        return {
          success: false,
          error: 'FORBIDDEN',
          message: error.message || 'Seuls les propriétaires peuvent ajouter d\'autres propriétaires.',
        };
      }
      
      if (error.status === 409) {
        return {
          success: false,
          error: 'PHONE_EXISTS',
          message: error.message || 'Un utilisateur avec ce numéro de téléphone existe déjà.',
        };
      }
      
      return {
        success: false,
        error: 'ADD_OWNER_FAILED',
        message: error.message || 'Erreur lors de l\'ajout de l\'administrateur. Veuillez réessayer.',
      };
    }
  }

  /**
   * Get business information by business code for employee verification
   */
  @Get('business/:code')
  @HttpCode(HttpStatus.OK)
  async getBusinessByCode(@Param('code') code: string) {
    try {
      // Validate code format (6 characters alphanumeric)
      if (!code || code.length !== 6 || !/^[A-Z0-9]+$/i.test(code)) {
        return {
          success: false,
          error: 'INVALID_CODE_FORMAT',
          message: 'Format de code invalide. Le code doit contenir 6 caractères alphanumériques (ex: ABC123).',
        };
      }

      const result = await this.authService.getBusinessByCode(code);

      if (!result) {
        return {
          success: false,
          error: 'BUSINESS_NOT_FOUND',
          message: 'Code d\'entreprise introuvable. Vérifiez le code avec votre patron.',
        };
      }

      return {
        success: true,
        data: {
          business: {
            id: result.business.id,
            name: result.business.name,
            businessCode: result.business.businessCode,
          },
          employeeCount: result.employeeCount,
        },
        message: `Entreprise trouvée: ${result.business.name} (${result.employeeCount} employé${result.employeeCount > 1 ? 's' : ''})`,
      };
    } catch (error) {
      return {
        success: false,
        error: 'LOOKUP_FAILED',
        message: 'Erreur lors de la recherche de l\'entreprise. Veuillez réessayer.',
      };
    }
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

  /**
   * Generate employee code (Owner only)
   */
  @Post('generate-employee-code')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async generateEmployeeCode(@Request() req) {
    const result = await this.employeeService.generateEmployeeCode({
      businessId: req.user.businessId,
      createdBy: req.user.id,
    });

    return {
      success: true,
      data: result,
      message: `Code employé généré: ${result.code}. Partagez ce code avec votre employé. Le code expire dans 24h.`,
    };
  }

  /**
   * Use employee code to join business
   */
  @Post('use-employee-code')
  @HttpCode(HttpStatus.OK)
  async useEmployeeCode(@Body() body: { code: string; phoneNumber: string }) {
    const result = await this.employeeService.useEmployeeCode({
      code: body.code.toUpperCase(),
      phoneNumber: body.phoneNumber,
    });

    return {
      success: true,
      data: {
        businessName: result.business.name,
        businessId: result.business.id,
      },
      message: `Code valide! Vous allez rejoindre: ${result.business.name}`,
    };
  }

  /**
   * Complete employee registration after code validation
   */
  @Post('complete-employee-registration')
  @HttpCode(HttpStatus.CREATED)
  async completeEmployeeRegistration(@Body() body: {
    phoneNumber: string;
    businessId: string;
    invitedBy: string;
  }) {
    const employee = await this.employeeService.createEmployeeAccount(
      body.phoneNumber,
      body.businessId,
      body.invitedBy
    );

    // Generate JWT token for immediate authentication
    const accessToken = await this.authService.generateJwtToken(employee);

    return {
      success: true,
      data: {
        user: {
          id: employee.id,
          phoneNumber: employee.phoneNumber,
          role: employee.role,
          businessId: employee.businessId,
        },
        accessToken,
      },
      message: 'Compte employé créé avec succès!',
    };
  }

  /**
   * Get employee codes (Owner only)
   */
  @Get('employee-codes')
  @UseGuards(JwtAuthGuard)
  async getEmployeeCodes(@Request() req) {
    const codes = await this.employeeService.getEmployeeCodes(
      req.user.businessId,
      req.user.id
    );

    return {
      success: true,
      data: codes,
      count: codes.length,
    };
  }

  /**
   * Get employees (Owner only)
   */
  @Get('employees')
  @UseGuards(JwtAuthGuard)
  async getEmployees(@Request() req) {
    const employees = await this.employeeService.getEmployees(
      req.user.businessId,
      req.user.id
    );

    return {
      success: true,
      data: employees.map(emp => ({
        id: emp.id,
        phoneNumber: emp.phoneNumber,
        role: emp.role,
        language: emp.language,
        isActive: emp.isActive,
        joinedAt: emp.joinedAt,
      })),
      count: employees.length,
    };
  }

  /**
   * Remove employee (Owner only)
   */
  @Delete('employees/:phoneNumber')
  @UseGuards(JwtAuthGuard)
  async removeEmployee(@Request() req, @Param('phoneNumber') phoneNumber: string) {
    await this.employeeService.removeEmployee(
      req.user.businessId,
      req.user.id,
      phoneNumber
    );

    return {
      success: true,
      message: 'Employé supprimé avec succès',
    };
  }
}