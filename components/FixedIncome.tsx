import React, { useMemo, useState, useEffect } from 'react';
import { 
  TrendingUp, Trash2, Edit3, Search, 
  Clock, Plus, X, Save, Wallet, 
  Layers, ArrowUpDown, Zap, Calculator, Briefcase,
  CalendarDays, ArrowUpRight, ArrowDownRight, Tag, AlertCircle, Coins
} from 'lucide-react';

// --- 类型定义 ---
interface FixedAsset {
  id: string | number;
  name: string;
  code?: string;
  
  costPrice?: number | string;   
  quantity?: number | string;    
  startDate?: string;            
  
  marketValue?: number | string; 
  totalProfit?: number | string;
  daysHeld?: number | string;
  
  recordDate?: string;
  tag?: string;
  apy?: number | string;
  extra?: string;
}

interface FixedIncomeListProps {
  items: FixedAsset[];
  onDelete: (id: string | number) => void;
  onEdit: (asset: any) => void;
  onAdd: (asset: any) => void;
}

type SortField = 'marketValue' | 'totalProfit' | 'projectedDaily' | 'annualizedYield' | 'daysHeld' | 'dailyPer10k';
type SortDirection = 'asc' | 'desc';

const BANK_RATE = 2.0;

// --- 🛡️ 强力数字解析 ---
const safeNum = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const strVal = String(val).replace(/,/g, ''); 
  const n = Number(strVal);
  return isNaN(n) ? 0 : n;
};

const fmt = (val: any, decimals: number = 2) => {
  return safeNum(val).toLocaleString(undefined, { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
};

const FixedIncomeList: React.FC<FixedIncomeListProps> = ({ items = [], onDelete, onEdit, onAdd }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [sortField, setSortField] = useState<SortField>('marketValue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [formData, setFormData] = useState({
    id: '', code: '', name: '', marketValue: '', totalProfit: '', daysHeld: '', 
    recordDate: '', tag: '稳健', apy: '', extra: ''
  });

  const [autoCalcInfo, setAutoCalcInfo] = useState({ roi: 0, apy: 0, daily: 0 });

  // --- 1. 数据清洗与核心计算 ---
  const processedItems = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : [];

    let result = safeItems.map(item => {
      if (!item) return null;

      const rawMarketVal = item.marketValue ?? item.costPrice ?? item.currentValue;
      const rawProfit = item.totalProfit ?? item.profit;
      const rawPrincipal = item.quantity ?? item.principal; 

      let marketVal = safeNum(rawMarketVal);
      let profit = safeNum(rawProfit);
      
      // 🔥 修复Bug：天数计算精度修正 (365天不变成366)
      let d = safeNum(item.daysHeld ?? item.days); 

      // 如果没有直接存天数，尝试反推
      if (d <= 0 && item.startDate) {
          const start = new Date(item.startDate);
          // 逻辑修正：强制把时间归零到午夜，消除时分秒带来的误差
          start.setHours(0, 0, 0, 0);
          
          const endStr = item.recordDate ? item.recordDate : new Date().toISOString().split('T')[0];
          const end = new Date(endStr);
          end.setHours(0, 0, 0, 0);

          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
              const diff = end.getTime() - start.getTime();
              // 使用 round 避免浮点数误差
              d = Math.round(diff / (1000 * 60 * 60 * 24));
          }
      }
      
      if (d <= 0) d = 1; // 保底

      if (profit === 0 && safeNum(rawPrincipal) > 0 && marketVal > 0) {
          profit = marketVal - safeNum(rawPrincipal);
      }
      
      let finalPrincipal = safeNum(rawPrincipal);
      if (finalPrincipal === 0 && marketVal !== 0 && profit !== 0) {
          finalPrincipal = marketVal - profit;
      }

      const totalRoi = finalPrincipal > 0 ? (profit / finalPrincipal) * 100 : 0;
      const historicalApy = (totalRoi / d) * 365;
      const calcApy = item.apy ? safeNum(item.apy) : historicalApy;
      const projectedDaily = marketVal * (calcApy / 100) / 365;
      const beatsBank = calcApy > BANK_RATE;

      const dailyPer10k = 10000 * (calcApy / 100) / 365;
      const projectedAnnual = marketVal * (calcApy / 100);

      return {
        ...item,
        code: item.code || '',
        marketValue: marketVal, 
        totalProfit: profit,
        daysHeld: d,
        principal: finalPrincipal,
        totalRoi,
        historicalApy,
        calcApy,
        projectedDaily,
        dailyPer10k,
        projectedAnnual,
        beatsBank,
        recordDate: item.recordDate || new Date().toISOString().split('T')[0]
      };
    }).filter(Boolean) as any[]; 

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(i => 
        (i.name && i.name.toLowerCase().includes(lower)) || 
        (i.tag && i.tag.toLowerCase().includes(lower))
      );
    }

    result.sort((a, b) => {
      let valA = 0, valB = 0;
      switch (sortField) {
        case 'marketValue': valA = a.marketValue; valB = b.marketValue; break;
        case 'totalProfit': valA = a.totalProfit; valB = b.totalProfit; break;
        case 'projectedDaily': valA = a.projectedDaily; valB = b.projectedDaily; break;
        case 'annualizedYield': valA = a.calcApy; valB = b.calcApy; break;
        case 'daysHeld': valA = a.daysHeld; valB = b.daysHeld; break;
        case 'dailyPer10k': valA = a.dailyPer10k; valB = b.dailyPer10k; break;
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [items, searchTerm, sortField, sortDirection]);

  // --- 2. 汇总 ---
  const totals = useMemo(() => {
    const totalPrincipal = processedItems.reduce((acc, i) => acc + i.principal, 0);
    const totalValue = processedItems.reduce((acc, i) => acc + i.marketValue, 0);
    const totalProfit = totalValue - totalPrincipal;
    const totalRate = totalPrincipal > 0 ? (totalProfit / totalPrincipal) * 100 : 0;
    const totalProjectedDaily = processedItems.reduce((acc, i) => acc + i.projectedDaily, 0);

    return { totalPrincipal, totalValue, totalProfit, totalRate, totalProjectedDaily };
  }, [processedItems]);

  // --- 3. 实时计算 ---
  useEffect(() => {
    if (!isModalOpen) return;
    const m = safeNum(formData.marketValue);
    const p = safeNum(formData.totalProfit);
    const d = safeNum(formData.daysHeld) || 1;
    
    const principal = m - p;
    const roi = principal > 0 ? (p / principal) * 100 : 0;
    const autoApy = (roi / d) * 365;
    const usedApy = formData.apy ? safeNum(formData.apy) : autoApy;
    const daily = m * (usedApy / 100) / 365;

    setAutoCalcInfo({ roi, apy: autoApy, daily });
  }, [formData.marketValue, formData.totalProfit, formData.daysHeld, formData.apy, isModalOpen]);

  // --- 交互 ---
  const handleSort = (f: SortField) => {
    if (sortField === f) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDirection('desc'); }
  };

  const openAddModal = () => { 
    setFormData({ id: '', code: '', name: '', marketValue: '', totalProfit: '', daysHeld: '', recordDate: new Date().toISOString().split('T')[0], tag: '稳健', apy: '', extra: '' }); 
    setIsEditing(false); 
    setIsModalOpen(true); 
  };
  
  const openEditModal = (item: any) => {
    setFormData({
      id: item.id,
      code: item.code,
      name: item.name,
      marketValue: String(item.marketValue),
      totalProfit: String(item.totalProfit),
      daysHeld: String(item.daysHeld),
      recordDate: item.recordDate || new Date().toISOString().split('T')[0],
      tag: item.tag || '稳健',
      apy: item.apy ? String(item.apy) : '',
      extra: item.extra || ''
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.marketValue) return alert("请至少填写名称和当前市值");
    const marketVal = safeNum(formData.marketValue);
    const profit = safeNum(formData.totalProfit);
    const principal = marketVal - profit; 
    const days = safeNum(formData.daysHeld) || 1;
    
    const startDateObj = new Date();
    startDateObj.setDate(startDateObj.getDate() - days);
    const derivedStartDate = startDateObj.toISOString().split('T')[0];
    const uniqueCode = formData.code || `FIX_${Date.now()}_${Math.floor(Math.random()*1000)}`;

    const assetData = {
      id: isEditing ? formData.id : undefined,
      code: uniqueCode,
      name: formData.name,
      marketValue: marketVal, costPrice: marketVal, 
      quantity: principal, principal: principal, 
      totalProfit: profit, daysHeld: days, startDate: derivedStartDate,
      recordDate: formData.recordDate, tag: formData.tag, apy: safeNum(formData.apy), extra: formData.extra,
      asset_type: 'fixed'
    };
    isEditing ? onEdit(assetData) : onAdd(assetData);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 relative max-w-[1600px] mx-auto px-4 pt-2 pb-4">
      
      {/* 顶部统计区 (保持紧凑完美布局) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 市值 */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
           <div className="flex justify-between items-start relative z-10">
             <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center">
                   <Briefcase size={10} className="mr-1"/> 理财总市值
                </p>
                <div className="text-2xl font-mono font-black tracking-tight">¥{fmt(totals.totalValue)}</div>
             </div>
             <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm"><Wallet size={16} className="text-indigo-200" /></div>
           </div>
           <div className="mt-3 relative z-10">
             <span className="text-lg font-bold text-slate-200 bg-slate-700/50 px-2 py-1 rounded border border-slate-600">
               本金: ¥{fmt(totals.totalPrincipal, 0)}
             </span>
           </div>
        </div>

        {/* 收益 */}
        <div className={`rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all ${totals.totalProfit >= 0 ? 'bg-gradient-to-br from-rose-500 to-rose-600 text-white' : 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white'}`}>
           <div className="flex justify-between items-start relative z-10">
             <div>
                <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-1">累计总收益</p>
                <div className="text-2xl font-black tracking-tight">
                  {totals.totalProfit >= 0 ? '+' : ''}{fmt(totals.totalProfit)}
                </div>
             </div>
             <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm"><TrendingUp size={16} className="text-white" /></div>
           </div>
           <div className="mt-3 relative z-10">
             <span className="text-sm font-bold text-white bg-white/20 px-2 py-1 rounded backdrop-blur-md">
               总回报率 {fmt(totals.totalRate)}%
             </span>
           </div>
        </div>

        {/* 日赚 */}
        <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
           <div className="flex justify-between items-start relative z-10">
             <div>
                <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mb-1 flex items-center">
                   <Zap size={10} className="mr-1 fill-current"/> 明日预计躺赚
                </p>
                <div className="text-3xl font-black tracking-tight">+{fmt(totals.totalProjectedDaily)}</div>
             </div>
             <div className="absolute right-4 bottom-4 opacity-20"><Calculator size={60} /></div>
           </div>
           <div className="mt-3 relative z-10">
              <p className="text-sm font-bold text-indigo-50 bg-black/20 w-fit px-2 py-1 rounded">
                相当于日薪加鸡腿
              </p>
           </div>
        </div>
      </div>

      {/* 列表区域 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
        <div className="flex flex-col md:flex-row justify-between items-center px-6 py-4 border-b border-slate-100 gap-4">
            <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center"><Layers size={16}/></div>
                <h2 className="text-lg font-black text-slate-900">理财/固收快照</h2>
            </div>
            
            <div className="flex gap-3 w-full md:w-auto">
                <div className="relative group flex-1 md:w-64">
                    <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} />
                    <input type="text" placeholder="搜索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-50 border border-slate-200 pl-9 pr-4 py-2 rounded-xl font-bold text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                </div>
                <button onClick={openAddModal} className="flex items-center gap-1 bg-slate-900 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg shadow-slate-900/10 active:scale-95 transition-all whitespace-nowrap">
                    <Plus size={14} strokeWidth={3} /> 记一笔
                </button>
            </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {/* 🔥 布局优化：8列布局，缓解拥挤 */}
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600" onClick={() => handleSort('marketValue')}>产品</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:text-indigo-600" onClick={() => handleSort('marketValue')}>市值</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:text-indigo-600" onClick={() => handleSort('totalProfit')}>总回报</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:text-indigo-600" onClick={() => handleSort('daysHeld')}>时间</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:text-indigo-600" onClick={() => handleSort('projectedDaily')}>日赚</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:text-indigo-600" onClick={() => handleSort('annualizedYield')}>年化</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:text-indigo-600" onClick={() => handleSort('dailyPer10k')}>万份/年收</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedItems.map((item) => {
                const positionRatio = totals.totalValue > 0 ? (item.marketValue / totals.totalValue) * 100 : 0;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group text-sm">
                    {/* 1. 产品列：名称 + 标签 + 备注 */}
                    <td className="p-4 align-top">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-bold text-slate-900">{item.name}</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                           <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center">
                             <Tag size={8} className="mr-1"/>{item.tag || '稳健'}
                           </span>
                           {item.extra && <span className="text-[10px] text-slate-400 border border-slate-100 px-1 rounded">{item.extra}</span>}
                        </div>
                      </div>
                    </td>

                    {/* 2. 市值列：数值 + 进度条 */}
                    <td className="p-4 text-right align-top">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-mono font-bold text-slate-900">¥{fmt(item.marketValue)}</span>
                        <div className="flex items-center justify-end gap-2 w-full max-w-[120px]">
                            <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${positionRatio}%` }}></div>
                            </div>
                            <span className="text-[9px] font-bold text-indigo-500">{positionRatio.toFixed(1)}%</span>
                        </div>
                      </div>
                    </td>

                    {/* 3. 总回报列：收益 + 收益率 */}
                    <td className="p-4 text-right align-top">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={`font-bold text-lg ${item.totalProfit >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {item.totalProfit >= 0 ? '+' : ''}{fmt(item.totalProfit)}
                        </span>
                        <span className={`text-[10px] font-bold ${item.totalProfit >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                           {fmt(item.totalRoi)}%
                        </span>
                      </div>
                    </td>

                    {/* 4. 时间列（新）：持有天数 + 记录日期 */}
                    <td className="p-4 text-right align-top">
                        <div className="flex flex-col items-end gap-1">
                            <span className="font-bold text-slate-700 flex items-center">
                               <Clock size={12} className="mr-1 text-slate-400"/> {item.daysHeld}天
                            </span>
                            <span className="text-[9px] text-slate-400 flex items-center bg-slate-50 px-1.5 py-0.5 rounded">
                               <CalendarDays size={8} className="mr-1"/> {item.recordDate}
                            </span>
                        </div>
                    </td>

                    {/* 5. 日赚列：数值 + 依据 */}
                    <td className="p-4 text-right align-top">
                        <div className="flex flex-col items-end gap-0.5">
                             <span className="text-base font-mono font-black text-indigo-600">
                               + {fmt(item.projectedDaily)}
                             </span>
                             <span className="text-[9px] text-indigo-300">
                               按 {fmt(item.calcApy)}% 估算
                             </span>
                        </div>
                    </td>

                    {/* 6. 年化效率列：数值 + 对比 */}
                    <td className="p-4 text-right align-top">
                        <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1">
                               <span className={`font-bold text-sm ${item.beatsBank ? 'text-rose-500' : 'text-emerald-500'}`}>
                                   {fmt(item.calcApy)}%
                               </span>
                               {item.beatsBank ? <ArrowUpRight size={12} className="text-rose-500"/> : <ArrowDownRight size={12} className="text-emerald-500"/>}
                            </div>
                            <span className="text-[9px] text-slate-400">
                                {item.beatsBank ? '跑赢存款' : '跑输存款'}
                            </span>
                        </div>
                    </td>

                    {/* 7. 万份/年收列（新）：单独展示，不再拥挤 */}
                    <td className="p-4 text-right align-top">
                        <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] text-slate-600 font-bold bg-slate-100 px-1.5 py-0.5 rounded flex items-center">
                               <Coins size={9} className="mr-1 text-slate-400"/> 万份 {fmt(item.dailyPer10k, 4)}
                            </span>
                            <span className="text-[9px] text-slate-400">
                               年收约 {fmt(item.projectedAnnual, 0)}
                            </span>
                        </div>
                    </td>

                    <td className="p-4 text-center align-top">
                      <div className="flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => openEditModal(item)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit3 size={14} /></button>
                        <button onClick={() => { if(window.confirm(`确认删除?`)) onDelete(item.id) }} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {processedItems.length === 0 && (
                <tr>
                   <td colSpan={8} className="py-20 text-center text-slate-400 flex flex-col items-center justify-center w-full">
                      <AlertCircle size={32} className="mb-2 opacity-50"/>
                      <span className="font-bold">暂无有效理财记录</span>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 弹窗 (保持不变) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-lg font-black text-slate-900">{isEditing ? '更新记录' : '记一笔'}</h3>
                   <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={18}/></button>
                </div>
                
                <div className="space-y-4">
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">产品名称</label>
                      <input type="text" placeholder="如：招商朝朝宝" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:border-indigo-500 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">当前市值(含收益)</label>
                        <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:border-indigo-500 outline-none" value={formData.marketValue} onChange={e => setFormData({...formData, marketValue: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">已获收益</label>
                        <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:border-indigo-500 outline-none" value={formData.totalProfit} onChange={e => setFormData({...formData, totalProfit: e.target.value})} />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">持有天数</label>
                        <input type="number" placeholder="APP显示天数" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:border-indigo-500 outline-none" value={formData.daysHeld} onChange={e => setFormData({...formData, daysHeld: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">预期年化 (%)</label>
                        <input type="number" placeholder="不填则自动算" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:border-indigo-500 outline-none" value={formData.apy} onChange={e => setFormData({...formData, apy: e.target.value})} />
                      </div>
                   </div>
                   
                   <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex justify-between items-center text-xs">
                        <div>
                           <div className="font-bold text-indigo-800">自动估算结果:</div>
                           <div className="text-indigo-600">年化: {fmt(autoCalcInfo.apy)}%</div>
                        </div>
                        <div className="text-right">
                           <div className="text-indigo-400">预计日赚</div>
                           <div className="font-black text-indigo-700 text-lg">+{fmt(autoCalcInfo.daily)}</div>
                        </div>
                   </div>

                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">产品类型</label>
                      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {['稳健', '激进', '短期', '长期', '国债'].map(tag => (
                          <button key={tag} onClick={() => setFormData({...formData, tag})} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap ${formData.tag === tag ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>{tag}</button>
                        ))}
                      </div>
                   </div>
                </div>

                <button onClick={handleSubmit} className="w-full mt-6 bg-slate-900 hover:bg-indigo-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all shadow-lg shadow-slate-900/20 active:scale-95">
                  <Save size={18} /><span>{isEditing ? '保存修正' : '确认记录'}</span>
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FixedIncomeList;