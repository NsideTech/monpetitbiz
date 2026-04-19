export type AuthVerifyResponse = {
  accessToken: string;
  user: {
    id: string;
    phoneNumber: string;
    businessId: string;
    employeeName: string;
    role: 'owner' | 'manager' | 'seller';
    language: 'fr' | 'wo';
    business?: {
      id: string;
      name: string;
      businessCode?: string;
    };
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
  quantity?: number;
  description?: string;
  isCreditSale?: boolean;
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

export type Employee = {
  id: string;
  phoneNumber: string;
  employeeName: string | null;
  role: 'seller' | 'manager';
  isActive: boolean;
  joinedAt: string | null;
};

export type EmployeeCode = {
  code: string;
  expiresAt: string;
  isActive: boolean;
  usedBy: string | null;
  usedAt: string | null;
};

export type ReceivableStatus = 'open' | 'partial' | 'paid' | 'overdue';

export type ReceivablePayment = {
  id: string;
  amount: number;
  paymentDate: string;
  notes?: string;
  createdAt: string;
};

export type Receivable = {
  id: string;
  debtorName: string;
  debtorPhone?: string;
  amount: number;
  amountPaid: number;
  currency: string;
  description?: string;
  dueDate?: string;
  status: ReceivableStatus;
  createdAt: string;
  updatedAt: string;
  payments?: ReceivablePayment[];
};

export type ReceivablesSummary = {
  totalOutstanding: number;
  count: number;
  overdueCount: number;
};

export type LoanStatus = 'open' | 'partial' | 'paid' | 'overdue';
export type LoanType = 'supplier' | 'microcredit';

export type LoanPayment = {
  id: string;
  amount: number;
  paymentDate: string;
  notes?: string;
  createdAt: string;
};

export type Loan = {
  id: string;
  lenderName: string;
  lenderPhone?: string;
  loanType: LoanType;
  amount: number;
  amountPaid: number;
  currency: string;
  description?: string;
  dueDate: string;
  status: LoanStatus;
  createdAt: string;
  updatedAt: string;
  payments?: LoanPayment[];
};

export type LoansSummary = {
  totalOutstanding: number;
  count: number;
  overdueCount: number;
};
