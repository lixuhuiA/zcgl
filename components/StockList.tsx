import React, { useMemo, useState } from 'react';
import { 
  Plus, Trash2, Edit2, TrendingUp, Search, 
  ArrowUpDown, Layers, Activity, AlertCircle, RefreshCw,
  Wallet, ExternalLink, ArrowUpRight, ArrowDownRight, Clock
} from 'lucide-react';

interface StockListProps {
  stocks: any[];
  onDelete: (id: string) => void;
  onEdit: (asset: any) => void;
  onAdd: (asset: any) => void;
}

// 排序字段类型定义
type SortField = 'marketValue' | 'totalProfit' | 'dailyProfit' | 'name' | 'currentPrice' | 'quantity';
type SortDirection = 'asc' | 'desc';

const StockList: React.FC<StockListProps> = ({ stocks, onDelete, onEdit, onAdd }) => {
  // --- 状态管理 ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 排序状态 (默认按市值降序)
  const [sortField, setSortField] = useState<SortField>('marketValue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // 表单数据
  const [formData, setFormData] = useState({ 
    name: '', code: '', costPrice: '', quantity: '', tag: '稳健' 
  });
  
  // 自动检测 Loading 状态
  const [isChecking, setIsChecking] = useState(false);

  // --- 1. 核心逻辑：自动检测股票名称 ---
  const handleCodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData(prev => ({ ...prev, code: val }));

    if (!isEditing && val.length === 6 && /^\d+$/.test(val)) {
        setIsChecking(true);
        try {
            const res = await fetch(`/api/market/check?code=${val}&type=stock`);
            const data = await res.json();
            if (data.valid) {
                setFormData(prev => ({ 
                    ...prev, 
                    name: data.name,
                    // 自动填入当前价作为参考成本
                    costPrice: data.price ? String(data.price) : prev.costPrice
                }));
            }
        } catch (error) {
            console.error("Check failed", error);
        } finally {
            setIsChecking(false);
        }
    }
  };

  // --- 2. 核心逻辑：数据处理与排序 ---
  const processedStocks = useMemo(() => {
    let result = [...stocks];

    // 搜索
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(s => 
        (s.name && s.name.toLowerCase().includes(lower)) || 
        (s.code && s.code.includes(lower))
      );
    }

    // 排序
    result.sort((a, b) => {
      let valA = 0, valB = 0;
      // 优化：使用 parseFloat 确保高精度浮点运算，防止大数额时的精度丢失
      const pA = parseFloat(a.currentPrice || 0); const pB = parseFloat(b.currentPrice || 0);
      const cA = parseFloat(a.costPrice || 0);    const cB = parseFloat(b.costPrice || 0);
      const qA = parseFloat(a.quantity || 0);     const qB = parseFloat(b.quantity || 0);
      
      const mvA = pA * qA; const mvB = pB * qB;
      const chgA = parseFloat(a.changePercent || 0); const chgB = parseFloat(b.changePercent || 0);

      // ⚠️ 核心修复：排序用的日盈利金额，必须用反推公式，否则排序不准
      // 公式: MarketValue * Change% / (100 + Change%)
      const dailyA = (100 + chgA) !== 0 ? (mvA * chgA / (100 + chgA)) : 0;
      const dailyB = (100 + chgB) !== 0 ? (mvB * chgB / (100 + chgB)) : 0;

      switch (sortField) {
        case 'marketValue': valA = mvA; valB = mvB; break;
        case 'totalProfit': valA = (pA - cA) * qA; valB = (pB - cB) * qB; break;
        case 'dailyProfit': valA = dailyA; valB = dailyB; break;
        case 'currentPrice': valA = pA; valB = pB; break;
        case 'quantity': valA = qA; valB = qB; break;
        case 'name': return sortDirection === 'asc' ? a.name.localeCompare(b.name,'zh') : b.name.localeCompare(a.name,'zh');
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [stocks, searchTerm, sortField, sortDirection]);

  // --- 3. 核心逻辑：汇总计算 (修复日盈亏总和) ---
  const totals = useMemo(() => {
      // 优化：使用 parseFloat 确保计算总和时不忽略任何小数位
      const totalMarketValue = stocks.reduce((acc, s) => acc + (parseFloat(s.currentPrice)||0) * s.quantity, 0);
      const totalCost = stocks.reduce((acc, s) => acc + (parseFloat(s.costPrice)||0) * s.quantity, 0);
      const totalProfit = totalMarketValue - totalCost;
      const totalProfitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

      // ⚠️ 核心修复：当日总盈亏
      // 遍历所有持仓，用反推公式算出每只股票的当日盈亏，再求和
      const dailyTotalProfit = stocks.reduce((acc, s) => {
          const mv = (parseFloat(s.currentPrice)||0) * s.quantity;
          const change = parseFloat(s.changePercent || 0);
          
          if (change <= -99.9) return acc - mv; // 防止除零错误
          const profit = (mv * change) / (100 + change);
          
          return acc + profit;
      }, 0);

      return { totalMarketValue, totalCost, totalProfit, totalProfitRate, dailyTotalProfit };
  }, [stocks]);

  // --- 4. 辅助逻辑：A股市场时间判断 ---
  const marketInfo = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const day = now.getDay();
    const isWeekend = day === 0 || day === 6;
    
    const timeNum = hour * 100 + minute; 
    const timeStr = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;

    // A股交易时间段
    const isTrading = !isWeekend && (
        (timeNum >= 930 && timeNum <= 1130) || 
        (timeNum >= 1300 && timeNum < 1500)
    );
    const isLunchBreak = !isWeekend && (timeNum > 1130 && timeNum < 1300);
    const isPreMarket = !isWeekend && (timeNum >= 915 && timeNum < 930);

    if (isWeekend) return { label: '休市中', color: 'text-slate-400 bg-slate-100 border-slate-200', icon: Clock, spin: false };
    if (isTrading) return { label: `交易中 ${timeStr}`, color: 'text-indigo-500 bg-indigo-50 border-indigo-100', icon: RefreshCw, spin: true };
    if (isPreMarket) return { label: `盘前 ${timeStr}`, color: 'text-amber-500 bg-amber-50 border-amber-100', icon: Clock, spin: false };
    if (isLunchBreak) return { label: `午间休市`, color: 'text-slate-500 bg-slate-50 border-slate-200', icon: Clock, spin: false };
    
    return { label: `已收盘`, color: 'text-slate-500 bg-slate-50 border-slate-200', icon: Clock, spin: false };
  }, []);

  // --- 交互处理 ---
  const handleSort = (f: SortField) => {
    if (sortField === f) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDirection('desc'); }
  };

  const openAdd = () => {
    setIsEditing(false);
    setFormData({ name: '', code: '', costPrice: '', quantity: '', tag: '稳健' });
    setIsModalOpen(true);
  };

  const openEdit = (stock: any) => {
    setIsEditing(true);
    setFormData({
      name: stock.name,
      code: stock.code,
      costPrice: String(stock.costPrice || 0),
      quantity: String(stock.quantity || 0),
      tag: stock.tag || '稳健'
    });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.code) return alert("请完整填写名称和代码");
    const payload = {
      ...formData,
      asset_type: 'stock',
      costPrice: Number(formData.costPrice),
      quantity: Number(formData.quantity)
    };
    isEditing ? onEdit(payload) : onAdd(payload);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
      
      {/* ======================= 1. 顶部统计区 (4栏布局) ======================= */}
      <div className="flex flex-col lg:flex-row gap-4">
        
        {/* 1. 紫卡：总资产 + 成本 */}
        <div className="flex-[1.2] bg-purple-900 rounded-[2.5rem] p-6 text-white shadow-xl shadow-purple-900/20 relative overflow-hidden group">
           <div className="absolute right-0 top-0 w-32 h-32 bg-purple-800 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
           <div className="relative z-10 flex justify-between items-start h-full">
             <div>
               <p className="text-[10px] font-black uppercase opacity-60 mb-2 tracking-widest flex items-center">
                 <Wallet size={12} className="mr-1"/> 股票持仓总额
               </p>
               {/* 修正：总资产保留2位小数 */}
               <p className="text-3xl font-mono font-black tracking-tight">¥{totals.totalMarketValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
               
               {/* 总成本标签 */}
               <div className="mt-3 flex items-center space-x-2 bg-purple-800/50 w-fit px-3 py-1 rounded-lg backdrop-blur-md border border-purple-700/50">
                  <Layers size={10} className="text-purple-300"/>
                  {/* 修正：总成本保留2位小数 */}
                  <span className="text-[10px] text-purple-200 font-bold">成本: ¥{totals.totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}</span>
               </div>
             </div>
             <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm"><TrendingUp size={24} className="text-purple-200"/></div>
           </div>
        </div>

        {/* 2. 白卡：当日总盈亏 */}
        <div className={`flex-1 bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm flex justify-between items-center relative overflow-hidden group ${totals.dailyTotalProfit >= 0 ? 'hover:shadow-rose-100' : 'hover:shadow-emerald-100'} hover:shadow-lg transition-all`}>
           <div>
               <div className="flex items-center space-x-2 mb-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">当日总盈亏</p>
                  {/* 时间状态标签 */}
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center border ${marketInfo.color}`}>
                      {marketInfo.spin && <RefreshCw size={8} className="mr-1 animate-spin"/>}
                      {!marketInfo.spin && <marketInfo.icon size={8} className="mr-1"/>}
                      {marketInfo.label}
                  </span>
               </div>
               <div className={`text-3xl font-black ${totals.dailyTotalProfit >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {/* 修正：当日总盈亏保留2位小数 */}
                  {totals.dailyTotalProfit >= 0 ? '+' : ''}{totals.dailyTotalProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}
               </div>
           </div>
           <div className={`p-4 rounded-2xl ${totals.dailyTotalProfit >= 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
              <Activity size={24} />
           </div>
        </div>

        {/* 3. 白卡：累计总盈亏 */}
        <div className="flex-1 bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm flex justify-between items-center relative overflow-hidden">
           <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">累计总盈亏</p>
               <div className={`text-3xl font-black ${totals.totalProfit >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {/* 修正：累计总盈亏保留2位小数 */}
                  {totals.totalProfit >= 0 ? '+' : ''}{totals.totalProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}
                  <span className="text-sm ml-2 opacity-60 font-bold">({totals.totalProfitRate.toFixed(2)}%)</span>
               </div>
           </div>
           <div className={`p-4 rounded-2xl ${totals.totalProfit >= 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
              <TrendingUp size={24} />
           </div>
        </div>

        {/* 4. 黑按钮 */}
        <button onClick={openAdd} className="flex-none bg-slate-900 hover:bg-purple-600 text-white rounded-[2.5rem] px-8 flex flex-col items-center justify-center transition-all shadow-xl shadow-slate-900/10 active:scale-95 group min-w-[100px]">
            <div className="p-2.5 bg-white/10 rounded-full mb-1 group-hover:bg-white/20 transition-colors"><Plus size={20} /></div>
            <span className="text-[10px] font-black uppercase tracking-widest">添加</span>
        </button>
      </div>

      {/* ======================= 2. 列表区域 ======================= */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
        {/* 顶栏 */}
        <div className="flex flex-col md:flex-row justify-between items-center px-8 py-6 border-b border-slate-100 gap-4">
            <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center"><TrendingUp size={20}/></div>
                <div>
                    <h2 className="text-xl font-black text-slate-900">股票持仓</h2>
                    <p className="text-xs font-bold text-slate-400">{stocks.length} 个标的 · <span className="text-indigo-500">腾讯财经实时</span></p>
                </div>
            </div>
            <div className="relative group w-full md:w-auto">
                <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-purple-500 transition-colors" size={16} />
                <input type="text" placeholder="代码/名称..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-64 bg-slate-50 border border-slate-200 pl-9 pr-4 py-2 rounded-full font-bold text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all" />
            </div>
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-purple-600" onClick={() => handleSort('name')}>股票名称 <ArrowUpDown size={12} className="inline ml-1"/></th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:text-purple-600" onClick={() => handleSort('currentPrice')}>现价 / 成本 <ArrowUpDown size={12} className="inline ml-1"/></th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:text-purple-600" onClick={() => handleSort('dailyProfit')}>日涨跌 (额) <ArrowUpDown size={12} className="inline ml-1"/></th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:text-purple-600" onClick={() => handleSort('quantity')}>持仓量 <ArrowUpDown size={12} className="inline ml-1"/></th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:text-purple-600" onClick={() => handleSort('marketValue')}>市值 (占比) <ArrowUpDown size={12} className="inline ml-1"/></th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:text-purple-600" onClick={() => handleSort('totalProfit')}>累计盈亏 <ArrowUpDown size={12} className="inline ml-1"/></th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedStocks.map((s) => {
                // 优化：使用 parseFloat 解析，确保 0.001 级别的精度被保留
                const currentPrice = parseFloat(s.currentPrice || 0); 
                const costPrice = parseFloat(s.costPrice || 0);       
                const quantity = parseFloat(s.quantity || 0);
                
                const marketValue = currentPrice * quantity;
                const profit = marketValue - (costPrice * quantity);
                const profitRate = (costPrice * quantity) !== 0 ? (profit / (costPrice * quantity) * 100) : 0;
                
                const changePercent = parseFloat(s.changePercent || 0);
                
                // ⚠️ 核心修复：列表行内的日盈利计算，同样应用反推公式
                const dailyProfitAmount = (100 + changePercent) !== 0 
                    ? (marketValue * changePercent) / (100 + changePercent)
                    : 0;
                
                // 占比计算
                const positionRatio = totals.totalMarketValue > 0 ? (marketValue / totals.totalMarketValue) * 100 : 0;
                
                // 优化：ETF链接前缀修复。5开头(SH ETF), 6开头(SH Stock/ETF), 9开头(SH B股) 均为 sh，其他为 sz
                const marketPrefix = /^(5|6|9)/.test(s.code) ? 'sh' : 'sz';

                return (
                  <tr key={s.id} className="hover:bg-purple-50/30 transition-colors group">
                    
                    {/* 名称 + 外链 */}
                    <td className="p-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 mb-0.5">{s.name}</span>
                        <div className="flex items-center space-x-2">
                            {/* 修复链接跳转：使用优化后的 marketPrefix 变量 */}
                            <a href={`https://gu.qq.com/${marketPrefix}${s.code}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider hover:text-purple-600 hover:bg-purple-100 transition-colors flex items-center group/link">
                                {s.code} <ExternalLink size={8} className="ml-1 opacity-0 group-hover/link:opacity-100 transition-opacity"/>
                            </a>
                            <span className="text-[10px] font-bold text-purple-400 bg-purple-50 px-1.5 py-0.5 rounded">{s.tag || '稳健'}</span>
                        </div>
                      </div>
                    </td>

                    {/* 现价 / 成本 */}
                    <td className="p-6 text-right">
                      <div className="flex flex-col items-end">
                        {/* ⚠️ 保持：直接渲染数字，不补0，原样显示 */}
                        <span className="text-sm font-mono font-bold text-slate-700">{currentPrice}</span>
                        <span className="text-[10px] font-bold text-slate-400">成本 {costPrice}</span>
                      </div>
                    </td>

                    {/* 日涨跌 (额度 + 百分比) */}
                    <td className="p-6 text-right">
                        <div className="flex flex-col items-end">
                            <span className={`text-sm font-black ${dailyProfitAmount >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {/* 修正：日盈亏金额保留2位小数 */}
                                {dailyProfitAmount >= 0 ? '+' : ''}{dailyProfitAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </span>
                            <div className="flex items-center space-x-1.5 mt-1">
                                <div className={`inline-flex items-center text-[10px] font-black ${changePercent >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {changePercent >= 0 ? <ArrowUpRight size={10} className="mr-0.5"/> : <ArrowDownRight size={10} className="mr-0.5"/>}
                                    {Math.abs(changePercent).toFixed(2)}%
                                </div>
                                {/* 状态标签 */}
                                <span className={`text-[9px] font-bold px-1 rounded flex items-center border ${marketInfo.color}`}>
                                    {marketInfo.label.includes('交易中') ? '实时' : '收盘'}
                                </span>
                            </div>
                        </div>
                    </td>

                    {/* 持仓量 */}
                    <td className="p-6 text-right">
                      <span className="text-sm font-mono font-bold text-slate-900">{quantity.toLocaleString()}</span>
                    </td>

                    {/* 市值 (带进度条 + 百分比) */}
                    <td className="p-6 text-right">
                        <div className="flex flex-col items-end">
                            {/* 修正：市值金额保留2位小数 */}
                            <span className="text-sm font-mono font-black text-slate-900">¥{marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <div className="w-16 h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden flex">
                                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${positionRatio}%` }}></div>
                            </div>
                            <span className="text-[9px] text-slate-400 font-bold mt-0.5">{positionRatio.toFixed(1)}%</span>
                        </div>
                    </td>

                    {/* 累计盈亏 */}
                    <td className="p-6 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`text-sm font-black ${profit >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {/* 修正：累计盈亏金额保留2位小数 */}
                          {profit >= 0 ? '+' : ''}{profit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </span>
                        <span className={`text-[10px] ${profit >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                           ({profitRate.toFixed(2)}%)
                        </span>
                      </div>
                    </td>

                    {/* 操作 (ID删除) */}
                    <td className="p-6 text-right">
                      <div className="flex items-center justify-center space-x-2 opacity-50 group-hover:opacity-100 transition-all">
                        <button onClick={() => openEdit(s)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl"><Edit2 size={16}/></button>
                        <button onClick={() => { if(window.confirm(`确认删除 ${s.name}?`)) onDelete(s.id) }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {processedStocks.length === 0 && (
                <tr><td colSpan={7} className="py-20 text-center text-slate-400 font-bold">暂无股票数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 模态框 (样式优化) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-900 flex items-center">
                   {isEditing ? '编辑持仓' : '添加新股票'}
                </h2>
                <div className="bg-purple-50 text-purple-600 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Stock Asset</div>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 ml-1 uppercase">代码</label>
                    <div className="relative">
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none focus:border-purple-500 transition-colors" placeholder="600519" value={formData.code} disabled={isEditing} onChange={handleCodeChange} />
                        {isChecking && <div className="absolute right-3 top-3.5"><RefreshCw size={16} className="text-purple-500 animate-spin"/></div>}
                    </div>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 ml-1 uppercase">名称</label>
                    <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none focus:border-purple-500 transition-colors" placeholder="贵州茅台" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                 </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 ml-1 uppercase">持仓成本单价 (¥)</label>
                <div className="relative">
                    <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 pl-8 outline-none focus:border-purple-500 transition-colors" type="number" placeholder="0.00" value={formData.costPrice} onChange={e => setFormData({...formData, costPrice: e.target.value})} />
                    <span className="absolute left-3 top-3.5 text-slate-400 font-bold">¥</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 ml-1 uppercase">持仓数量 (股)</label>
                <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none focus:border-purple-500 transition-colors" type="number" placeholder="100" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
              </div>

              <div className="space-y-1.5">
                 <label className="text-xs font-bold text-slate-400 ml-1 uppercase">策略标签</label>
                 <div className="flex space-x-2">
                    {['稳健', '激进', '长线', '短线'].map(tag => (
                        <button key={tag} onClick={() => setFormData({...formData, tag})} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${formData.tag === tag ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>{tag}</button>
                    ))}
                 </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-8">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3.5 rounded-xl font-bold text-slate-500 bg-slate-50 hover:bg-slate-100">取消</button>
              <button onClick={handleSubmit} className="flex-1 py-3.5 rounded-xl font-bold bg-slate-900 text-white hover:bg-purple-600 shadow-lg shadow-slate-900/20 active:scale-95 transition-all">确认{isEditing ? '修改' : '添加'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockList;