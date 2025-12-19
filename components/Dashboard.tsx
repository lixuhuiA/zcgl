import React, { useMemo, useEffect, useState } from 'react';
import { Wallet, Calendar, PieChart, TrendingUp, ArrowUpRight, ArrowDownRight, Activity, Zap } from 'lucide-react';
import { StockAsset, FundAsset, FixedIncomeAsset } from '../types';
import AssetCards from './AssetCards';

interface DashboardProps {
  customStocks: StockAsset[];
  customFunds: FundAsset[];
  fixedIncome: FixedIncomeAsset[];
}

const Dashboard: React.FC<DashboardProps> = ({ customStocks, customFunds, fixedIncome }) => {
  const [historyData, setHistoryData] = useState<any[]>([]);

  // 1. 获取后端保存的历史快照
  useEffect(() => {
    fetch('/api/history', { headers: { 'Authorization': `Bearer ${localStorage.getItem('pacc_token')}` } })
      .then(res => res.json())
      .then(data => setHistoryData(data))
      .catch(e => console.error("获取历史数据失败:", e));
  }, []);

  // 2. 实时计算：股票/ETF 统计
  const stockStats = useMemo(() => {
    const marketVal = customStocks.reduce((acc, s) => acc + s.currentPrice * s.quantity, 0);
    const profit = customStocks.reduce((acc, s) => acc + (s.currentPrice * s.quantity * (s.changePercent/100)), 0);
    const winCount = customStocks.filter(s => s.changePercent > 0).length;
    return { marketVal, profit, winCount, totalCount: customStocks.length };
  }, [customStocks]);

  // 3. 实时计算：场外基金统计
  const fundStats = useMemo(() => {
    const marketVal = customFunds.reduce((acc, f) => acc + f.netValue * f.shares, 0);
    const profit = customFunds.reduce((acc, f) => acc + (f.netValue * f.shares * (f.estimatedChange/100)), 0);
    const winCount = customFunds.filter(f => f.estimatedChange > 0).length;
    return { marketVal, profit, winCount, totalCount: customFunds.length };
  }, [customFunds]);

  // 4. 实时计算：理财/固收统计
  const fixedStats = useMemo(() => {
     const totalPrincipal = fixedIncome.reduce((acc, i) => acc + i.principal, 0);
     const dailyIncome = fixedIncome.reduce((acc, i) => acc + (i.principal * (i.apy / 100) / 365), 0);
     return { totalPrincipal, dailyIncome };
  }, [fixedIncome]);

  // 5. 汇总数据
  const totalAssets = stockStats.marketVal + fundStats.marketVal + fixedStats.totalPrincipal;
  const totalDayProfit = stockStats.profit + fundStats.profit + fixedStats.dailyIncome;
  const dayReturnRate = totalAssets > 0 ? (totalDayProfit / totalAssets) * 100 : 0;

  // 6. 新增：阶段评价逻辑
  const getMarketComment = () => {
    if (dayReturnRate >= 1.5) return "满仓吃肉行情，起飞！🚀";
    if (dayReturnRate > 0) return "小赚一笔，稳扎稳打。📈";
    if (dayReturnRate === 0) return "波动微小，平稳运行。🧘";
    if (dayReturnRate > -1.5) return "账户略微缩水，冷静观察。📉";
    return "关灯吃面，注意仓位风险！🍜";
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 左侧：核心资产卡片 */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[240px]">
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[100px] -mr-32 -mt-32"></div>
           <div>
             <div className="flex items-center justify-between mb-4">
               <div className="text-slate-400 text-xs font-black uppercase tracking-widest">实时总资产净值</div>
               <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black text-indigo-300 border border-white/5">实时行情</div>
             </div>
             <div className="text-5xl font-mono font-black tracking-tighter">
               ¥{totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}
             </div>
           </div>
           
           <div className="pt-6 border-t border-white/10 flex justify-between items-end z-10">
             <div>
               <div className="text-slate-500 text-[10px] font-black uppercase mb-1">今日预计盈亏</div>
               <div className={`text-3xl font-mono font-black ${totalDayProfit >= 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                 {totalDayProfit >= 0 ? '+' : ''}{totalDayProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
               </div>
               <div className="text-[10px] font-bold text-slate-400 mt-1">收益率: {dayReturnRate.toFixed(2)}%</div>
             </div>
             <div className="text-right">
                <div className="text-[10px] text-slate-500 font-black uppercase mb-2">权益资产占比</div>
                <div className="text-sm font-black font-mono text-indigo-300 bg-indigo-500/10 px-3 py-1 rounded-lg border border-indigo-500/20">
                  {totalAssets > 0 ? (((stockStats.marketVal + fundStats.marketVal) / totalAssets) * 100).toFixed(1) : 0}%
                </div>
             </div>
           </div>
        </div>

        {/* 右侧：收益日历热力图 */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
             <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600"><Calendar size={20}/></div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg tracking-tight">资产收益日历</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Performance Heatmap</p>
                </div>
             </div>
             <div className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                <span>大亏</span>
                <div className="w-3 h-3 bg-emerald-600 rounded-sm"></div>
                <div className="w-3 h-3 bg-emerald-200 rounded-sm"></div>
                <div className="w-3 h-3 bg-slate-100 rounded-sm"></div>
                <div className="w-3 h-3 bg-rose-200 rounded-sm"></div>
                <div className="w-3 h-3 bg-rose-600 rounded-sm"></div>
                <span>大赚</span>
             </div>
          </div>
          
          <div className="w-full overflow-x-auto custom-scrollbar">
             {(!historyData || historyData.length === 0) ? (
                <div className="w-full h-24 flex items-center justify-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                   等待每日收盘数据自动生成...
                </div>
             ) : (
                <div className="flex gap-2.5 pb-2">
                   {historyData.slice(-30).map((day, idx) => {
                      let colorClass = 'bg-slate-100'; 
                      if (day.profit > 1000) colorClass = 'bg-rose-600 shadow-[0_0_15px_rgba(225,29,72,0.2)]';
                      else if (day.profit > 100) colorClass = 'bg-rose-300';
                      else if (day.profit > 0) colorClass = 'bg-rose-100';
                      else if (day.profit < -1000) colorClass = 'bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
                      else if (day.profit < -100) colorClass = 'bg-emerald-300';
                      else if (day.profit < 0) colorClass = 'bg-emerald-100';
                      
                      return (
                        <div key={idx} className="group relative">
                            <div className={`w-10 h-24 rounded-2xl ${colorClass} transition-all duration-300 hover:scale-105 hover:z-10 cursor-pointer`}></div>
                            <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-slate-900 text-white text-[10px] font-bold px-3 py-2.5 rounded-2xl shadow-2xl whitespace-nowrap z-50">
                              <div className="text-slate-400 mb-1 border-b border-white/10 pb-1">{day.date}</div>
                              <div className={day.profit >= 0 ? 'text-rose-400' : 'text-emerald-400'}>收益: ¥{day.profit.toLocaleString()}</div>
                            </div>
                        </div>
                      )
                   })}
                </div>
             )}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">
             <Activity size={12} className="mr-2 text-indigo-500" /> 近30个交易日历史回顾
          </div>
        </div>
      </div>

      {/* 中间栏：评价与详细分布 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 动态评价 */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-6 shadow-lg shadow-indigo-200 text-white flex items-center justify-between">
           <div className="flex items-center space-x-4">
             <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md"><Zap size={24} fill="currentColor"/></div>
             <div>
               <div className="text-[10px] font-black uppercase tracking-widest opacity-80">智能情绪分析</div>
               <div className="text-lg font-black">{getMarketComment()}</div>
             </div>
           </div>
           <div className="text-3xl font-black opacity-20 italic">MARKET</div>
        </div>

        {/* 盈利分布 */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 flex items-center justify-around shadow-sm">
           <div className="text-center">
              <div className="text-slate-400 text-[10px] font-black uppercase mb-1">今日领涨标的</div>
              <div className="text-2xl font-black text-rose-500">{stockStats.winCount + fundStats.winCount} <span className="text-xs text-slate-300">/ {stockStats.totalCount + fundStats.totalCount}</span></div>
           </div>
           <div className="w-px h-8 bg-slate-100"></div>
           <div className="text-center">
              <div className="text-slate-400 text-[10px] font-black uppercase mb-1">今日领跌标的</div>
              <div className="text-2xl font-black text-emerald-500">{(stockStats.totalCount + fundStats.totalCount) - (stockStats.winCount + fundStats.winCount)} <span className="text-xs text-slate-300">/ {stockStats.totalCount + fundStats.totalCount}</span></div>
           </div>
        </div>
      </div>

      {/* 底部：资产配置分布进度条 */}
      <div className="bg-white px-10 py-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center md:space-x-10 space-y-4 md:space-y-0">
         <div className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center shrink-0">
            <PieChart size={18} className="mr-3 text-indigo-600"/> 资产配置占比
         </div>
         <div className="flex-1 w-full relative h-6 bg-slate-100 rounded-full ring-8 ring-slate-50 overflow-hidden flex shadow-inner">
            <div className="h-full bg-indigo-600 transition-all duration-1000 shadow-lg relative z-10" style={{width: `${totalAssets > 0 ? (stockStats.marketVal/totalAssets)*100 : 0}%`}}></div>
            <div className="h-full bg-purple-500 transition-all duration-1000 shadow-lg relative z-20" style={{width: `${totalAssets > 0 ? (fundStats.marketVal/totalAssets)*100 : 0}%`}}></div>
            <div className="h-full bg-emerald-500 transition-all duration-1000 shadow-lg relative z-30" style={{width: `${totalAssets > 0 ? (fixedStats.totalPrincipal/totalAssets)*100 : 0}%`}}></div>
         </div>
         <div className="flex space-x-6 text-[11px] font-black text-slate-600 tracking-tight shrink-0">
            <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-indigo-600 mr-2 shadow-sm"></div> 股票 {totalAssets > 0 ? ((stockStats.marketVal/totalAssets)*100).toFixed(0) : 0}%</div>
            <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-purple-500 mr-2 shadow-sm"></div> 基金 {totalAssets > 0 ? ((fundStats.marketVal/totalAssets)*100).toFixed(0) : 0}%</div>
            <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-emerald-500 mr-2 shadow-sm"></div> 固收 {totalAssets > 0 ? ((fixedStats.totalPrincipal/totalAssets)*100).toFixed(0) : 0}%</div>
         </div>
      </div>

      {/* 原有持仓明细组件 */}
      <AssetCards stocks={customStocks} funds={customFunds} fixedIncome={fixedIncome} />
    </div>
  );
};

export default Dashboard;