import React, { useMemo, useState } from 'react';
import { 
  PieChart, TrendingUp, Trash2, Edit3, Search, AlertCircle, 
  Clock, CalendarCheck, Plus, X, Loader2, Save, ArrowUpRight, ArrowDownRight,
  RefreshCw, Wallet, ExternalLink, Layers, ArrowUpDown, Activity
} from 'lucide-react';

interface FundListProps {
  funds: any[];
  onDelete: (id: string) => void;
  onEdit: (fund: any) => void;
  onAdd: (fund: any) => void;
}

type SortField = 'marketValue' | 'totalProfit' | 'dailyProfit' | 'name' | 'netValue' | 'shares';
type SortDirection = 'asc' | 'desc';

const FundList: React.FC<FundListProps> = ({ funds, onDelete, onEdit, onAdd }) => {
  // --- 状态 ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 排序
  const [sortField, setSortField] = useState<SortField>('marketValue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // 表单
  const [formData, setFormData] = useState({
    code: '', name: '', shares: '', costPrice: '', tag: '稳健'
  });

  // --- 1. 自动检测 ---
  const handleCodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData(prev => ({ ...prev, code: val }));

    if (!isEditing && val.length === 6 && /^\d+$/.test(val)) {
        setIsChecking(true);
        try {
            const res = await fetch(`/api/market/check?type=fund&code=${val}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('pacc_token')}` }
            });
            const data = await res.json();
            if (data.valid) {
                setFormData(prev => ({
                    ...prev,
                    name: data.name,
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

  // --- 2. 提交 ---
  const handleSubmit = () => {
    if (!formData.code || !formData.name || !formData.shares) {
      alert("请完整填写代码、名称和持有份额");
      return;
    }
    const assetData = {
      ...formData,
      asset_type: 'fund',
      quantity: Number(formData.shares),
      shares: Number(formData.shares),
      costPrice: Number(formData.costPrice)
    };
    isEditing ? onEdit(assetData) : onAdd(assetData);
    setIsModalOpen(false);
    resetForm();
  };

  const openAddModal = () => { resetForm(); setIsEditing(false); setIsModalOpen(true); };
  const openEditModal = (fund: any) => {
    setFormData({
      code: fund.code,
      name: fund.name,
      shares: String(fund.shares),
      costPrice: String(fund.costPrice || fund.netValue || 0),
      tag: fund.tag || '稳健'
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };
  const resetForm = () => { setFormData({ code: '', name: '', shares: '', costPrice: '', tag: '稳健' }); };

  // --- 3. 排序与数据处理 ---
  const processedFunds = useMemo(() => {
    let result = [...funds];
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(lower) || f.code.includes(lower));
    }
    result.sort((a, b) => {
      let valA = 0, valB = 0;
      const priceA = Number(a.netValue || 0); const priceB = Number(b.netValue || 0);
      const costA = Number(a.costPrice || 0); const costB = Number(b.costPrice || 0);
      const shareA = Number(a.shares || 0);   const shareB = Number(b.shares || 0);
      const changeA = Number(a.estimatedChange || 0); const changeB = Number(b.estimatedChange || 0);

      switch (sortField) {
        case 'marketValue': valA = priceA * shareA; valB = priceB * shareB; break;
        case 'totalProfit': valA = (priceA - costA) * shareA; valB = (priceB - costB) * shareB; break;
        case 'dailyProfit': valA = (priceA * shareA) * (changeA / 100); valB = (priceB * shareB) * (changeB / 100); break;
        case 'netValue': valA = priceA; valB = priceB; break;
        case 'shares': valA = shareA; valB = shareB; break;
        case 'name': return sortDirection === 'asc' ? a.name.localeCompare(b.name,'zh') : b.name.localeCompare(a.name,'zh');
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
    return result;
  }, [funds, searchTerm, sortField, sortDirection]);

  // --- 4. 汇总计算 ---
  const totals = useMemo(() => {
    const marketValue = funds.reduce((acc, f) => acc + (Number(f.netValue||0) * f.shares), 0);
    const totalCost = funds.reduce((acc, f) => acc + (Number(f.costPrice||0) * f.shares), 0);
    const totalProfit = marketValue - totalCost;
    const profitRate = totalCost !== 0 ? (totalProfit / totalCost) * 100 : 0;
    
    // 当日盈亏汇总
    const dailyProfit = funds.reduce((acc, f) => {
        const mv = (Number(f.netValue||0) * f.shares);
        const change = Number(f.estimatedChange || 0);
        return acc + (mv * (change / 100));
    }, 0);

    return { marketValue, totalCost, totalProfit, profitRate, dailyProfit };
  }, [funds]);

  // --- 5. 市场状态逻辑 ---
  const marketInfo = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const isWeekend = day === 0 || day === 6;
    
    // 获取今日日期 MM-DD
    const todayStr = `${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}`;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 1. 周末
    if (isWeekend) {
        return { 
            status: 'closed', 
            label: `${todayStr} 休市结算`, 
            color: 'text-slate-400 bg-slate-100 border-slate-200' 
        };
    }

    // 2. 交易时间 (9:30 - 15:00)
    if (hour >= 9 && hour < 15) {
        return { 
            status: 'trading', 
            label: `${todayStr} ${timeStr} 盘中估`, 
            color: 'text-indigo-500 bg-indigo-50 border-indigo-100' 
        };
    }

    // 3. 盘后但未更新 (15:00 - 20:00)
    if (hour >= 15 && hour < 20) {
        return { 
            status: 'closed_waiting', 
            label: `${todayStr} 估值收盘`, 
            color: 'text-purple-500 bg-purple-50 border-purple-100' 
        };
    }

    // 4. 晚间/盘前 (20:00 - 次日9:00)
    return { 
        status: 'updated', 
        label: `${todayStr} 净值已更`, 
        color: 'text-emerald-500 bg-emerald-50 border-emerald-100' 
    };

  }, []);

  const handleSort = (f: SortField) => {
    if (sortField === f) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDirection('desc'); }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
      
      {/* ======================= 1. 顶部统计区 ======================= */}
      <div className="flex flex-col lg:flex-row gap-4">
        
        {/* 1. 紫卡：总资产 + 成本 */}
        <div className="flex-[1.2] bg-purple-900 rounded-[2.5rem] p-6 text-white shadow-xl shadow-purple-900/20 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-purple-800 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="relative z-10 flex justify-between items-start h-full">
            <div>
              <p className="text-[10px] font-black uppercase opacity-60 mb-2 tracking-widest flex items-center">
                <Wallet size={12} className="mr-1"/> 基金持仓总额
              </p>
              {/* 修正：保留2位小数 */}
              <p className="text-3xl font-mono font-black tracking-tight">¥{totals.marketValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}</p>
              <div className="mt-3 flex items-center space-x-2 bg-purple-800/50 w-fit px-3 py-1 rounded-lg backdrop-blur-md border border-purple-700/50">
                 <Layers size={10} className="text-purple-300"/>
                 {/* 修正：保留2位小数 */}
                 <span className="text-[10px] text-purple-200 font-bold">成本: ¥{totals.totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}</span>
              </div>
            </div>
            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm"><PieChart size={24} className="text-purple-200"/></div>
          </div>
        </div>

        {/* 2. 白卡：当日总盈亏 */}
        <div className={`flex-1 bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm flex justify-between items-center relative overflow-hidden group ${totals.dailyProfit >= 0 ? 'hover:shadow-rose-100' : 'hover:shadow-emerald-100'} hover:shadow-lg transition-all`}>
          <div>
              <div className="flex items-center space-x-2 mb-2">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">当日总盈亏</p>
                 {/* 时间标签 */}
                 <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center border ${marketInfo.color}`}>
                    {marketInfo.status === 'trading' && <RefreshCw size={8} className="mr-1 animate-spin"/>}
                    {marketInfo.label}
                 </span>
              </div>
              <div className={`text-3xl font-black ${totals.dailyProfit >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                 {/* 修正：保留2位小数 */}
                 {totals.dailyProfit >= 0 ? '+' : ''}{totals.dailyProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}
              </div>
          </div>
          <div className={`p-4 rounded-2xl ${totals.dailyProfit >= 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
             <Activity size={24} />
          </div>
        </div>

        {/* 3. 白卡：累计总盈亏 */}
        <div className="flex-1 bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm flex justify-between items-center relative overflow-hidden">
          <div>
              <div className="flex items-center space-x-2 mb-2">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">累计总盈亏</p>
                 {/* 状态标签 */}
                 <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center border ${marketInfo.color}`}>
                    {marketInfo.label}
                 </span>
              </div>
              <div className={`text-3xl font-black ${totals.totalProfit >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                 {/* 修正：保留2位小数 */}
                 {totals.totalProfit >= 0 ? '+' : ''}{totals.totalProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}
                 <span className="text-sm ml-2 opacity-60 font-bold">({totals.profitRate.toFixed(2)}%)</span>
              </div>
          </div>
          <div className={`p-4 rounded-2xl ${totals.totalProfit >= 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
             <TrendingUp size={24} />
          </div>
        </div>

        {/* 4. 黑按钮 */}
        <button onClick={openAddModal} className="flex-none bg-slate-900 hover:bg-purple-600 text-white rounded-[2.5rem] px-8 flex flex-col items-center justify-center transition-all shadow-xl shadow-slate-900/10 active:scale-95 group min-w-[100px]">
           <div className="p-2.5 bg-white/10 rounded-full mb-1 group-hover:bg-white/20 transition-colors"><Plus size={20} /></div>
           <span className="text-[10px] font-black uppercase tracking-widest">添加</span>
        </button>
      </div>

      {/* ======================= 2. 列表区域 ======================= */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
        {/* 顶栏 */}
        <div className="flex flex-col md:flex-row justify-between items-center px-8 py-6 border-b border-slate-100 gap-4">
            <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center"><PieChart size={20}/></div>
                <div>
                    <h2 className="text-xl font-black text-slate-900">场外基金</h2>
                    <p className="text-xs font-bold text-slate-400">{funds.length} 个标的 · <span className="text-indigo-500">天天基金实时</span></p>
                </div>
            </div>
            <div className="relative group w-full md:w-auto">
                <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-purple-500 transition-colors" size={16} />
                <input type="text" placeholder="搜索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-64 bg-slate-50 border border-slate-200 pl-9 pr-4 py-2 rounded-full font-bold text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all" />
            </div>
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-purple-600" onClick={() => handleSort('name')}>基金名称 <ArrowUpDown size={12} className="inline ml-1"/></th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:text-purple-600" onClick={() => handleSort('netValue')}>净值 / 成本 <ArrowUpDown size={12} className="inline ml-1"/></th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:text-purple-600" onClick={() => handleSort('dailyProfit')}>日收益 (含估值) <ArrowUpDown size={12} className="inline ml-1"/></th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">份额</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:text-purple-600" onClick={() => handleSort('marketValue')}>持有市值 (占比) <ArrowUpDown size={12} className="inline ml-1"/></th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:text-purple-600" onClick={() => handleSort('totalProfit')}>累计盈亏 <ArrowUpDown size={12} className="inline ml-1"/></th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedFunds.map((fund) => {
                const marketValue = fund.netValue * fund.shares;
                const totalCostVal = (fund.costPrice || 0) * fund.shares;
                const totalProfit = marketValue - totalCostVal;
                const totalRate = totalCostVal !== 0 ? (totalProfit / totalCostVal) * 100 : 0;
                
                const navDate = fund.navDate ? fund.navDate.substring(5) : '--'; 
                const dailyChangePercent = Number(fund.estimatedChange || 0);
                const dailyProfit = marketValue * (dailyChangePercent / 100);
                
                // --- 核心修复逻辑：判断是否是今日已更新的实盘净值 ---
                const now = new Date();
                const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
                const currentDay = now.getDate().toString().padStart(2, '0');
                const todayMMDD = `${currentMonth}-${currentDay}`;
                
                // 如果基金数据的日期 == 今天，说明已更新；否则就是估值（或历史数据）
                const isUpdatedToday = navDate === todayMMDD;
                
                // 只有在数据日期不是今天，且处于交易时段或盘后未更时，才叫“实时估”
                const isEstimate = !isUpdatedToday && dailyChangePercent !== 0; 
                
                const positionRatio = totals.marketValue > 0 ? (marketValue / totals.marketValue) * 100 : 0;

                return (
                  <tr key={fund.id} className="hover:bg-purple-50/30 transition-colors group">
                    {/* 名称 */}
                    <td className="p-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 mb-0.5">{fund.name}</span>
                        <div className="flex items-center space-x-2">
                           <a href={`http://fund.eastmoney.com/${fund.code}.html`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider hover:text-purple-600 hover:bg-purple-100 transition-colors flex items-center group/link">
                             {fund.code} <ExternalLink size={8} className="ml-1 opacity-0 group-hover/link:opacity-100 transition-opacity"/>
                           </a>
                           <span className="text-[10px] font-bold text-purple-400 bg-purple-50 px-1.5 py-0.5 rounded">{fund.tag || '稳健'}</span>
                        </div>
                      </div>
                    </td>

                    {/* 净值 / 成本 */}
                    <td className="p-6 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-mono font-bold text-slate-700">{Number(fund.netValue).toFixed(4)}</span>
                        <span className="text-[10px] font-bold text-slate-400">成本 {Number(fund.costPrice||0).toFixed(4)}</span>
                      </div>
                    </td>

                    {/* 日收益 */}
                    <td className="p-6 text-right">
                        <div className="flex flex-col items-end">
                          <span className={`text-sm font-black ${dailyProfit >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                              {/* 修正：保留2位小数 */}
                              {dailyProfit >= 0 ? '+' : ''}{dailyProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </span>
                          <div className="flex items-center space-x-1.5 mt-1">
                             <div className={`inline-flex items-center text-[10px] font-black ${dailyChangePercent >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {dailyChangePercent >= 0 ? <ArrowUpRight size={10} className="mr-0.5"/> : <ArrowDownRight size={10} className="mr-0.5"/>}
                                {Math.abs(dailyChangePercent).toFixed(2)}%
                             </div>
                             
                             {/* ⚠️ 核心逻辑应用：根据日期判断显示 “实时估” 还是 “日期” */}
                             <span className={`text-[9px] font-bold px-1 rounded flex items-center border ${isEstimate ? 'bg-indigo-50 text-indigo-500 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                {isEstimate ? '实时估' : navDate}
                             </span>
                          </div>
                        </div>
                    </td>

                    {/* 份额 */}
                    <td className="p-6 text-right">
                      {/* 修正：份额保留小数（通常2位足够） */}
                      <span className="text-sm font-mono font-bold text-slate-900">{fund.shares.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </td>

                    {/* 市值 */}
                    <td className="p-6 text-right">
                      <div className="flex flex-col items-end">
                        {/* 修正：保留2位小数 */}
                        <span className="text-sm font-mono font-black text-slate-900">¥{marketValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        <div className="w-16 h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden flex">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${positionRatio}%` }}></div>
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold mt-0.5">{positionRatio.toFixed(1)}%</span>
                      </div>
                    </td>

                    {/* 累计盈亏 */}
                    <td className="p-6 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`text-sm font-black ${totalProfit >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {/* 修正：保留2位小数 */}
                          {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </span>
                        <div className="flex items-center space-x-1.5 mt-1">
                           <span className="text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-1 rounded flex items-center">
                             {/* 这里也应用同样的逻辑 */}
                             {isEstimate ? '含估值' : navDate}
                           </span>
                           <span className={`text-[10px] ${totalProfit >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              ({totalRate.toFixed(2)}%)
                           </span>
                        </div>
                      </div>
                    </td>

                    {/* 操作 */}
                    <td className="p-6 text-right">
                      <div className="flex items-center justify-center space-x-2 opacity-50 group-hover:opacity-100 transition-all">
                        <button onClick={() => openEditModal(fund)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl"><Edit3 size={16} /></button>
                        <button onClick={() => { if(window.confirm(`确认删除 ${fund.name}?`)) onDelete(fund.id) }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {funds.length === 0 && (
                <tr><td colSpan={7} className="py-20 text-center text-slate-400 font-bold">暂无场外基金</td></tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="bg-slate-50/80 px-8 py-4 flex items-center space-x-3 border-t border-slate-100">
           <AlertCircle size={14} className="text-slate-400" />
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
             提示：盘中时段（9:30-15:00）收益为估算值，准确盈亏请以晚间官方净值为准。
           </p>
        </div>
      </div>

      {/* 弹窗部分 (逻辑未变) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-black text-slate-900">{isEditing ? '编辑持仓' : '添加新基金'}</h3>
                   <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20}/></button>
                </div>
                <div className="space-y-4">
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">基金代码 (Code)</label>
                      <div className="relative">
                        <input type="text" placeholder="例如 005827" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:border-indigo-500 outline-none" value={formData.code} onChange={handleCodeChange} readOnly={isEditing} />
                        {isChecking && <div className="absolute right-3 top-3.5"><Loader2 size={16} className="text-purple-500 animate-spin"/></div>}
                      </div>
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">基金名称</label>
                      <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">持有份额</label>
                        <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:border-indigo-500 outline-none" value={formData.shares} onChange={e => setFormData({...formData, shares: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">持仓均价</label>
                        <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:border-indigo-500 outline-none" value={formData.costPrice} onChange={e => setFormData({...formData, costPrice: e.target.value})} />
                      </div>
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">策略标签</label>
                      <div className="flex gap-2">
                        {['进攻', '防守', '稳健'].map(tag => (
                          <button key={tag} onClick={() => setFormData({...formData, tag})} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${formData.tag === tag ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>{tag}</button>
                        ))}
                      </div>
                   </div>
                </div>
                <button onClick={handleSubmit} className="w-full mt-8 bg-slate-900 hover:bg-purple-600 text-white py-4 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all shadow-lg shadow-slate-900/20 active:scale-95">
                  <Save size={18} /><span>{isEditing ? '保存修正' : '确认添加'}</span>
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FundList;