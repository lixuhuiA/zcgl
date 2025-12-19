
export type AssetTag = '进攻' | '防守' | '稳健';

export interface StockAsset {
  id: string;
  name: string;
  code: string;
  tag: AssetTag;
  currentPrice: number;
  costPrice: number;
  quantity: number;
  changePercent: number;
}

export interface FundAsset {
  id: string;
  name: string;
  code: string;
  tag: AssetTag;
  shares: number;
  netValue: number;
  estimatedChange: number;
  investmentDay?: number; // 0-6 (Sunday-Saturday)
}

export interface FixedIncomeAsset {
  id: string;
  name: string;
  principal: number;
  apy: number;
  startDate: string;
}

export interface DailySnapshot {
  date: string;
  totalValue: number;
}
