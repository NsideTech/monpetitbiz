import {apiRequest} from './client';
import {
  AuthVerifyResponse,
  BalanceReport,
  BusinessInfo,
  ChatMessage,
  DashboardSummary,
  Employee,
  EmployeeCode,
  Loan,
  LoansSummary,
  Product,
  Receivable,
  ReceivablesSummary,
  RegisterBusinessResponse,
  StockMovement,
  StockWarning,
  Transaction,
  UserProfile,
} from './types';

export const sendOtp = async (
  phoneNumber: string,
): Promise<{message: string; code?: string}> => {
  return apiRequest<{message: string; code?: string}>('/auth/send-otp', {
    method: 'POST',
    body: {phoneNumber},
  });
};

/** Dev only: fetch current OTP from debug endpoint */
export const fetchDevOtp = async (
  phoneNumber: string,
): Promise<string | null> => {
  const res = await apiRequest<{
    success: boolean;
    data: Array<{phoneNumber: string; code: string; isExpired: boolean}>;
  }>('/auth/debug/otp-sessions');
  const digits = (n: string) => n.replace(/\D/g, '').replace(/^0/, '226');
  const session = res.data?.find(s => digits(s.phoneNumber) === digits(phoneNumber));
  return session && !session.isExpired ? session.code : null;
};

export const verifyOtp = async (
  phoneNumber: string,
  code: string,
): Promise<AuthVerifyResponse> => {
  return apiRequest<AuthVerifyResponse>('/auth/verify-otp', {
    method: 'POST',
    body: {phoneNumber, code},
  });
};

export const registerBusinessOwner = async (payload: {
  phoneNumber: string;
  businessName: string;
  ownerName: string;
  language?: 'fr' | 'wo';
}): Promise<RegisterBusinessResponse> => {
  const res = await apiRequest<{success: boolean; data: {user: RegisterBusinessResponse['user']; accessToken: string; businessCode: string}; message: string}>('/auth/register-business-owner', {
    method: 'POST',
    body: payload,
  });
  return {
    user: res.data.user,
    accessToken: res.data.accessToken,
    message: res.message,
    business: {
      id: res.data.user.businessId,
      name: '',
      businessCode: res.data.businessCode,
      currency: 'XOF',
      timezone: 'Africa/Dakar',
    },
  };
};

export const fetchProfile = async (token: string): Promise<UserProfile> => {
  const res = await apiRequest<{success: boolean; data: UserProfile}>('/auth/profile', {token});
  return res.data;
};

export const fetchBusinessInfo = async (token: string): Promise<BusinessInfo> => {
  const res = await apiRequest<{success: boolean; data: {business: BusinessInfo}}>('/auth/profile', {token});
  return res.data.business;
};

export const updateBusinessInfo = async (
  token: string,
  updates: {name?: string; ownerName?: string; currency?: string; timezone?: string; country?: string},
): Promise<BusinessInfo> => {
  const res = await apiRequest<{success: boolean; data: BusinessInfo}>('/auth/business', {
    method: 'PATCH',
    token,
    body: updates,
  });
  return res.data;
};

export const fetchDashboardSummary = async (
  token: string,
  businessId: string,
): Promise<DashboardSummary> => {
  return apiRequest<DashboardSummary>(`/dashboard/${businessId}/summary`, {
    token,
  });
};

export const fetchChatHistory = async (
  token: string,
  limit?: number,
): Promise<{messages: ChatMessage[]; total: number}> => {
  const query = limit ? `?limit=${limit}` : '';
  return apiRequest<{messages: ChatMessage[]; total: number}>(
    `/chat/history${query}`,
    {token},
  );
};

export const fetchProducts = async (
  token: string,
  businessId: string,
): Promise<Product[]> => {
  return apiRequest<Product[]>(`/dashboard/${businessId}/stock-levels`, {
    token,
  });
};

export const createProduct = async (
  token: string,
  businessId: string,
  data: { name: string; quantity?: number; unitPrice?: number },
): Promise<Product> => {
  return apiRequest<Product>(`/dashboard/${businessId}/products`, {
    method: 'POST',
    token,
    body: data,
  });
};

export const updateProduct = async (
  token: string,
  businessId: string,
  productId: string,
  data: { name?: string; quantity?: number; unitPrice?: number },
): Promise<Product> => {
  return apiRequest<Product>(
    `/dashboard/${businessId}/products/${productId}`,
    {
      method: 'PATCH',
      token,
      body: data,
    },
  );
};

export const deleteProduct = async (
  token: string,
  businessId: string,
  productId: string,
): Promise<{ success: boolean; message: string }> => {
  return apiRequest<{ success: boolean; message: string }>(
    `/dashboard/${businessId}/products/${productId}`,
    {
      method: 'DELETE',
      token,
    },
  );
};

export const sendChatMessage = async (
  token: string,
  message: string,
): Promise<{success: boolean; response: string; messageId: string; timestamp: string}> => {
  return apiRequest<{
    success: boolean;
    response: string;
    messageId: string;
    timestamp: string;
  }>('/chat/message', {
    method: 'POST',
    token,
    body: {message},
  });
};

export const fetchReport = async (
  token: string,
  businessId: string,
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
): Promise<BalanceReport> => {
  const path =
    period === 'yearly'
      ? `/reports/${businessId}/yearly`
      : `/reports/${businessId}/${period === 'daily' ? 'daily' : period === 'weekly' ? 'weekly' : 'monthly'}`;
  return apiRequest<BalanceReport>(path, {token});
};

export const fetchTransactions = async (
  token: string,
  businessId: string,
  filters?: {type?: 'sale' | 'expense'; startDate?: string; endDate?: string; limit?: number; offset?: number},
): Promise<Transaction[]> => {
  const params = new URLSearchParams();
  if (filters?.type) params.set('type', filters.type);
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<Transaction[]>(`/dashboard/${businessId}/transactions${query}`, {token});
};

export const createTransaction = async (
  token: string,
  businessId: string,
  data: {
    type: 'sale' | 'expense';
    amount: number;
    product?: string;
    quantity?: number;
    description?: string;
    creditSale?: { debtorName: string; debtorPhone?: string };
  },
): Promise<Transaction> => {
  return apiRequest<Transaction>(`/dashboard/${businessId}/transactions`, {
    method: 'POST',
    token,
    body: data,
  });
};

export const fetchStockMovements = async (
  token: string,
  businessId: string,
  filters?: {productId?: string; limit?: number; offset?: number},
): Promise<StockMovement[]> => {
  const params = new URLSearchParams();
  if (filters?.productId) params.set('productId', filters.productId);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<StockMovement[]>(`/dashboard/${businessId}/stock-movements${query}`, {token});
};

export const fetchStockWarnings = async (
  token: string,
  businessId: string,
  threshold?: number,
): Promise<StockWarning[]> => {
  const query = threshold != null ? `?threshold=${threshold}` : '';
  return apiRequest<StockWarning[]>(
    `/dashboard/${businessId}/stock-warnings${query}`,
    {token},
  );
};

export const fetchReceivablesSummary = async (
  token: string,
  businessId: string,
): Promise<ReceivablesSummary> => {
  return apiRequest<ReceivablesSummary>(
    `/dashboard/${businessId}/receivables-summary`,
    {token},
  );
};

export const fetchReceivables = async (
  token: string,
  businessId: string,
  filters?: {status?: 'open' | 'partial' | 'paid' | 'overdue'; limit?: number; offset?: number},
): Promise<Receivable[]> => {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.limit != null) params.set('limit', String(filters.limit));
  if (filters?.offset != null) params.set('offset', String(filters.offset));
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<Receivable[]>(`/dashboard/${businessId}/receivables${query}`, {token});
};

export const fetchReceivable = async (
  token: string,
  businessId: string,
  id: string,
): Promise<Receivable> => {
  return apiRequest<Receivable>(`/dashboard/${businessId}/receivables/${id}`, {token});
};

export const createReceivable = async (
  token: string,
  businessId: string,
  data: {debtorName: string; debtorPhone?: string; amount: number; description?: string; dueDate?: string},
): Promise<Receivable> => {
  return apiRequest<Receivable>(`/dashboard/${businessId}/receivables`, {
    method: 'POST',
    token,
    body: data,
  });
};

export const recordReceivablePayment = async (
  token: string,
  businessId: string,
  receivableId: string,
  data: {amount: number; paymentDate?: string; notes?: string},
): Promise<Receivable> => {
  return apiRequest<Receivable>(
    `/dashboard/${businessId}/receivables/${receivableId}/payments`,
    {
      method: 'POST',
      token,
      body: data,
    },
  );
};

export const recordFullReceivablePayment = async (
  token: string,
  businessId: string,
  receivableId: string,
  data?: {paymentDate?: string; notes?: string},
): Promise<Receivable> => {
  return apiRequest<Receivable>(
    `/dashboard/${businessId}/receivables/${receivableId}/payments/full`,
    {
      method: 'POST',
      token,
      body: data || {},
    },
  );
};

export const fetchLoansSummary = async (
  token: string,
  businessId: string,
): Promise<LoansSummary> => {
  return apiRequest<LoansSummary>(
    `/dashboard/${businessId}/loans-summary`,
    {token},
  );
};

export const fetchLoans = async (
  token: string,
  businessId: string,
  filters?: {status?: 'open' | 'partial' | 'paid' | 'overdue'; limit?: number; offset?: number},
): Promise<Loan[]> => {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.limit != null) params.set('limit', String(filters.limit));
  if (filters?.offset != null) params.set('offset', String(filters.offset));
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<Loan[]>(`/dashboard/${businessId}/loans${query}`, {token});
};

export const fetchLoan = async (
  token: string,
  businessId: string,
  id: string,
): Promise<Loan> => {
  return apiRequest<Loan>(`/dashboard/${businessId}/loans/${id}`, {token});
};

export const createLoan = async (
  token: string,
  businessId: string,
  data: {lenderName: string; lenderPhone?: string; loanType: 'supplier' | 'microcredit'; amount: number; dueDate: string; description?: string},
): Promise<Loan> => {
  return apiRequest<Loan>(`/dashboard/${businessId}/loans`, {
    method: 'POST',
    token,
    body: data,
  });
};

export const recordLoanPayment = async (
  token: string,
  businessId: string,
  loanId: string,
  data: {amount: number; paymentDate?: string; notes?: string},
): Promise<Loan> => {
  return apiRequest<Loan>(
    `/dashboard/${businessId}/loans/${loanId}/payments`,
    {
      method: 'POST',
      token,
      body: data,
    },
  );
};

export const recordFullLoanPayment = async (
  token: string,
  businessId: string,
  loanId: string,
  data?: {paymentDate?: string; notes?: string},
): Promise<Loan> => {
  return apiRequest<Loan>(
    `/dashboard/${businessId}/loans/${loanId}/payments/full`,
    {
      method: 'POST',
      token,
      body: data || {},
    },
  );
};

export const adjustStock = async (
  token: string,
  businessId: string,
  productId: string,
  quantity: number,
): Promise<Product> => {
  return apiRequest<Product>(`/dashboard/${businessId}/stock/${productId}`, {
    method: 'PATCH',
    token,
    body: {quantity},
  });
};

export const fetchEmployees = async (token: string): Promise<Employee[]> => {
  const res = await apiRequest<{success: boolean; data: Employee[]}>('/auth/employees', {token});
  return res.data;
};

export const generateEmployeeCode = async (token: string): Promise<EmployeeCode> => {
  const res = await apiRequest<{success: boolean; data: EmployeeCode}>('/auth/generate-employee-code', {
    method: 'POST',
    token,
  });
  return res.data;
};

export const updateEmployeeRole = async (
  token: string,
  phoneNumber: string,
  role: 'seller' | 'manager',
): Promise<void> => {
  await apiRequest(`/auth/employees/${encodeURIComponent(phoneNumber)}`, {
    method: 'PATCH',
    token,
    body: {role},
  });
};

export const removeEmployee = async (
  token: string,
  phoneNumber: string,
): Promise<void> => {
  await apiRequest(`/auth/employees/${encodeURIComponent(phoneNumber)}`, {
    method: 'DELETE',
    token,
  });
};

export const lookupBusinessByCode = async (
  code: string,
): Promise<{businessName: string; businessCode: string; employeeCount: number}> => {
  const res = await apiRequest<{
    success: boolean;
    data?: {business: {id: string; name: string; businessCode: string}; employeeCount: number};
    message?: string;
  }>(`/auth/business/${encodeURIComponent(code.toUpperCase())}`);
  if (!res.success || !res.data) {
    throw new Error(res.message || 'Code introuvable');
  }
  return {
    businessName: res.data.business.name,
    businessCode: res.data.business.businessCode,
    employeeCount: res.data.employeeCount,
  };
};

export const registerEmployee = async (payload: {
  phoneNumber: string;
  businessCode: string;
  employeeName: string;
  role: 'seller' | 'manager';
  language?: string;
}): Promise<{accessToken: string; user: UserProfile}> => {
  const res = await apiRequest<{
    success: boolean;
    data: {user: UserProfile; accessToken: string};
    message: string;
  }>('/auth/register-employee', {
    method: 'POST',
    body: payload,
  });
  if (!res.success) {
    throw new Error((res as any).message || "Erreur d'inscription");
  }
  return {accessToken: res.data.accessToken, user: res.data.user};
};
