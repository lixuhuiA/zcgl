import React from 'react';
import { TrendingUp, PieChart, ShieldCheck, ArrowUpRight, ArrowDownRight, Activity, Wallet, Layers } from 'lucide-react';

interface AssetCardsProps {
  stocks: any[];
  funds: any[];
  fixedIncome: any[];
}

// 辅助工具：转数字
const safeNum = (val: any) => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

// 辅助工具：计算天数
const getDaysDiff = (startStr?: string) => {
  if (!startStr) return 1;
  const start = new Date(startStr);
  const now = new Date();
  start.setHours(0,0,0,0);
  now.setHours(0,0,0,0);
  const diff = now.getTime() - start.getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
};

const AssetCards: React.FC<AssetCardsProps> = ({ stocks, funds, fixedIncome }) => {
  
  // ==================================================================================
  // 1. 股票计算 (核心修复：强制使用反推公式)
  // ==================================================================================
  const stockMarketValue = stocks.reduce((acc, s) => acc + (safeNum(s.currentPrice) * safeNum(s.quantity)), 0);
  const stockTotalCost = stocks.reduce((acc, s) => acc + (safeNum(s.costPrice) * safeNum(s.quantity)), 0);
  
  const stockDailyProfit = stocks.reduce((acc, s) => {
    const mv = safeNum(s.currentPrice) * safeNum(s.quantity);
    const change = safeNum(s.changePercent);
    // ⚠️ 关键点：这里必须用 (市值 * 涨幅 / (100+涨幅)) 
    // 之前就是因为这里用了简单乘法，所以和列表页的 +327.80 对不上
    if (Math.abs(100 + change) < 0.001) return acc;
    return acc + (mv * change) / (100 + change);
  }, 0);

  // ==================================================================================
  // 2. 基金计算
  // ==================================================================================
  const fundMarketValue = funds.reduce((acc, f) => acc + (safeNum(f.netValue) * safeNum(f.shares)), 0);
  const fundTotalCost = funds.reduce((acc, f) => acc + (safeNum(f.costPrice) * safeNum(f.shares)), 0);
  
  const fundDailyProfit = funds.reduce((acc, f) => {
    const mv = safeNum(f.netValue) * safeNum(f.shares);
    const change = safeNum(f.estimatedChange);
    return acc + (mv * change / 100);
  }, 0);

  // ==================================================================================
  // 3. 理财计算 (核心修复：自动推导 + 显示市值)
  // ==================================================================================
  const fixedData = fixedIncome.reduce((acc, i) => {
      const principal = safeNum(i.quantity); // 本金
      const currentVal = safeNum(i.costPrice) > 0 ? safeNum(i.costPrice) : principal; // 市值
      
      let apy = safeNum(i.apy);
      const days = getDaysDiff(i.startDate);
      const totalProfit = currentVal - principal;

      // ⚠️ 关键点：如果没填APY，自动根据 (市值-本金) 反推年化
      // 这样你的 +48.04 就能算出来了，不再是 0
      if (apy === 0 && totalProfit !== 0 && days > 0 && principal > 0) {
          apy = (totalProfit / principal / days) * 365 * 100;
      }
      
      const daily = (currentVal * (apy / 100)) / 365;

      return {
          mv: acc.mv + currentVal,
          principal: acc.principal + principal,
          daily: acc.daily + daily
      };
  }, { mv: 0, principal: 0, daily: 0 });


  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-700 delay-100">
      
      {/* --- 股票卡片 --- */}
      <div className="relative overflow-hidden bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-full blur-[80px] -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm ring-1 ring-indigo-100">
              <TrendingUp size={24} />
            </div>
            <div className="flex items-center space-x-1 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
               <span className="text-sm font-black text-slate-700">{stocks.length}</span>
               <span className="text-[10px] font-bold text-slate-400 uppercase">POSITIONS</span>
            </div>
          </div>
          <div>
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">股票持仓市值</h3>
            <div className="flex flex-col">
                <div className="flex items-baseline">
                    <span className="text-sm font-bold text-slate-400 mr-1">¥</span>
                    <span className="text-4xl font-black text-slate-900 tracking-tight">
                        {stockMarketValue.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </span>
                </div>
                {/* 字体加大加粗 */}
                <div className="flex items-center mt-2 space-x-1.5 bg-slate-50 w-fit px-2 py-1 rounded-lg">
                    <Layers size={14} className="text-slate-400"/>
                    <span className="text-sm font-bold text-slate-600">
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

      {/* --- 基金卡片 --- */}
      <div className="relative overflow-hidden bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-50 rounded-full blur-[80px] -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3.5 bg-purple-50 text-purple-600 rounded-2xl shadow-sm ring-1 ring-purple-100">
              <PieChart size={24} />
            </div>
            <div className="flex items-center space-x-1 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
               <span className="text-sm font-black text-slate-700">{funds.length}</span>
               <span className="text-[10px] font-bold text-slate-400 uppercase">FUNDS</span>
            </div>
          </div>
          <div>
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">基金持仓市值</h3>
            <div className="flex flex-col">
                <div className="flex items-baseline">
                    <span className="text-sm font-bold text-slate-400 mr-1">¥</span>
                    <span className="text-4xl font-black text-slate-900 tracking-tight">
                        {fundMarketValue.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </span>
                </div>
                {/* 字体加大加粗 */}
                <div className="flex items-center mt-2 space-x-1.5 bg-slate-50 w-fit px-2 py-1 rounded-lg">
                    <Layers size={14} className="text-slate-400"/>
                    <span className="text-sm font-bold text-slate-600">
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

      {/* --- 理财卡片 --- */}
      <div className="relative overflow-hidden bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full blur-[80px] -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl shadow-sm ring-1 ring-emerald-100">
              <ShieldCheck size={24} />
            </div>
            <div className="flex items-center space-x-1 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
               <span className="text-sm font-black text-slate-700">{fixedIncome.length}</span>
               <span className="text-[10px] font-bold text-slate-400 uppercase">ITEMS</span>
            </div>
          </div>
          <div>
            {/* 改标题为固收持仓市值 */}
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">固收持仓市值</h3>
            <div className="flex flex-col">
                <div className="flex items-baseline">
                    <span className="text-sm font-bold text-slate-400 mr-1">¥</span>
                    {/* 改为显示市值 (之前是本金) */}
                    <span className="text-4xl font-black text-slate-900 tracking-tight">
                        {fixedData.mv.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </span>
                </div>
                {/* 字体加大，改为显示本金 */}
                <div className="flex items-center mt-2 space-x-1.5 bg-slate-50 w-fit px-2 py-1 rounded-lg">
                    <Wallet size={14} className="text-slate-400"/>
                    <span className="text-sm font-bold text-slate-600">
                        总本金: ¥{fixedData.principal.toLocaleString(undefined, {maximumFractionDigits: 0})}
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
                    {/* 这里应该能显示 +48.04 了 */}
                    +{fixedData.daily.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
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