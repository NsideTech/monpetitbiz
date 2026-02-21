export type AuthStackParamList = {
  Auth: undefined;
  Otp: {phoneNumber: string; devCode?: string};
  RegisterBusiness: {phoneNumber?: string};
};

export type MainStackParamList = {
  Dashboard: undefined;
  Chat: {prefill?: string};
};

export type RootTabParamList = {
  HomeTab: undefined;
  TransactionsTab: undefined;
  ChatTab: undefined;
  StockTab: undefined;
  ReportsTab: undefined;
  MoreTab: undefined;
};
