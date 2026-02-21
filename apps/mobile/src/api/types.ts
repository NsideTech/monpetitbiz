export type AuthVerifyResponse = {
  accessToken: string;
  user: {
    id: string;
    phoneNumber: string;
    businessId: string;
    employeeName: string;
    role: 'owner' | 'manager' | 'seller';
    language: 'fr' | 'wo';
  };
};

export type UserProfile = AuthVerifyResponse['user'];

export type RegisterBusinessResponse = {
  user: UserProfile;
  business: {
    id: string;
    name: string;
    businessCode: string;
    currency: string;
    timezone: string;
  };
  accessToken: string;
  message: string;
};

export type BusinessInfo = {
  id: string;
  name: string;
  ownerName: string;
  businessCode: string;
  currency: string;
  timezone: string;
  country: string | null;
};

export type DashboardSummary = {
  todaySales: number;
  todayExpenses: number;
  todayProfit: number;
  weekSales: number;
  weekExpenses: number;
  weekProfit: number;
  monthSales: number;
  monthExpenses: number;
  monthProfit: number;
  currency: string;
  /** Convenience: daily = today */
  daily?: { totalSales: number; totalExpenses: number; netProfit: number };
};

export type BalanceReport = {
  period: string;
  startDate: string;
  endDate: string;
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
  transactionCount: number;
  salesCount: number;
  expenseCount: number;
  currency: string;
  topProducts?: Array<{ product: string; revenue: number; quantity: number; transactionCount: number }>;
};

export type Transaction = {
  id: string;
  type: 'sale' | 'expense';
  amount: number;
  currency: string;
  product?: string;
  description?: string;
  createdAt: string;
};

export type StockMovement = {
  id: string;
  productName: string;
  movementType: string;
  quantity: number;
  unit: string;
  baseQuantity: number;
  previousStock: number;
  newStock: number;
  notes?: string;
  createdAt: string;
};

export type StockWarning = {
  product: string;
  currentQuantity: number;
  warningLevel: number;
  status: 'low' | 'out';
  message: string;
};

export type ChatMessage = {
  id: string;
  message: string;
  response: string;
  timestamp: string;
};

export type Product = {
  id: string;
  product: string;
  quantity: number;
  unitPrice: number | string | null;
  productCode: string | null;
};
