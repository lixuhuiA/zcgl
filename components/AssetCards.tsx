import React from 'react';
import { ArrowUpRight, ArrowDownRight, Briefcase, PieChart, Wallet } from 'lucide-react';
import { StockAsset, FundAsset, FixedIncomeAsset } from '../types';

interface AssetCardsProps {
  stocks: StockAsset[];
  funds: FundAsset[];
  fixedIncome: FixedIncomeAsset[];
}

const AssetCards: React.FC<AssetCardsProps> = ({ stocks = [], funds = [], fixedIncome = [] }) => {
  
  // 1. 股票卡片渲染
  const renderStocks = () => {
    if (!stocks || stocks.length === 0) return <div className="text-slate-400 text-xs p-4 text-center">暂无股票持仓</div>;
    return stocks.map(s => {
      // 安全计算，防止 undefined
      const price = s.currentPrice || 0;
      const qty = s.quantity || 0;
      const cost = s.costPrice || 0;
      const mv = price * qty;
      const profit = mv - (cost * qty);
      const isUp = profit >= 0;

      return (
        <div key={s.id || s.code} className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 px-2 rounded-lg transition-colors">
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${isUp ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {isUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            </div>
            <div>
              <div className="font-bold text-slate-700 text-sm">{s.name}</div>
              <div className="text-[10px] text-slate-400 font-mono">{s.code}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-slate-900 font-mono text-sm">¥{mv.toLocaleString()}</div>
            <div className={`text-[10px] font-bold ${isUp ? 'text-rose-500' : 'text-emerald-500'}`}>
              {isUp ? '+' : ''}{profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      );
    });
  };

  // 2. 基金卡片渲染
  const renderFunds = () => {
    if (!funds || funds.length === 0) return <div className="text-slate-400 text-xs p-4 text-center">暂无基金持仓</div>;
    return funds.map(f => {
      const nav = f.netValue || 0;
      const shares = f.shares || 0;
      const mv = nav * shares;
      const change = f.estimatedChange || 0;
      const isUp = change >= 0;

      return (
        <div key={f.id || f.code} className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 px-2 rounded-lg transition-colors">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mr-3">
              <PieChart size={16} />
            </div>
            <div>
              <div className="font-bold text-slate-700 text-sm">{f.name}</div>
              <div className="text-[10px] text-slate-400 font-mono">{f.code}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-slate-900 font-mono text-sm">¥{mv.toLocaleString()}</div>
            <div className={`text-[10px] font-bold ${isUp ? 'text-rose-500' : 'text-emerald-500'}`}>
              {change > 0 ? '+' : ''}{change}%
            </div>
          </div>
        </div>
      );
    });
  };

  // 3. 理财卡片渲染
  const renderFixed = () => {
    if (!fixedIncome || fixedIncome.length === 0) return <div className="text-slate-400 text-xs p-4 text-center">暂无理财持仓</div>;
    return fixedIncome.map(i => (
      <div key={i.id} className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 px-2 rounded-lg transition-colors">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mr-3">
            <Wallet size={16} />
          </div>
          <div>
            <div className="font-bold text-slate-700 text-sm">{i.name}</div>
            <div className="text-[10px] text-slate-400 font-mono">{i.apy}% APY</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold text-slate-900 font-mono text-sm">¥{i.principal.toLocaleString()}</div>
          <div className="text-[10px] text-emerald-500 font-bold">
            自动生息中
          </div>
        </div>
      </div>
    ));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* 股票板块 */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-2 mb-4 pb-2 border-b border-slate-100">
          <Briefcase size={16} className="text-indigo-600" />
          <h3 className="font-bold text-slate-700 text-sm">持仓股票</h3>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
          {renderStocks()}
        </div>
      </div>

      {/* 基金板块 */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-2 mb-4 pb-2 border-b border-slate-100">
          <PieChart size={16} className="text-purple-600" />
          <h3 className="font-bold text-slate-700 text-sm">持仓基金</h3>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
          {renderFunds()}
        </div>
      </div>

      {/* 理财板块 */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-2 mb-4 pb-2 border-b border-slate-100">
          <Wallet size={16} className="text-emerald-600" />
          <h3 className="font-bold text-slate-700 text-sm">稳健理财</h3>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
          {renderFixed()}
        </div>
      </div>
    </div>
  );
};

export default AssetCards;