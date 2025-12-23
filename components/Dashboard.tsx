import React, { useMemo, useEffect, useState } from 'react';
import { 
  PieChart, Activity, Zap, BarChart3, 
  Wallet, Calendar, Filter
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine 
} from 'recharts';
import { StockAsset, FundAsset, FixedIncomeAsset } from '../types';
import AssetCards from './AssetCards'; 

// ============================================================================
// 1. 类型定义
// ============================================================================
interface DashboardProps {
  customStocks: StockAsset[];
  customFunds: FundAsset[];
  fixedIncome: FixedIncomeAsset[];
}

interface HistoryItem {
  date: string;
  total_asset: number;
  total_profit: number;
  stock_profit?: number;
  fund_profit?: number;
  fixed_profit?: number;
}

type FilterType = 'ALL' | 'STOCK' | 'FUND' | 'FIXED';

// ============================================================================
// 2. 辅助工具函数 (强力数值转换)
// ============================================================================
const safeNum = (val: any) => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

// 计算两个日期的天数差 (复刻 FixedIncome 逻辑)
const getDaysDiff = (startStr?: string) => {
  if (!startStr) return 1;
  const start = new Date(startStr);
  const now = new Date();
  // 消除时分秒误差，确保天数计算准确
  start.setHours(0,0,0,0);
  now.setHours(0,0,0,0);
  const diff = now.getTime() - start.getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
};

const Dashboard: React.FC<DashboardProps> = ({ customStocks, customFunds, fixedIncome }) => {
  // ==========================================================================
  // 3. 状态管理
  // ==========================================================================
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);
  const [moversFilter, setMoversFilter] = useState<FilterType>('ALL');

  // ==========================================================================
  // 4. 获取历史数据
  // ==========================================================================
  useEffect(() => {
    const token = localStorage.getItem('pacc_token');
    if (!token) return;
    fetch('/api/history', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
          setHistoryData(data);
          // 默认选中最后一条
          if (data.length > 0) setSelectedHistory(data[data.length - 1]);
      })
      .catch(e => console.error("History fetch failed:", e));
  }, []);

  // ==========================================================================
  // 5. 核心计算逻辑 (1:1 还原 StockList / FundList / FixedIncome 算法)
  // ==========================================================================
  const stats = useMemo(() => {
    
    // --- A. 股票计算 (使用反推公式，对齐 StockList) ---
    // 列表页公式: profit = (mv * change) / (100 + change)
    let stockMv = 0, stockCost = 0, stockDayProfit = 0;
    
    const sortedStocks = [...customStocks].map(s => {
        const mv = safeNum(s.currentPrice) * safeNum(s.quantity);
        const cost = safeNum(s.costPrice) * safeNum(s.quantity);
        const change = safeNum(s.changePercent);
        
        let profit = 0;
        // 只有当 (100+change) != 0 时才计算，防止除零
        if (Math.abs(100 + change) > 0.001) {
             profit = (mv * change) / (100 + change);
        }
        
        stockMv += mv;
        stockCost += cost;
        stockDayProfit += profit;
        
        return { 
            ...s, 
            dailyProfit: profit, 
            mv, 
            type: 'STOCK' as const,
            displayRate: change
        };
    });

    // --- B. 基金计算 (对齐 FundList) ---
    // 列表页公式: profit = mv * (estimatedChange / 100)
    let fundMv = 0, fundCost = 0, fundDayProfit = 0;
    
    const sortedFunds = [...customFunds].map(f => {
        const mv = safeNum(f.netValue) * safeNum(f.shares);
        const cost = safeNum(f.costPrice) * safeNum(f.shares);
        const change = safeNum(f.estimatedChange);
        
        const profit = mv * (change / 100);

        fundMv += mv;
        fundCost += cost;
        fundDayProfit += profit;
        
        return { 
            ...f, 
            dailyProfit: profit, 
            mv, 
            type: 'FUND' as const,
            displayRate: change
        };
    });

    // --- C. 固收计算 (核心修复：自动推导逻辑) ---
    let fixedMv = 0, fixedPrincipal = 0, fixedDayProfit = 0;
    
    const sortedFixed = [...fixedIncome].map(i => {
        // App.tsx 里把 quantity 映射为了本金
        const principal = safeNum(i.quantity);
        // App.tsx 里把 costPrice 映射为了当前市值(用户录入)
        // 如果用户没填市值(0)，则默认市值=本金
        const currentVal = safeNum(i.costPrice) > 0 ? safeNum(i.costPrice) : principal;
        
        let apy = safeNum(i.apy);
        const days = getDaysDiff(i.startDate);
        const totalProfit = currentVal - principal;

        // 【关键逻辑】如果没有填 APY，自动根据总收益和天数推算一个
        if (apy === 0 && totalProfit !== 0 && days > 0 && principal > 0) {
             // APY = (总收益 / 本金 / 天数) * 365
             apy = (totalProfit / principal / days) * 365 * 100;
        }
        
        // 计算日收益
        // 公式: 市值 * (APY/100) / 365
        let dailyProfit = 0;
        if (apy !== 0) {
            dailyProfit = (currentVal * (apy / 100)) / 365;
        } else if (days > 0 && totalProfit !== 0) {
            // 兜底: 如果连本金都是0，就简单平均
            dailyProfit = totalProfit / days;
        }

        fixedMv += currentVal;
        fixedPrincipal += principal;
        fixedDayProfit += dailyProfit;
        
        return { 
            id: i.id,
            name: i.name,
            code: '理财',
            dailyProfit: dailyProfit, 
            mv: currentVal, 
            type: 'FIXED' as const,
            displayRate: apy // 这里展示年化
        };
    });

    const totalAssets = stockMv + fundMv + fixedMv;
    const totalPrincipal = stockCost + fundCost + fixedPrincipal;
    const totalDayProfit = stockDayProfit + fundDayProfit + fixedDayProfit;
    const totalCumulativeProfit = totalAssets - totalPrincipal;

    return {
        stock: { mv: stockMv, profit: stockDayProfit, items: sortedStocks },
        fund: { mv: fundMv, profit: fundDayProfit, items: sortedFunds },
        fixed: { mv: fixedMv, profit: fixedDayProfit, items: sortedFixed },
        total: { asset: totalAssets, dayProfit: totalDayProfit, cumulative: totalCumulativeProfit }
    };
  }, [customStocks, customFunds, fixedIncome]);

  // ==========================================================================
  // 6. 历史详情展示逻辑 (解决 0.00 问题)
  // ==========================================================================
  const displayDetails = useMemo(() => {
      if (!selectedHistory) return null;

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      
      const isToday = selectedHistory.date === todayStr;
      // 如果历史数据里全是 0 (旧数据)，强制显示实时数据
      const isZeroData = selectedHistory.total_profit === 0 && selectedHistory.stock_profit === 0;

      if (isToday || isZeroData) {
          return {
              stock: stats.stock.profit,
              fund: stats.fund.profit,
              fixed: stats.fixed.profit,
              total: stats.total.dayProfit
          };
      }

      return {
          stock: selectedHistory.stock_profit || 0,
          fund: selectedHistory.fund_profit || 0,
          fixed: selectedHistory.fixed_profit || 0,
          total: selectedHistory.total_profit
      };
  }, [selectedHistory, stats]);

  // ==========================================================================
  // 7. 异动榜过滤逻辑 (修复排序：按赚多少钱降序)
  // ==========================================================================
  const filteredMovers = useMemo(() => {
      let allItems = [...stats.stock.items, ...stats.fund.items, ...stats.fixed.items];
      
      if (moversFilter === 'STOCK') allItems = stats.stock.items;
      if (moversFilter === 'FUND') allItems = stats.fund.items;
      if (moversFilter === 'FIXED') allItems = stats.fixed.items;

      // 过滤掉几乎无波动的，并按【盈利金额】从大到小排序
      // 这样赚钱的在上面，亏钱的在下面，符合直觉
      return allItems
          .filter(i => Math.abs(i.dailyProfit) > 0.01)
          .sort((a, b) => b.dailyProfit - a.dailyProfit) 
          .slice(0, 6);
  }, [stats, moversFilter]);

  // ==========================================================================
  // 8. 图表数据
  // ==========================================================================
  const chartData = useMemo(() => {
      const recent = historyData.slice(-14);
      if (recent.length === 0) {
          return [{
              date: '实时',
              stock_profit: stats.stock.profit,
              fund_profit: stats.fund.profit,
              fixed_profit: stats.fixed.profit,
              total_profit: stats.total.dayProfit
          }];
      }
      return recent.map(item => ({
          ...item,
          stock_profit: item.stock_profit || 0,
          fund_profit: item.fund_profit || 0,
          fixed_profit: item.fixed_profit || 0
      }));
  }, [historyData, stats]);


  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-10">
      
      {/* 1. 顶部总览 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左：总资产黑卡 */}
        <div className="lg:col-span-1 bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[240px]">
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[100px] -mr-32 -mt-32"></div>
           <div>
             <div className="flex items-center justify-between mb-2">
               <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                  <Wallet size={12}/> 实时总资产净值
               </div>
               <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${stats.total.cumulative >= 0 ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}`}>
                  {stats.total.cumulative >= 0 ? '盈利中' : '亏损中'}
               </div>
             </div>
             <div className="text-4xl md:text-5xl font-mono font-black tracking-tighter">
               ¥{stats.total.asset.toLocaleString(undefined, { maximumFractionDigits: 0 })}
             </div>
           </div>

           <div className="grid grid-cols-2 gap-4 mt-6 border-t border-white/10 pt-6 relative z-10">
             <div>
               <div className="text-slate-500 text-[10px] font-black uppercase mb-1">今日总盈亏</div>
               <div className={`text-2xl font-mono font-black ${stats.total.dayProfit >= 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                 {stats.total.dayProfit >= 0 ? '+' : ''}{stats.total.dayProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
               </div>
             </div>
             <div>
               <div className="text-slate-500 text-[10px] font-black uppercase mb-1">含固收预估</div>
               <div className="text-sm font-bold text-slate-300 flex items-center h-full pb-1">
                 <Zap size={14} className="text-yellow-400 mr-1 fill-current"/> 
                 +{stats.fixed.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                 <span className="text-[10px] opacity-50 ml-1">/日</span>
               </div>
             </div>
           </div>
        </div>

        {/* 右：资产占比 */}
        <div className="lg:col-span-2 bg-white px-8 py-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-center">
            <div className="flex items-center justify-between mb-6">
                 <div className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center">
                    <PieChart size={20} className="mr-3 text-indigo-600"/> 资产配置占比
                 </div>
                 <div className="text-xs text-slate-400 font-bold">Total Allocation</div>
            </div>
             <div className="w-full relative h-8 bg-slate-100 rounded-full ring-4 ring-slate-50 overflow-hidden flex shadow-inner mb-6">
                <div className="h-full bg-indigo-600 shadow-lg relative z-10 transition-all duration-1000" style={{width: `${stats.total.asset > 0 ? (stats.stock.mv/stats.total.asset)*100 : 0}%`}}></div>
                <div className="h-full bg-purple-500 shadow-lg relative z-20 transition-all duration-1000" style={{width: `${stats.total.asset > 0 ? (stats.fund.mv/stats.total.asset)*100 : 0}%`}}></div>
                <div className="h-full bg-emerald-500 shadow-lg relative z-30 transition-all duration-1000" style={{width: `${stats.total.asset > 0 ? (stats.fixed.mv/stats.total.asset)*100 : 0}%`}}></div>
             </div>
             <div className="grid grid-cols-3 gap-4">
                <div className="bg-indigo-50 rounded-2xl p-3 text-center border border-indigo-100">
                    <div className="text-[10px] text-indigo-400 font-black uppercase">股票资产</div>
                    <div className="text-lg font-black text-indigo-700">{stats.total.asset > 0 ? ((stats.stock.mv/stats.total.asset)*100).toFixed(1) : 0}%</div>
                </div>
                <div className="bg-purple-50 rounded-2xl p-3 text-center border border-purple-100">
                    <div className="text-[10px] text-purple-400 font-black uppercase">基金资产</div>
                    <div className="text-lg font-black text-purple-700">{stats.total.asset > 0 ? ((stats.fund.mv/stats.total.asset)*100).toFixed(1) : 0}%</div>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-3 text-center border border-emerald-100">
                    <div className="text-[10px] text-emerald-400 font-black uppercase">理财固收</div>
                    <div className="text-lg font-black text-emerald-700">{stats.total.asset > 0 ? ((stats.fixed.mv/stats.total.asset)*100).toFixed(1) : 0}%</div>
                </div>
             </div>
        </div>
      </div>

      {/* 2. 持仓卡片 */}
      <div>
         <AssetCards stocks={customStocks} funds={customFunds} fixedIncome={fixedIncome} />
      </div>

      {/* 3. 盈亏贡献图 */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
           <div className="flex items-center justify-between mb-6">
             <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600"><BarChart3 size={20}/></div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg tracking-tight">每日盈亏构成</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Daily Profit Contribution</p>
                </div>
             </div>
             <div className="flex gap-4 text-[10px] font-bold">
                <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 mr-1.5"></span>股票</span>
                <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-sm bg-purple-500 mr-1.5"></span>基金</span>
                <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 mr-1.5"></span>理财</span>
             </div>
           </div>
           
           <div className="w-full h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={chartData} barSize={24}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="date" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} dy={10} />
                 <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                 <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {stock_profit: '股票', fund_profit: '基金', fixed_profit: '理财', total_profit: '总计'};
                        return [`¥${value.toFixed(2)}`, labels[name] || name];
                    }}
                 />
                 <ReferenceLine y={0} stroke="#cbd5e1" />
                 <Bar dataKey="stock_profit" stackId="a" fill="#6366f1" radius={[2, 2, 2, 2]} />
                 <Bar dataKey="fund_profit" stackId="a" fill="#a855f7" radius={[2, 2, 2, 2]} />
                 <Bar dataKey="fixed_profit" stackId="a" fill="#10b981" radius={[2, 2, 2, 2]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
      </div>

      {/* 4. 底部双雄 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 左侧：历史详情 */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row min-h-[350px]">
            <div className="p-8 flex-1 border-b md:border-b-0 md:border-r border-slate-100">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="p-2.5 bg-rose-50 rounded-xl text-rose-500"><Calendar size={20}/></div>
                    <div className="font-black text-slate-900 text-lg">历史盈亏快照</div>
                </div>
                <div className="flex gap-2 flex-wrap content-start">
                    {historyData.slice(-14).map((day, idx) => (
                        <button 
                            key={idx} 
                            onClick={() => setSelectedHistory(day)}
                            className={`w-12 h-14 rounded-xl flex flex-col items-center justify-center text-[9px] font-bold transition-all border-2 ${
                                selectedHistory?.date === day.date ? 'border-slate-900 scale-110 shadow-lg z-10' : 'border-transparent opacity-70 hover:opacity-100 bg-slate-100'
                            } ${
                                day.total_profit > 0 ? 'bg-rose-400 text-white' : (day.total_profit < 0 ? 'bg-emerald-400 text-white' : 'text-slate-400')
                            }`}
                        >
                            <span>{day.date.slice(5)}</span>
                            {Math.abs(day.total_profit) > 1 && <span className="mt-1">{day.total_profit > 0 ? '+' : ''}{Math.round(day.total_profit)}</span>}
                        </button>
                    ))}
                    {historyData.length === 0 && <div className="text-slate-400 text-xs py-4">暂无历史数据，今日15:05更新</div>}
                </div>
            </div>
            
            <div className="p-8 w-full md:w-72 bg-slate-50/50 flex flex-col justify-center relative">
                {selectedHistory ? (
                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                        <div>
                            <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{selectedHistory.date} 账单</div>
                            <div className={`text-4xl font-black tracking-tight ${displayDetails && displayDetails.total >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {displayDetails && displayDetails.total >= 0 ? '+' : ''}
                                {displayDetails ? displayDetails.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                            </div>
                        </div>
                        <div className="h-px bg-slate-200 w-full"></div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                                <span className="text-xs font-bold text-slate-500 flex items-center"><span className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></span>股票盈亏</span>
                                <span className={`text-sm font-black ${displayDetails?.stock && displayDetails.stock >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {displayDetails ? displayDetails.stock.toFixed(2) : '--'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                                <span className="text-xs font-bold text-slate-500 flex items-center"><span className="w-2 h-2 rounded-full bg-purple-500 mr-2"></span>基金盈亏</span>
                                <span className={`text-sm font-black ${displayDetails?.fund && displayDetails.fund >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {displayDetails ? displayDetails.fund.toFixed(2) : '--'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                                <span className="text-xs font-bold text-slate-500 flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>理财收益</span>
                                <span className="text-sm font-black text-emerald-600">
                                    {displayDetails ? `+${displayDetails.fixed.toFixed(2)}` : '--'}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-bold">
                        👈 点击左侧日期查看分账详情
                    </div>
                )}
            </div>
        </div>

        {/* 右侧：今日异动榜 (已修复排序) */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200 flex flex-col relative overflow-hidden h-[350px] lg:h-auto">
             <div className="flex items-center justify-between mb-4 z-10">
                 <div className="font-black text-slate-900 text-lg flex items-center">
                    <Activity size={20} className="mr-2 text-indigo-500"/> 今日异动
                 </div>
                 <div className="flex gap-1">
                    {['ALL', 'STOCK', 'FUND', 'FIXED'].map(type => (
                        <button 
                            key={type}
                            onClick={() => setMoversFilter(type as FilterType)}
                            className={`text-[9px] font-bold px-2 py-1 rounded transition-colors ${
                                moversFilter === type 
                                ? 'bg-slate-900 text-white' 
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                        >
                            {type === 'ALL' ? '全' : type === 'STOCK' ? '股' : type === 'FUND' ? '基' : '财'}
                        </button>
                    ))}
                 </div>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-3 z-10 custom-scrollbar pr-1 -mr-2">
                {filteredMovers.map((item, idx) => (
                       <div key={`${item.type}-${item.id || idx}`} className="flex justify-between items-center group hover:bg-slate-50 p-2 rounded-xl transition-colors">
                          <div className="flex items-center space-x-3">
                             <div className={`w-1 h-8 rounded-full ${
                                 item.type === 'FIXED' ? 'bg-amber-400' :
                                 (item.dailyProfit >= 0 ? 'bg-rose-400' : 'bg-emerald-400')
                             }`}></div>
                             <div>
                                <div className="text-xs font-bold text-slate-700 w-24 truncate">{item.name}</div>
                                <div className="text-[9px] text-slate-400 font-bold flex items-center">
                                    {item.code || '理财'}
                                    <span className={`ml-1 opacity-50 scale-75 border px-1 rounded ${
                                        item.type === 'STOCK' ? 'border-indigo-200 text-indigo-500' :
                                        item.type === 'FUND' ? 'border-purple-200 text-purple-500' :
                                        'border-emerald-200 text-emerald-500'
                                    }`}>
                                        {item.type === 'STOCK' ? '股' : item.type === 'FUND' ? '基' : '财'}
                                    </span>
                                </div>
                             </div>
                          </div>
                          <div className="text-right">
                             <div className={`text-sm font-black ${
                                 item.type === 'FIXED' ? 'text-amber-500' :
                                 (item.dailyProfit >= 0 ? 'text-rose-500' : 'text-emerald-500')
                             }`}>
                                {item.dailyProfit >= 0 ? '+' : ''}{item.dailyProfit.toFixed(2)}
                             </div>
                             <div className={`text-[9px] font-bold ${
                                 item.type === 'FIXED' ? 'text-amber-300' :
                                 (item.dailyProfit >= 0 ? 'text-rose-300' : 'text-emerald-300')
                             }`}>
                                {item.type === 'FIXED' 
                                    ? `APY ${item.displayRate.toFixed(2)}%` 
                                    : `${(item.displayRate || 0).toFixed(2)}%`
                                }
                             </div>
                          </div>
                       </div>
                   ))
                }
                {filteredMovers.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs gap-2">
                        <Filter size={24} className="opacity-20"/>
                        该分类下暂无异动
                    </div>
                )}
             </div>
             <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-indigo-50 rounded-full blur-2xl z-0 pointer-events-none"></div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;