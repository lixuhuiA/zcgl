import React, { useMemo, useEffect, useState } from 'react';
import { 
  Calendar, PieChart, Activity, Zap, BarChart3 
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { StockAsset, FundAsset, FixedAsset } from '../types';
import AssetCards from './AssetCards'; // 👈 必须引用刚才那个文件

interface DashboardProps {
  customStocks: StockAsset[];
  customFunds: FundAsset[];
  fixedIncome: FixedAsset[];
}

interface HistoryItem {
  date: string;
  total: number;
  profit: number;
}

const Dashboard: React.FC<DashboardProps> = ({ customStocks, customFunds, fixedIncome }) => {
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);

  // 1. 获取历史趋势数据
  useEffect(() => {
    const token = localStorage.getItem('pacc_token');
    if (!token) return;
    fetch('/api/history', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setHistoryData(data))
      .catch(e => console.error("获取历史数据失败:", e));
  }, []);

  // 2. 实时计算三大类资产的状态
  const stockStats = useMemo(() => {
    const marketVal = customStocks.reduce((acc, s) => acc + (s.currentPrice || 0) * (s.quantity || 0), 0);
    const profit = customStocks.reduce((acc, s) => acc + ((s.currentPrice || 0) * (s.quantity || 0) * ((s.changePercent || 0)/100)), 0);
    const winCount = customStocks.filter(s => (s.changePercent || 0) > 0).length;
    return { marketVal, profit, winCount, totalCount: customStocks.length };
  }, [customStocks]);

  const fundStats = useMemo(() => {
    const marketVal = customFunds.reduce((acc, f) => acc + (f.netValue || 0) * (f.shares || 0), 0);
    const profit = customFunds.reduce((acc, f) => acc + ((f.netValue || 0) * (f.shares || 0) * ((f.estimatedChange || 0)/100)), 0);
    const winCount = customFunds.filter(f => (f.estimatedChange || 0) > 0).length;
    return { marketVal, profit, winCount, totalCount: customFunds.length };
  }, [customFunds]);

  const fixedStats = useMemo(() => {
     const totalPrincipal = fixedIncome.reduce((acc, i) => acc + (i.quantity || 0), 0);
     const dailyIncome = fixedIncome.reduce((acc, i) => acc + ((i.quantity || 0) * ((i.apy || 0) / 100) / 365), 0);
     return { totalPrincipal, dailyIncome };
  }, [fixedIncome]);

  const totalAssets = stockStats.marketVal + fundStats.marketVal + fixedStats.totalPrincipal;
  const totalDayProfit = stockStats.profit + fundStats.profit + fixedStats.dailyIncome;
  const dayReturnRate = totalAssets > 0 ? (totalDayProfit / totalAssets) * 100 : 0;

  const getMarketComment = () => {
    if (dayReturnRate >= 1.5) return "满仓吃肉行情，起飞！🚀";
    if (dayReturnRate > 0) return "小赚一笔，稳扎稳打。📈";
    if (dayReturnRate === 0) return "波动微小，平稳运行。🧘";
    if (dayReturnRate > -1.5) return "账户略微缩水，冷静观察。📉";
    return "关灯吃面，注意仓位风险！🍜";
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-10">
      
      {/* 🔴 第一行：核心总览 (左：总资产，右：资产占比条) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左：总资产卡片 */}
        <div className="lg:col-span-1 bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[220px]">
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[100px] -mr-32 -mt-32"></div>
           <div>
             <div className="flex items-center justify-between mb-4">
               <div className="text-slate-400 text-xs font-black uppercase tracking-widest">实时总资产净值</div>
               <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black text-indigo-300 border border-white/5">实时行情</div>
             </div>
             <div className="text-4xl md:text-5xl font-mono font-black tracking-tighter">
               ¥{totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}
             </div>
           </div>
           <div className="pt-6 border-t border-white/10 flex justify-between items-end z-10">
             <div>
               <div className="text-slate-500 text-[10px] font-black uppercase mb-1">今日预计盈亏</div>
               <div className={`text-2xl md:text-3xl font-mono font-black ${totalDayProfit >= 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                 {totalDayProfit >= 0 ? '+' : ''}{totalDayProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
               </div>
               <div className="text-[10px] font-bold text-slate-400 mt-1">收益率: {dayReturnRate.toFixed(2)}%</div>
             </div>
           </div>
        </div>

        {/* 右：资产占比 (从底部提上来的) */}
        <div className="lg:col-span-2 bg-white px-8 py-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-center">
            <div className="flex items-center justify-between mb-6">
                 <div className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center">
                    <PieChart size={20} className="mr-3 text-indigo-600"/> 资产配置占比
                 </div>
                 <div className="text-xs text-slate-400 font-bold">Total Allocation</div>
            </div>
             <div className="w-full relative h-8 bg-slate-100 rounded-full ring-4 ring-slate-50 overflow-hidden flex shadow-inner mb-6">
                <div className="h-full bg-indigo-600 transition-all duration-1000 shadow-lg relative z-10" style={{width: `${totalAssets > 0 ? (stockStats.marketVal/totalAssets)*100 : 0}%`}}></div>
                <div className="h-full bg-purple-500 transition-all duration-1000 shadow-lg relative z-20" style={{width: `${totalAssets > 0 ? (fundStats.marketVal/totalAssets)*100 : 0}%`}}></div>
                <div className="h-full bg-emerald-500 transition-all duration-1000 shadow-lg relative z-30" style={{width: `${totalAssets > 0 ? (fixedStats.totalPrincipal/totalAssets)*100 : 0}%`}}></div>
             </div>
             <div className="grid grid-cols-3 gap-4">
                <div className="bg-indigo-50 rounded-2xl p-3 text-center border border-indigo-100">
                    <div className="text-[10px] text-indigo-400 font-black uppercase">股票资产</div>
                    <div className="text-lg font-black text-indigo-700">{totalAssets > 0 ? ((stockStats.marketVal/totalAssets)*100).toFixed(1) : 0}%</div>
                </div>
                <div className="bg-purple-50 rounded-2xl p-3 text-center border border-purple-100">
                    <div className="text-[10px] text-purple-400 font-black uppercase">基金资产</div>
                    <div className="text-lg font-black text-purple-700">{totalAssets > 0 ? ((fundStats.marketVal/totalAssets)*100).toFixed(1) : 0}%</div>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-3 text-center border border-emerald-100">
                    <div className="text-[10px] text-emerald-400 font-black uppercase">固收理财</div>
                    <div className="text-lg font-black text-emerald-700">{totalAssets > 0 ? ((fixedStats.totalPrincipal/totalAssets)*100).toFixed(1) : 0}%</div>
                </div>
             </div>
        </div>
      </div>

      {/* 🔴 第二行：持仓明细 (调用拆分出去的组件，这就是变短的原因！) */}
      <div>
         <AssetCards stocks={customStocks} funds={customFunds} fixedIncome={fixedIncome} />
      </div>

      {/* 🔴 第三行：净值走势图 */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200">
           <div className="flex items-center justify-between mb-4">
             <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><BarChart3 size={20}/></div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg tracking-tight">净值走势</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Net Worth Trend</p>
                </div>
             </div>
           </div>
           <div className="w-full h-[250px]">
             {historyData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={historyData}>
                   <defs>
                     <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                       <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="date" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} minTickGap={30}/>
                   <YAxis hide domain={['auto', 'auto']} />
                   <Tooltip formatter={(val: any) => [`¥${val.toLocaleString()}`, '总资产']} contentStyle={{borderRadius: '12px'}}/>
                   <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" animationDuration={1500}/>
                 </AreaChart>
               </ResponsiveContainer>
             ) : (
               <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
                 等待积累更多历史数据...
               </div>
             )}
           </div>
      </div>

      {/* 🔴 第四行：热力图 + 情绪分析 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-rose-50 rounded-xl text-rose-500"><Calendar size={20}/></div>
                    <div className="font-black text-slate-900 text-lg">盈亏热力</div>
                 </div>
            </div>
            <div className="w-full overflow-x-auto custom-scrollbar pb-2">
                 {(!historyData || historyData.length === 0) ? (
                    <div className="w-full h-24 flex items-center justify-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">每日 15:05 更新</div>
                 ) : (
                    <div className="flex gap-2.5">
                       {historyData.slice(-14).map((day, idx) => (
                          <div key={idx} className="group relative flex-shrink-0 text-center">
                              <div className={`w-12 h-16 rounded-xl ${day.profit > 0 ? 'bg-rose-400' : 'bg-emerald-400'} flex items-center justify-center text-white text-[10px] font-bold shadow-sm`}>{day.date}</div>
                              <div className="mt-2 text-[10px] font-bold text-slate-400">{day.profit > 0 ? '+' : ''}{day.profit.toFixed(0)}</div>
                          </div>
                       ))}
                    </div>
                 )}
            </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-purple-700 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-200 flex flex-col justify-center relative overflow-hidden">
             <Zap size={120} className="absolute -bottom-4 -right-4 text-white/10 rotate-12" />
             <div className="relative z-10">
                <div className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">AI 市场情绪</div>
                <div className="text-2xl font-black leading-tight mb-4">{getMarketComment()}</div>
                <div className="flex items-center space-x-4 text-xs font-bold opacity-80">
                   <div>📈 {stockStats.winCount + fundStats.winCount} 上涨</div>
                   <div>📉 {(stockStats.totalCount + fundStats.totalCount) - (stockStats.winCount + fundStats.winCount)} 下跌</div>
                </div>
             </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;