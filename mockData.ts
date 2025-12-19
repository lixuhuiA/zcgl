
import { StockAsset, FundAsset, FixedIncomeAsset, DailySnapshot } from './types';

export const mockStocks: StockAsset[] = [
  {
    id: '1',
    name: '纳指ETF',
    code: '513100',
    tag: '进攻',
    currentPrice: 1.542,
    costPrice: 1.420,
    quantity: 29182,
    changePercent: 1.2
  },
  {
    id: '2',
    name: '红利低波',
    code: '512890',
    tag: '防守',
    currentPrice: 1.254,
    costPrice: 1.300,
    quantity: 27910,
    changePercent: -0.1
  },
  {
    id: '3',
    name: '黄金ETF',
    code: '518880',
    tag: '防守',
    currentPrice: 5.432,
    costPrice: 5.100,
    quantity: 1840,
    changePercent: 0.5
  }
];

export const mockFunds: FundAsset[] = [
  {
    id: '101',
    name: '景顺长城A500',
    code: '022439',
    tag: '稳健',
    shares: 15000,
    netValue: 1.0,
    estimatedChange: 0.45,
    investmentDay: 2 // 周二
  },
  {
    id: '102',
    name: '大成新锐',
    code: '090018',
    tag: '进攻',
    shares: 8547,
    netValue: 1.17,
    estimatedChange: -0.32
  }
];

export const mockFixedIncome: FixedIncomeAsset[] = [
  {
    id: '201',
    name: '银行大额存单 (招商银行)',
    principal: 700000,
    apy: 2.5,
    startDate: '2023-12-01'
  },
  {
    id: '202',
    name: '稳健理财2号',
    principal: 50000,
    apy: 2.85,
    startDate: '2024-01-15'
  }
];

// 生成过去30天的模拟资产走势
export const generateHistory = (): DailySnapshot[] => {
  const history: DailySnapshot[] = [];
  const now = new Date();
  let baseValue = 810000;
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    baseValue += (Math.random() - 0.45) * 5000; // 略微上升趋势
    history.push({
      date: date.toISOString().split('T')[0],
      totalValue: Math.round(baseValue)
    });
  }
  return history;
};
