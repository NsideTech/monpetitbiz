import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EmployeeCode } from '../entities/employee-code.entity';
import { User, UserRole } from '../entities/user.entity';
import { Business } from '../entities/business.entity';

export interface GenerateEmployeeCodeDto {
  businessId: string;
  createdBy: string;
}

export interface UseEmployeeCodeDto {
  code: string;
  phoneNumber: string;
}

export interface EmployeeCodeInfo {
  id: string;
  code: string;
  businessName: string;
  expiresAt: Date;
  isActive: boolean;
  usedBy?: string;
  usedAt?: Date;
}

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(EmployeeCode)
    private readonly employeeCodeRepository: Repository<EmployeeCode>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
  ) {}

  /**
   * Generate a new employee code for a business
   */
  async generateEmployeeCode(dto: GenerateEmployeeCodeDto): Promise<EmployeeCodeInfo> {
    // Verify the creator is the business owner
    const creator = await this.userRepository.findOne({
      where: { id: dto.createdBy, businessId: dto.businessId, role: UserRole.OWNER },
      relations: ['business']
    });

    if (!creator) {
      throw new ForbiddenException('Only business owners can generate employee codes');
    }

    // Generate unique 6-character code
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = this.generateCode();
      const existing = await this.employeeCodeRepository.findOne({ where: { code } });
      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new BadRequestException('Unable to generate unique code. Please try again.');
    }

    // Set expiration to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create employee code
    const employeeCode = this.employeeCodeRepository.create({
      businessId: dto.businessId,
      code,
      createdBy: dto.createdBy,
      expiresAt,
      isActive: true,
    });

    const savedCode = await this.employeeCodeRepository.save(employeeCode);

    return {
      id: savedCode.id,
      code: savedCode.code,
      businessName: creator.business.name,
      expiresAt: savedCode.expiresAt,
      isActive: savedCode.isActive,
    };
  }

  /**
   * Lookup business by employee invitation code (read-only, does not consume the code)
   */
  async lookupByInviteCode(code: string): Promise<{ business: Business; businessCode: string } | null> {
    const employeeCode = await this.employeeCodeRepository.findOne({
      where: { code: code.toUpperCase(), isActive: true },
      relations: ['business'],
    });

    if (!employeeCode || new Date() > employeeCode.expiresAt || employeeCode.usedBy) {
      return null;
    }

    return {
      business: employeeCode.business,
      businessCode: employeeCode.business.businessCode,
    };
  }

  /**
   * Use an employee code to join a business
   */
  async useEmployeeCode(dto: UseEmployeeCodeDto): Promise<{
    business: Business;
    code: EmployeeCode;
  }> {
    // Find the code
    const employeeCode = await this.employeeCodeRepository.findOne({
      where: { code: dto.code, isActive: true },
      relations: ['business']
    });

    if (!employeeCode) {
      throw new NotFoundException('Code employé invalide ou expiré');
    }

    // Check if code is expired
    if (new Date() > employeeCode.expiresAt) {
      // Mark as inactive
      employeeCode.isActive = false;
      await this.employeeCodeRepository.save(employeeCode);
      throw new BadRequestException('Ce code a expiré. Demandez un nouveau code à votre patron.');
    }

    // Check if code is already used
    if (employeeCode.usedBy) {
      throw new BadRequestException('Ce code a déjà été utilisé.');
    }

    // Check if user already exists in this business
    const existingUser = await this.userRepository.findOne({
      where: { phoneNumber: dto.phoneNumber, businessId: employeeCode.businessId }
    });

    if (existingUser) {
      throw new BadRequestException('Vous êtes déjà employé de cette entreprise.');
    }

    // Mark code as used
    employeeCode.usedBy = dto.phoneNumber;
    employeeCode.usedAt = new Date();
    employeeCode.isActive = false;
    await this.employeeCodeRepository.save(employeeCode);

    return {
      business: employeeCode.business,
      code: employeeCode,
    };
  }

  /**
   * Create employee user account after code validation
   */
  async createEmployeeAccount(
    phoneNumber: string,
    businessId: string,
    invitedBy: string
  ): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { phoneNumber, businessId }
    });

    if (existingUser) {
      throw new BadRequestException('Employee account already exists');
    }

    // Create employee user
    const employee = this.userRepository.create({
      phoneNumber,
      businessId,
      role: UserRole.SELLER,
      language: 'fr', // Default language
      isActive: true,
      invitedBy,
      joinedAt: new Date(),
    });

    return await this.userRepository.save(employee);
  }

  /**
   * Get all active employee codes for a business
   */
  async getEmployeeCodes(businessId: string, userId: string): Promise<EmployeeCodeInfo[]> {
    // Verify user is business owner
    const user = await this.userRepository.findOne({
      where: { id: userId, businessId, role: UserRole.OWNER }
    });

    if (!user) {
      throw new ForbiddenException('Only business owners can view employee codes');
    }

    const codes = await this.employeeCodeRepository.find({
      where: { businessId, isActive: true },
      relations: ['business'],
      order: { createdAt: 'DESC' }
    });

    return codes.map(code => ({
      id: code.id,
      code: code.code,
      businessName: code.business.name,
      expiresAt: code.expiresAt,
      isActive: code.isActive,
      usedBy: code.usedBy,
      usedAt: code.usedAt,
    }));
  }

  /**
   * Get all employees for a business (sellers and managers, not owners)
   */
  async getEmployees(businessId: string, userId: string): Promise<User[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId, businessId, role: UserRole.OWNER }
    });

    if (!user) {
      throw new ForbiddenException('Only business owners can view employees');
    }

    return await this.userRepository.find({
      where: { businessId, role: In([UserRole.SELLER, UserRole.MANAGER]) },
      order: { joinedAt: 'DESC' }
    });
  }

  /**
   * Remove an employee from the business (deactivate for audit trail)
   */
  async removeEmployee(businessId: string, ownerId: string, employeePhoneNumber: string): Promise<void> {
    const owner = await this.userRepository.findOne({
      where: { id: ownerId, businessId, role: UserRole.OWNER }
    });

    if (!owner) {
      throw new ForbiddenException('Only business owners can remove employees');
    }

    const employee = await this.userRepository.findOne({
      where: {
        phoneNumber: employeePhoneNumber,
        businessId,
        role: In([UserRole.SELLER, UserRole.MANAGER]),
      }
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    employee.isActive = false;
    await this.userRepository.save(employee);
  }

  /**
   * Update employee role (seller <-> manager). Cannot promote to owner.
   */
  async updateEmployeeRole(
    businessId: string,
    ownerId: string,
    employeePhoneNumber: string,
    newRole: 'seller' | 'manager',
  ): Promise<User> {
    const owner = await this.userRepository.findOne({
      where: { id: ownerId, businessId, role: UserRole.OWNER }
    });

    if (!owner) {
      throw new ForbiddenException('Only business owners can change employee roles');
    }

    const employee = await this.userRepository.findOne({
      where: {
        phoneNumber: employeePhoneNumber,
        businessId,
        role: In([UserRole.SELLER, UserRole.MANAGER]),
      }
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const role = newRole === 'manager' ? UserRole.MANAGER : UserRole.SELLER;
    employee.role = role;
    return await this.userRepository.save(employee);
  }

  /**
   * Deactivate expired codes (cleanup job)
   */
  async deactivateExpiredCodes(): Promise<number> {
    const result = await this.employeeCodeRepository.update(
      {
        isActive: true,
        expiresAt: new Date() // Less than current time
      },
      { isActive: false }
    );

    return result.affected || 0;
  }

  /**
   * Generate a random 6-character alphanumeric code
   */
  private generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Validate if a code format is correct
   */
  isValidCodeFormat(code: string): boolean {
    return /^[A-Z0-9]{6}$/.test(code);
  }
}