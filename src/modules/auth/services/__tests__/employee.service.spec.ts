import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { In } from 'typeorm';
import { EmployeeService } from '../employee.service';
import { EmployeeCode } from '../../entities/employee-code.entity';
import { User, UserRole } from '../../entities/user.entity';
import { Business } from '../../entities/business.entity';

describe('EmployeeService', () => {
  let service: EmployeeService;

  const mockEmployeeCodeFindOne = jest.fn();
  const mockEmployeeCodeFind = jest.fn();
  const mockEmployeeCodeCreate = jest.fn();
  const mockEmployeeCodeSave = jest.fn();
  const mockEmployeeCodeUpdate = jest.fn();

  const mockUserFindOne = jest.fn();
  const mockUserFind = jest.fn();
  const mockUserCreate = jest.fn();
  const mockUserSave = jest.fn();

  const mockBusinessFindOne = jest.fn();

  const mockEmployeeCodeRepository = {
    findOne: mockEmployeeCodeFindOne,
    find: mockEmployeeCodeFind,
    create: mockEmployeeCodeCreate,
    save: mockEmployeeCodeSave,
    update: mockEmployeeCodeUpdate,
  };

  const mockUserRepository = {
    findOne: mockUserFindOne,
    find: mockUserFind,
    create: mockUserCreate,
    save: mockUserSave,
  };

  const mockBusinessRepository = {
    findOne: mockBusinessFindOne,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        {
          provide: getRepositoryToken(EmployeeCode),
          useValue: mockEmployeeCodeRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Business),
          useValue: mockBusinessRepository,
        },
      ],
    }).compile();

    service = module.get<EmployeeService>(EmployeeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateEmployeeCode', () => {
    it('should throw ForbiddenException when user is not business owner', async () => {
      mockUserFindOne.mockResolvedValue(null);

      await expect(
        service.generateEmployeeCode({
          businessId: 'biz-1',
          createdBy: 'user-1',
        }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.generateEmployeeCode({
          businessId: 'biz-1',
          createdBy: 'user-1',
        }),
      ).rejects.toThrow('Only business owners can generate employee codes');
    });

    it('should throw BadRequestException when unable to generate unique code', async () => {
      const mockCreator = {
        id: 'user-1',
        businessId: 'biz-1',
        role: UserRole.OWNER,
        business: { name: 'Test Biz' },
      };
      mockUserFindOne.mockResolvedValue(mockCreator);
      mockEmployeeCodeFindOne.mockResolvedValue({ code: 'ABC123' });

      await expect(
        service.generateEmployeeCode({
          businessId: 'biz-1',
          createdBy: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.generateEmployeeCode({
          businessId: 'biz-1',
          createdBy: 'user-1',
        }),
      ).rejects.toThrow('Unable to generate unique code');
    });

    it('should return EmployeeCodeInfo when successful', async () => {
      const mockCreator = {
        id: 'user-1',
        businessId: 'biz-1',
        role: UserRole.OWNER,
        business: { name: 'Test Biz' },
      };
      const savedCode = {
        id: 'code-1',
        code: 'XYZ789',
        expiresAt: new Date(),
        isActive: true,
      };
      mockUserFindOne.mockResolvedValue(mockCreator);
      mockEmployeeCodeFindOne.mockResolvedValue(null);
      mockEmployeeCodeCreate.mockReturnValue(savedCode);
      mockEmployeeCodeSave.mockResolvedValue(savedCode);

      const result = await service.generateEmployeeCode({
        businessId: 'biz-1',
        createdBy: 'user-1',
      });

      expect(result).toMatchObject({
        id: 'code-1',
        code: 'XYZ789',
        businessName: 'Test Biz',
        isActive: true,
      });
      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('lookupByInviteCode', () => {
    it('should return null when code not found', async () => {
      mockEmployeeCodeFindOne.mockResolvedValue(null);

      const result = await service.lookupByInviteCode('INVALID');

      expect(result).toBeNull();
    });

    it('should return null when code is expired', async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);
      mockEmployeeCodeFindOne.mockResolvedValue({
        code: 'ABC123',
        expiresAt: pastDate,
        usedBy: null,
        business: { businessCode: 'BIZ001' },
      });

      const result = await service.lookupByInviteCode('ABC123');

      expect(result).toBeNull();
    });

    it('should return null when code is already used', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 24);
      mockEmployeeCodeFindOne.mockResolvedValue({
        code: 'ABC123',
        expiresAt: futureDate,
        usedBy: '+226701234567',
        business: { businessCode: 'BIZ001' },
      });

      const result = await service.lookupByInviteCode('ABC123');

      expect(result).toBeNull();
    });

    it('should return business and businessCode when code is valid', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 24);
      const mockBusiness = { id: 'biz-1', businessCode: 'BIZ001', name: 'Test' };
      mockEmployeeCodeFindOne.mockResolvedValue({
        code: 'ABC123',
        expiresAt: futureDate,
        usedBy: null,
        business: mockBusiness,
      });

      const result = await service.lookupByInviteCode('abc123');

      expect(mockEmployeeCodeFindOne).toHaveBeenCalledWith({
        where: { code: 'ABC123', isActive: true },
        relations: ['business'],
      });
      expect(result).toEqual({
        business: mockBusiness,
        businessCode: 'BIZ001',
      });
    });
  });

  describe('useEmployeeCode', () => {
    it('should throw NotFoundException when code not found', async () => {
      mockEmployeeCodeFindOne.mockResolvedValue(null);

      await expect(
        service.useEmployeeCode({ code: 'INVALID', phoneNumber: '+226701234567' }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.useEmployeeCode({ code: 'INVALID', phoneNumber: '+226701234567' }),
      ).rejects.toThrow('Code employé invalide ou expiré');
    });

    it('should throw BadRequestException when code is expired', async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);
      const mockCode = {
        code: 'ABC123',
        expiresAt: pastDate,
        usedBy: null,
        businessId: 'biz-1',
        business: {},
      };
      mockEmployeeCodeFindOne.mockResolvedValue(mockCode);
      mockEmployeeCodeSave.mockResolvedValue({});

      await expect(
        service.useEmployeeCode({ code: 'ABC123', phoneNumber: '+226701234567' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.useEmployeeCode({ code: 'ABC123', phoneNumber: '+226701234567' }),
      ).rejects.toThrow('Ce code a expiré');
    });

    it('should throw BadRequestException when code already used', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 24);
      mockEmployeeCodeFindOne.mockResolvedValue({
        code: 'ABC123',
        expiresAt: futureDate,
        usedBy: '+226701234567',
        businessId: 'biz-1',
        business: {},
      });

      await expect(
        service.useEmployeeCode({ code: 'ABC123', phoneNumber: '+226701234567' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.useEmployeeCode({ code: 'ABC123', phoneNumber: '+226701234567' }),
      ).rejects.toThrow('Ce code a déjà été utilisé');
    });

    it('should throw BadRequestException when user already employee', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 24);
      const mockCode = {
        code: 'ABC123',
        expiresAt: futureDate,
        usedBy: null,
        businessId: 'biz-1',
        business: {},
      };
      mockEmployeeCodeFindOne.mockResolvedValue(mockCode);
      mockUserFindOne.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.useEmployeeCode({ code: 'ABC123', phoneNumber: '+226701234567' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.useEmployeeCode({ code: 'ABC123', phoneNumber: '+226701234567' }),
      ).rejects.toThrow('Vous êtes déjà employé de cette entreprise');
    });

    it('should return business and code when successful', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 24);
      const mockBusiness = { id: 'biz-1' };
      const mockCode = {
        code: 'ABC123',
        expiresAt: futureDate,
        usedBy: null,
        businessId: 'biz-1',
        business: mockBusiness,
      };
      mockEmployeeCodeFindOne.mockResolvedValue(mockCode);
      mockUserFindOne.mockResolvedValue(null);
      mockEmployeeCodeSave.mockResolvedValue(mockCode);

      const result = await service.useEmployeeCode({
        code: 'ABC123',
        phoneNumber: '+226701234567',
      });

      expect(result).toEqual({
        business: mockBusiness,
        code: mockCode,
      });
      expect(mockEmployeeCodeSave).toHaveBeenCalled();
    });
  });

  describe('createEmployeeAccount', () => {
    it('should throw BadRequestException when employee already exists', async () => {
      mockUserFindOne.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.createEmployeeAccount('+226701234567', 'biz-1', 'owner-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createEmployeeAccount('+226701234567', 'biz-1', 'owner-1'),
      ).rejects.toThrow('Employee account already exists');
    });

    it('should create and return employee user when successful', async () => {
      const mockEmployee = {
        id: 'user-1',
        phoneNumber: '+226701234567',
        businessId: 'biz-1',
        role: UserRole.SELLER,
      };
      mockUserFindOne.mockResolvedValue(null);
      mockUserCreate.mockReturnValue(mockEmployee);
      mockUserSave.mockResolvedValue(mockEmployee);

      const result = await service.createEmployeeAccount(
        '+226701234567',
        'biz-1',
        'owner-1',
      );

      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: '+226701234567',
          businessId: 'biz-1',
          role: UserRole.SELLER,
          language: 'fr',
          isActive: true,
          invitedBy: 'owner-1',
        }),
      );
      expect(result).toEqual(mockEmployee);
    });
  });

  describe('getEmployeeCodes', () => {
    it('should throw ForbiddenException when user is not owner', async () => {
      mockUserFindOne.mockResolvedValue(null);

      await expect(
        service.getEmployeeCodes('biz-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.getEmployeeCodes('biz-1', 'user-1'),
      ).rejects.toThrow('Only business owners can view employee codes');
    });

    it('should return employee codes when user is owner', async () => {
      mockUserFindOne.mockResolvedValue({ id: 'owner-1', role: UserRole.OWNER });
      const mockCodes = [
        {
          id: 'code-1',
          code: 'ABC123',
          business: { name: 'Test Biz' },
          expiresAt: new Date(),
          isActive: true,
          usedBy: null,
          usedAt: null,
        },
      ];
      mockEmployeeCodeFind.mockResolvedValue(mockCodes);

      const result = await service.getEmployeeCodes('biz-1', 'owner-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'code-1',
        code: 'ABC123',
        businessName: 'Test Biz',
        isActive: true,
      });
    });
  });

  describe('getEmployees', () => {
    it('should throw ForbiddenException when user is not owner', async () => {
      mockUserFindOne.mockResolvedValue(null);

      await expect(
        service.getEmployees('biz-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return employees when user is owner', async () => {
      mockUserFindOne.mockResolvedValue({ id: 'owner-1', role: UserRole.OWNER });
      const mockEmployees = [{ id: 'emp-1', role: UserRole.SELLER }];
      mockUserFind.mockResolvedValue(mockEmployees);

      const result = await service.getEmployees('biz-1', 'owner-1');

      expect(result).toEqual(mockEmployees);
      expect(mockUserFind).toHaveBeenCalledWith({
        where: { businessId: 'biz-1', role: In([UserRole.SELLER, UserRole.MANAGER]) },
        order: { joinedAt: 'DESC' },
      });
    });
  });

  describe('removeEmployee', () => {
    it('should throw ForbiddenException when user is not owner', async () => {
      mockUserFindOne.mockResolvedValue(null);

      await expect(
        service.removeEmployee('biz-1', 'user-1', '+226701234567'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when employee not found', async () => {
      const mockOwner = { id: 'owner-1', businessId: 'biz-1', role: UserRole.OWNER };
      mockUserFindOne.mockImplementation((query: { where?: Record<string, unknown> }) => {
        const isOwnerQuery = query?.where && 'role' in query.where && query.where.role === UserRole.OWNER;
        return Promise.resolve(isOwnerQuery ? mockOwner : null);
      });

      await expect(
        service.removeEmployee('biz-1', 'owner-1', '+226701234567'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeEmployee('biz-1', 'owner-1', '+226701234567'),
      ).rejects.toThrow('Employee not found');
    });

    it('should deactivate employee when successful', async () => {
      const mockEmployee = { id: 'emp-1', isActive: true };
      mockUserFindOne
        .mockResolvedValueOnce({ id: 'owner-1', role: UserRole.OWNER })
        .mockResolvedValueOnce(mockEmployee);
      mockUserSave.mockResolvedValue({ ...mockEmployee, isActive: false });

      await service.removeEmployee('biz-1', 'owner-1', '+226701234567');

      expect(mockUserSave).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  describe('updateEmployeeRole', () => {
    it('should throw ForbiddenException when user is not owner', async () => {
      mockUserFindOne.mockResolvedValue(null);

      await expect(
        service.updateEmployeeRole('biz-1', 'user-1', '+226701234567', 'manager'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when employee not found', async () => {
      mockUserFindOne
        .mockResolvedValueOnce({ id: 'owner-1', role: UserRole.OWNER })
        .mockResolvedValueOnce(null);

      await expect(
        service.updateEmployeeRole('biz-1', 'owner-1', '+226701234567', 'manager'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update role to manager when successful', async () => {
      const mockEmployee = { id: 'emp-1', role: UserRole.SELLER };
      mockUserFindOne
        .mockResolvedValueOnce({ id: 'owner-1', role: UserRole.OWNER })
        .mockResolvedValueOnce(mockEmployee);
      mockUserSave.mockResolvedValue({ ...mockEmployee, role: UserRole.MANAGER });

      const result = await service.updateEmployeeRole(
        'biz-1',
        'owner-1',
        '+226701234567',
        'manager',
      );

      expect(mockUserSave).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.MANAGER }),
      );
      expect(result.role).toBe(UserRole.MANAGER);
    });
  });

  describe('isValidCodeFormat', () => {
    it('should return true for valid 6-char alphanumeric code', () => {
      expect(service.isValidCodeFormat('ABC123')).toBe(true);
      expect(service.isValidCodeFormat('XYZ789')).toBe(true);
    });

    it('should return false for invalid format', () => {
      expect(service.isValidCodeFormat('ABC12')).toBe(false);
      expect(service.isValidCodeFormat('ABC1234')).toBe(false);
      expect(service.isValidCodeFormat('abc123')).toBe(false);
      expect(service.isValidCodeFormat('AB-123')).toBe(false);
    });
  });
});
