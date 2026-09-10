export type Frequency =
  | "daily"
  | "weekly"
  | "monthly";

export type FundQuote = {
  code: string;
  name: string;
  nav: number;
  navDate: string;
  estimatedNav: number | null;
  estimatedChangePct: number | null;
  estimatedAt: string | null;
};

export type DcaPlan = {
  id: string;
  name: string;
  code: string;
  amount: number;
  frequency: Frequency;
  startDate: string;
  enabled: boolean;
};

export type Transaction = {
  id: string;
  planId?: string;
  code: string;
  name: string;
  date: string;
  amount: number;
  nav: number;
  shares: number;
  fee: number;
};

export type Snapshot = {
  date: string;
  value: number;
  invested: number;
};
