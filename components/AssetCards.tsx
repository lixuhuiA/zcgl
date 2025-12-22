import React from 'react';
import { TrendingUp, PieChart, ShieldCheck, ArrowUpRight, ArrowDownRight, Activity, Wallet, Layers } from 'lucide-react';

interface AssetCardsProps {
  stocks: any[];
  funds: any[];
  fixedIncome: any[];
}

const AssetCards: React.FC<AssetCardsProps> = ({ stocks, funds, fixedIncome }) => {
  
  // ==================================================================================
  // 1. 股票资产计算
  // ==================================================================================
  // 市值：用【现价】算。如果后端没传现价(0)，那就显示0。
  const stockMarketValue = stocks.reduce((acc, s) => {
    return acc + (Number(s.currentPrice || 0) * (s.quantity || 0));
  }, 0);

  // 成本：用【成本价】算。这里专门读 costPrice，满足你查看总成本的需求。
  const stockTotalCost = stocks.reduce((acc, s) => {
    return acc + (Number(s.costPrice || 0) * (s.quantity || 0));
  }, 0);

  // 今日盈亏：市值 * 涨跌幅%
  const stockDailyProfit = stocks.reduce((acc, s) => {
    const price = Number(s.currentPrice || 0);
    const quantity = Number(s.quantity || 0);
    const change = Number(s.changePercent || 0);
    return acc + (price * quantity * (change / 100));
  }, 0);

  // ==================================================================================
  // 2. 基金资产计算
  // ==================================================================================
  const fundMarketValue = funds.reduce((acc, f) => {
    return acc + (Number(f.netValue || 0) * (f.shares || 0));
  }, 0);

  const fundTotalCost = funds.reduce((acc, f) => {
    return acc + (Number(f.costPrice || 0) * (f.shares || 0));
  }, 0);

  const fundDailyProfit = funds.reduce((acc, f) => {
    const price = Number(f.netValue || 0);
    const quantity = Number(f.shares || 0);
    const change = Number(f.estimatedChange || 0);
    return acc + (price * quantity * (change / 100));
  }, 0);

  // ==================================================================================
  // 3. 固收资产计算
  // ==================================================================================
  // 固收市值 = 本金
  const fixedMarketValue = fixedIncome.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
  
  const fixedDailyProfit = fixedIncome.reduce((acc, i) => {
    const principal = Number(i.quantity) || 0;
    const apy = Number(i.apy) || 0;
    return acc + (principal * (apy / 100) / 365);
  }, 0);


  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-700 delay-100">
      
      {/* ==========================================================================
          卡片 1: 股票/ETF (Indigo Theme)
          ==========================================================================
      */}
      <div className="relative overflow-hidden bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        
        {/* 背景特效 */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-full blur-[80px] -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-50 rounded-full blur-[60px] -ml-10 -mb-10 opacity-0 group-hover:opacity-60 transition-opacity duration-500"></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm ring-1 ring-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
              <TrendingUp size={24} />
            </div>
            <div className="flex items-center space-x-1 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
               <span className="text-sm font-black text-slate-700">{stocks.length}</span>
               <span className="text-[10px] font-bold text-slate-400 uppercase">Positions</span>
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-2 mb-2">
                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest">股票持仓市值</h3>
            </div>
            
            {/* 核心数据展示 */}
            <div className="flex flex-col">
                <div className="flex items-baseline">
                    <span className="text-sm font-bold text-slate-400 mr-1">¥</span>
                    <span className="text-4xl font-black text-slate-900 tracking-tight">
                        {stockMarketValue.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </span>
                </div>
                {/* 这里！终于把成本价加上了！ */}
                <div className="flex items-center mt-1 space-x-1.5">
                    <Layers size={10} className="text-slate-300"/>
                    <span className="text-[10px] font-bold text-slate-400">
                        总成本: ¥{stockTotalCost.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </span>
                </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 flex items-center">
                <Activity size={12} className="mr-1.5 text-indigo-400"/>
                今日盈亏
            </span>
            <div className={`flex items-center space-x-1 ${stockDailyProfit >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                <span className="text-lg font-black">
                    {stockDailyProfit > 0 ? '+' : ''}{stockDailyProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </span>
                {stockDailyProfit >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================================================
          卡片 2: 场外基金 (Purple Theme)
          ==========================================================================
      */}
      <div className="relative overflow-hidden bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-50 rounded-full blur-[80px] -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-50 rounded-full blur-[60px] -ml-10 -mb-10 opacity-0 group-hover:opacity-60 transition-opacity duration-500"></div>

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3.5 bg-purple-50 text-purple-600 rounded-2xl shadow-sm ring-1 ring-purple-100 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
              <PieChart size={24} />
            </div>
            <div className="flex items-center space-x-1 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
               <span className="text-sm font-black text-slate-700">{funds.length}</span>
               <span className="text-[10px] font-bold text-slate-400 uppercase">Funds</span>
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-2 mb-2">
                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest">基金持仓市值</h3>
            </div>
            
            <div className="flex flex-col">
                <div className="flex items-baseline">
                    <span className="text-sm font-bold text-slate-400 mr-1">¥</span>
                    <span className="text-4xl font-black text-slate-900 tracking-tight">
                        {fundMarketValue.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </span>
                </div>
                <div className="flex items-center mt-1 space-x-1.5">
                    <Layers size={10} className="text-slate-300"/>
                    <span className="text-[10px] font-bold text-slate-400">
                        总成本: ¥{fundTotalCost.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </span>
                </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 flex items-center">
                <Activity size={12} className="mr-1.5 text-purple-400"/>
                今日盈亏 (估)
            </span>
            <div className={`flex items-center space-x-1 ${fundDailyProfit >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                <span className="text-lg font-black">
                    {fundDailyProfit > 0 ? '+' : ''}{fundDailyProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </span>
                {fundDailyProfit >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================================================
          卡片 3: 理财固收 (Emerald Theme)
          ==========================================================================
      */}
      <div className="relative overflow-hidden bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full blur-[80px] -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-50 rounded-full blur-[60px] -ml-10 -mb-10 opacity-0 group-hover:opacity-60 transition-opacity duration-500"></div>

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl shadow-sm ring-1 ring-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
              <ShieldCheck size={24} />
            </div>
            <div className="flex items-center space-x-1 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
               <span className="text-sm font-black text-slate-700">{fixedIncome.length}</span>
               <span className="text-[10px] font-bold text-slate-400 uppercase">Items</span>
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-2 mb-2">
                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest">固收本金总额</h3>
            </div>
            
            <div className="flex flex-col">
                <div className="flex items-baseline">
                    <span className="text-sm font-bold text-slate-400 mr-1">¥</span>
                    <span className="text-4xl font-black text-slate-900 tracking-tight">
                        {fixedMarketValue.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </span>
                </div>
                <div className="flex items-center mt-1 space-x-1.5">
                    <Wallet size={10} className="text-slate-300"/>
                    <span className="text-[10px] font-bold text-slate-400">
                        稳健生息资产
                    </span>
                </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 flex items-center">
                <Activity size={12} className="mr-1.5 text-emerald-400"/>
                预估日收益
            </span>
            <div className="flex items-center space-x-1 text-rose-500">
                <span className="text-lg font-black">
                    +{fixedDailyProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </span>
                <ArrowUpRight size={14}/>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default AssetCards;