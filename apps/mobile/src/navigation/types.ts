export type AuthStackParamList = {
  Auth: undefined;
  Otp: {phoneNumber: string; devCode?: string};
  RegisterBusiness: {phoneNumber?: string};
  JoinBusiness: {phoneNumber?: string};
};

export type MainStackParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  Receivables: undefined;
  Loans: undefined;
  Products: { productId?: string } | undefined;
  Reports: undefined;
  Chat: {prefill?: string};
  More: undefined;
  Employees: undefined;
};
