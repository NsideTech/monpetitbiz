import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) => 
  SetMetadata(PERMISSIONS_KEY, permissions);

// Common permission constants
export const PERMISSIONS = {
  CREATE_SALE: 'create_sale',
  CREATE_EXPENSE: 'create_expense',
  VIEW_REPORTS: 'view_reports',
  MANAGE_STOCK: 'manage_stock',
  VIEW_BALANCE: 'view_balance',
  GENERATE_PDF: 'generate_pdf',
  MANAGE_USERS: 'manage_users',
} as const;