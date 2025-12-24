import React, { useMemo, useState, useEffect } from 'react';
import { 
  TrendingUp, Trash2, Edit3, Search, 
  Clock, Plus, X, Save, Wallet, 
  Layers, Zap, Calculator, Briefcase,
  CalendarDays, ArrowUpRight, ArrowDownRight, Tag, AlertCircle, Coins,
  ChevronDown, ChevronRight, History
} from 'lucide-react';

// --- 类型定义 ---
// 买入明细结构
interface Transaction {
  id: string;
  date: string;
  amount: number;
}

interface FixedAsset {
  id: string | number;
  name: string;
  code?: string;
  
  costPrice?: number | string;   // 映射为：当前市值
  quantity?: number | string;    // 映射为：总本金
  startDate?: string;            // 映射为：加权后的等效起始日
  
  marketValue?: number | string; 
  totalProfit?: number | string;
  daysHeld?: number | string;
  
  recordDate?: string;
  tag?: string;
  apy?: number | string;
  extra?: string; // 🔥 核心：存储买入明细 JSON
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
  
  // 展开行状态
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());

  // 表单数据
  const [formData, setFormData] = useState({
    id: '', code: '', name: '', marketValue: '', totalProfit: '', daysHeld: '', 
    recordDate: '', tag: '稳健', apy: '', extra: ''
  });

  // 明细模式状态
  const [isDetailMode, setIsDetailMode] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

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
      
      // 解析 extra 中的明细
      let parsedTransactions: Transaction[] = [];
      try {
        if (item.extra && item.extra.trim().startsWith('[')) {
          parsedTransactions = JSON.parse(item.extra);
        }
      } catch (e) {}

      // 🔥 修复Bug：天数计算精度修正
      let d = safeNum(item.daysHeld ?? item.days); 

      // 如果没有直接存天数，尝试反推
      if (d <= 0 && item.startDate) {
          const start = new Date(item.startDate);
          start.setHours(0, 0, 0, 0);
          
          const endStr = item.recordDate ? item.recordDate : new Date().toISOString().split('T')[0];
          const end = new Date(endStr);
          end.setHours(0, 0, 0, 0);

          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
              const diff = end.getTime() - start.getTime();
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
      
      // 优先使用数据库存的 apy，如果没有（或是0），则用简单的历史年化填充显示
      let calcApy = item.apy ? safeNum(item.apy) : 0;
      if (calcApy === 0) {
          calcApy = (totalRoi / d) * 365;
      }

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
        historicalApy: (totalRoi / d) * 365,
        calcApy,
        projectedDaily,
        dailyPer10k,
        projectedAnnual,
        beatsBank,
        recordDate: item.recordDate || new Date().toISOString().split('T')[0],
        transactions: parsedTransactions // 将明细带入
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

  // --- 3. 实时计算 (核心：实现资金加权算法) ---
  useEffect(() => {
    if (!isModalOpen) return;

    let autoApy = 0;
    let totalPrincipal = 0;
    
    // 如果处于明细模式，且有明细数据
    if (isDetailMode && transactions.length > 0) {
        const now = new Date();
        now.setHours(0,0,0,0);
        
        let weightedCapitalDays = 0; // 资金占用量 (元*天)

        transactions.forEach(t => {
            if (!t.amount || !t.date) return;
            const amt = safeNum(t.amount);
            totalPrincipal += amt;
            
            const tDate = new Date(t.date);
            tDate.setHours(0,0,0,0);
            const diff = now.getTime() - tDate.getTime();
            const days = Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24))); 
            
            weightedCapitalDays += amt * days;
        });

        const marketVal = safeNum(formData.marketValue);
        const profit = marketVal - totalPrincipal;

        // 算法：资金加权年化 = (总收益 / 总的资金占用量) * 365
        if (weightedCapitalDays > 0) {
            autoApy = (profit / weightedCapitalDays) * 365 * 100;
        }
    } else {
        // 简单模式：一次性买入逻辑
        const m = safeNum(formData.marketValue);
        const p = safeNum(formData.totalProfit);
        const d = safeNum(formData.daysHeld) || 1;
        
        const principal = m - p;
        const roi = principal > 0 ? (p / principal) * 100 : 0;
        autoApy = (roi / d) * 365;
    }

    const m = safeNum(formData.marketValue);
    const usedApy = formData.apy ? safeNum(formData.apy) : autoApy;
    const daily = m * (usedApy / 100) / 365;

    setAutoCalcInfo({ roi: 0, apy: autoApy, daily });
  }, [formData.marketValue, formData.totalProfit, formData.daysHeld, formData.apy, transactions, isDetailMode, isModalOpen]);

  // --- 交互 ---
  const handleSort = (f: SortField) => {
    if (sortField === f) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDirection('desc'); }
  };

  const toggleRow = (id: string | number) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const addTransaction = () => {
    setTransactions([...transactions, { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], amount: 0 }]);
  };
  const updateTransaction = (idx: number, field: keyof Transaction, val: any) => {
    const newTxs = [...transactions];
    newTxs[idx] = { ...newTxs[idx], [field]: val };
    setTransactions(newTxs);
  };
  const removeTransaction = (idx: number) => {
    const newTxs = [...transactions];
    newTxs.splice(idx, 1);
    setTransactions(newTxs);
  };

  const openAddModal = () => { 
    setFormData({ id: '', code: '', name: '', marketValue: '', totalProfit: '', daysHeld: '', recordDate: new Date().toISOString().split('T')[0], tag: '稳健', apy: '', extra: '' }); 
    setTransactions([]);
    setIsDetailMode(false);
    setIsEditing(false); 
    setIsModalOpen(true); 
  };
  
  const openEditModal = (item: any, e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发表格展开
    
    let txs: Transaction[] = [];
    let detailMode = false;
    try {
        if (item.extra && item.extra.trim().startsWith('[')) {
            txs = JSON.parse(item.extra);
            if (txs.length > 0) detailMode = true;
        }
    } catch {}

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
    setTransactions(txs);
    setIsDetailMode(detailMode);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.marketValue) return alert("请至少填写名称和当前市值");
    
    let marketVal = safeNum(formData.marketValue);
    let principal = 0;
    let profit = 0;
    let days = 1;
    let derivedStartDate = '';

    // 如果启用了明细模式，进行加权计算
    if (isDetailMode && transactions.length > 0) {
        // 1. 自动算出总本金
        principal = transactions.reduce((sum, t) => sum + safeNum(t.amount), 0);
        // 2. 自动算出总收益
        profit = marketVal - principal;
        
        // 3. 计算“加权起始日期” (为了兼容 Dashboard 等其他地方的简单天数显示)
        // 逻辑：找到一个虚拟的起始日，使得：总本金 * (今天-虚拟日) = Σ(每笔本金 * (今天-每笔日))
        const now = new Date();
        let weightedCapitalDays = 0;
        transactions.forEach(t => {
            const diff = now.getTime() - new Date(t.date).getTime();
            weightedCapitalDays += safeNum(t.amount) * diff;
        });
        
        if (principal > 0) {
            const averageTimeDiff = weightedCapitalDays / principal; 
            const weightedDateObj = new Date(now.getTime() - averageTimeDiff);
            derivedStartDate = weightedDateObj.toISOString().split('T')[0];
            days = Math.max(1, Math.round(averageTimeDiff / (1000 * 60 * 60 * 24)));
        } else {
            derivedStartDate = new Date().toISOString().split('T')[0];
        }
    } else {
        // 简单模式
        days = safeNum(formData.daysHeld) || 1;
        profit = safeNum(formData.totalProfit);
        principal = marketVal - profit; 
        
        const startDateObj = new Date();
        startDateObj.setDate(startDateObj.getDate() - days);
        derivedStartDate = startDateObj.toISOString().split('T')[0];
    }

    const uniqueCode = formData.code || `FIX_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    // 🔥 将明细序列化存入 extra
    const extraData = JSON.stringify(transactions); 

    const assetData = {
      id: isEditing ? formData.id : undefined,
      code: uniqueCode,
      name: formData.name,
      marketValue: marketVal, costPrice: marketVal, 
      quantity: principal, principal: principal, 
      totalProfit: profit, daysHeld: days, startDate: derivedStartDate,
      recordDate: formData.recordDate, tag: formData.tag, 
      // 优先用填写的年化，没填就用自动算出来的加权年化
      apy: safeNum(formData.apy) || autoCalcInfo.apy,
      extra: extraData, 
      asset_type: 'fixed'
    };
    
    isEditing ? onEdit(assetData) : onAdd(assetData);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 relative max-w-[1600px] mx-auto px-4 pt-2 pb-4">
      
      {/* 顶部统计区 (保持不变) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
           <div className="flex justify-between items-start relative z-10">
             <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center"><Briefcase size={10} className="mr-1"/> 理财总市值</p>
                <div className="text-2xl font-mono font-black tracking-tight">¥{fmt(totals.totalValue)}</div>
             </div>
             <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm"><Wallet size={16} className="text-indigo-200" /></div>
           </div>
           <div className="mt-3 relative z-10"><span className="text-lg font-bold text-slate-200 bg-slate-700/50 px-2 py-1 rounded border border-slate-600">本金: ¥{fmt(totals.totalPrincipal, 0)}</span></div>
        </div>
        <div className={`rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all ${totals.totalProfit >= 0 ? 'bg-gradient-to-br from-rose-500 to-rose-600 text-white' : 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white'}`}>
           <div className="flex justify-between items-start relative z-10">
             <div>
                <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-1">累计总收益</p>
                <div className="text-2xl font-black tracking-tight">{totals.totalProfit >= 0 ? '+' : ''}{fmt(totals.totalProfit)}</div>
             </div>
             <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm"><TrendingUp size={16} className="text-white" /></div>
           </div>
           <div className="mt-3 relative z-10"><span className="text-sm font-bold text-white bg-white/20 px-2 py-1 rounded backdrop-blur-md">总回报率 {fmt(totals.totalRate)}%</span></div>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
           <div className="flex justify-between items-start relative z-10">
             <div>
                <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mb-1 flex items-center"><Zap size={10} className="mr-1 fill-current"/> 明日预计躺赚</p>
                <div className="text-3xl font-black tracking-tight">+{fmt(totals.totalProjectedDaily)}</div>
             </div>
             <div className="absolute right-4 bottom-4 opacity-20"><Calculator size={60} /></div>
           </div>
           <div className="mt-3 relative z-10"><p className="text-sm font-bold text-indigo-50 bg-black/20 w-fit px-2 py-1 rounded">相当于日薪加鸡腿</p></div>
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
                const isExpanded = expandedRows.has(item.id);
                const hasTransactions = item.transactions && item.transactions.length > 0;

                return (
                  <React.Fragment key={item.id}>
                  <tr 
                    className={`transition-colors group text-sm cursor-pointer ${isExpanded ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'}`}
                    onClick={() => toggleRow(item.id)}
                  >
                    {/* 1. 产品列：名字防爆处理 */}
                    <td className="p-4 align-top">
                      <div className="flex flex-col gap-1.5 max-w-[180px]">
                        <div className="flex items-center gap-1">
                            {/* 只有有明细时才显示展开箭头 */}
                            {hasTransactions && (isExpanded ? <ChevronDown size={14} className="text-slate-400"/> : <ChevronRight size={14} className="text-slate-400"/>)}
                            <span className="font-bold text-slate-900 truncate" title={item.name}>{item.name}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 ml-4">
                           <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center">
                             <Tag size={8} className="mr-1"/>{item.tag || '稳健'}
                           </span>
                           {/* 简单展示 extra 的一部分，如果不是 JSON 数组的话 */}
                           {item.extra && !item.extra.startsWith('[') && <span className="text-[10px] text-slate-400 border border-slate-100 px-1 rounded">{item.extra}</span>}
                        </div>
                      </div>
                    </td>

                    {/* 2. 市值 */}
                    <td className="p-4 text-right align-top">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-mono font-bold text-slate-900">¥{fmt(item.marketValue)}</span>
                        <div className="flex items-center justify-end gap-2 w-full max-w-[120px]">
                            <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${positionRatio}%` }}></div></div>
                            <span className="text-[9px] font-bold text-indigo-500">{positionRatio.toFixed(1)}%</span>
                        </div>
                      </div>
                    </td>

                    {/* 3. 总回报 */}
                    <td className="p-4 text-right align-top">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={`font-bold text-lg ${item.totalProfit >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{item.totalProfit >= 0 ? '+' : ''}{fmt(item.totalProfit)}</span>
                        <span className={`text-[10px] font-bold ${item.totalProfit >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{fmt(item.totalRoi)}%</span>
                      </div>
                    </td>

                    {/* 4. 时间 */}
                    <td className="p-4 text-right align-top">
                        <div className="flex flex-col items-end gap-1">
                            <span className="font-bold text-slate-700 flex items-center"><Clock size={12} className="mr-1 text-slate-400"/> {item.daysHeld}天</span>
                            <span className="text-[9px] text-slate-400 flex items-center bg-slate-50 px-1.5 py-0.5 rounded"><CalendarDays size={8} className="mr-1"/> {item.recordDate}</span>
                        </div>
                    </td>

                    {/* 5. 日赚 */}
                    <td className="p-4 text-right align-top">
                        <div className="flex flex-col items-end gap-0.5">
                             <span className="text-base font-mono font-black text-indigo-600">+ {fmt(item.projectedDaily)}</span>
                             <span className="text-[9px] text-indigo-300">按 {fmt(item.calcApy)}% 估算</span>
                        </div>
                    </td>

                    {/* 6. 年化 */}
                    <td className="p-4 text-right align-top">
                        <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1">
                               <span className={`font-bold text-sm ${item.beatsBank ? 'text-rose-500' : 'text-emerald-500'}`}>{fmt(item.calcApy)}%</span>
                               {item.beatsBank ? <ArrowUpRight size={12} className="text-rose-500"/> : <ArrowDownRight size={12} className="text-emerald-500"/>}
                            </div>
                            <span className="text-[9px] text-slate-400">{item.beatsBank ? '跑赢存款' : '跑输存款'}</span>
                        </div>
                    </td>

                    {/* 7. 万份/年收 */}
                    <td className="p-4 text-right align-top">
                        <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] text-slate-600 font-bold bg-slate-100 px-1.5 py-0.5 rounded flex items-center"><Coins size={9} className="mr-1 text-slate-400"/> 万份 {fmt(item.dailyPer10k, 4)}</span>
                            <span className="text-[9px] text-slate-400">年收约 {fmt(item.projectedAnnual, 0)}</span>
                        </div>
                    </td>

                    <td className="p-4 text-center align-top">
                      <div className="flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={(e) => openEditModal(item, e)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit3 size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); if(window.confirm(`确认删除?`)) onDelete(item.id) }} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                  
                  {/* 展开的明细行 - 这里展示每笔买入的具体权重 */}
                  {isExpanded && hasTransactions && (
                      <tr className="bg-indigo-50/30 animate-in slide-in-from-top-2 duration-200">
                          <td colSpan={8} className="p-4 pl-12">
                              <div className="bg-white rounded-xl border border-indigo-100 p-4 shadow-sm">
                                  <div className="flex items-center gap-2 mb-3 text-xs font-bold text-indigo-900">
                                      <History size={14} /> 资金买入明细 (资金加权)
                                  </div>
                                  <div className="grid grid-cols-4 gap-4 text-xs text-slate-500 border-b border-slate-100 pb-2 mb-2">
                                      <div>买入日期</div>
                                      <div>买入金额</div>
                                      <div>持有天数</div>
                                      <div className="text-right">资金权重占比</div>
                                  </div>
                                  {item.transactions.map((t: any, idx: number) => {
                                      const now = new Date();
                                      const days = Math.max(0, Math.round((now.getTime() - new Date(t.date).getTime()) / (1000 * 60 * 60 * 24)));
                                      return (
                                          <div key={idx} className="grid grid-cols-4 gap-4 text-xs font-mono py-1">
                                              <div className="text-slate-700">{t.date}</div>
                                              <div className="font-bold">¥{fmt(t.amount)}</div>
                                              <div>{days} 天</div>
                                              <div className="text-right text-indigo-400">
                                                  {item.principal > 0 ? ((t.amount / item.principal) * 100).toFixed(1) : 0}%
                                              </div>
                                          </div>
                                      );
                                  })}
                                  <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between">
                                      <span>注：当前年化收益率已按每笔资金的实际持有天数精确加权计算。</span>
                                      <span>总本金: ¥{fmt(item.principal)}</span>
                                  </div>
                              </div>
                          </td>
                      </tr>
                  )}
                  </React.Fragment>
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

      {/* 弹窗 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
             <div className="p-6 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-lg font-black text-slate-900">{isEditing ? '更新记录' : '记一笔'}</h3>
                   <div className="flex items-center space-x-2">
                       {/* 模式切换开关 */}
                       <button 
                         onClick={() => setIsDetailMode(!isDetailMode)}
                         className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border ${isDetailMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}
                       >
                           {isDetailMode ? '明细模式' : '简单模式'}
                       </button>
                       <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={18}/></button>
                   </div>
                </div>
                
                <div className="space-y-4">
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">产品名称</label>
                      <input type="text" placeholder="如：招商朝朝宝" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:border-indigo-500 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                   </div>
                   
                   {/* 核心区别：明细模式 vs 简单模式 */}
                   {isDetailMode ? (
                       <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2">
                           <div className="flex justify-between items-center mb-1">
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">买入明细 (自动算本金)</label>
                               <button onClick={addTransaction} className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded hover:text-indigo-600 font-bold flex items-center shadow-sm">
                                   <Plus size={10} className="mr-1"/> 增加一笔
                               </button>
                           </div>
                           <div className="max-h-[150px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                               {transactions.map((t, idx) => (
                                   <div key={idx} className="flex gap-2 items-center">
                                       <input type="date" className="w-1/3 px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500" value={t.date} onChange={e => updateTransaction(idx, 'date', e.target.value)} />
                                       <input type="number" placeholder="金额" className="flex-1 px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 font-mono" value={t.amount} onChange={e => updateTransaction(idx, 'amount', e.target.value)} />
                                       <button onClick={() => removeTransaction(idx)} className="p-1.5 text-slate-400 hover:text-rose-500"><Trash2 size={14}/></button>
                                   </div>
                               ))}
                               {transactions.length === 0 && <div className="text-center text-xs text-slate-400 py-2">点击右上角添加第一笔买入</div>}
                           </div>
                           <div className="text-right text-xs font-bold text-slate-500 pt-1">
                               自动合计本金: <span className="text-indigo-600 font-mono">¥{fmt(transactions.reduce((s,t)=>s+safeNum(t.amount),0))}</span>
                           </div>
                       </div>
                   ) : (
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">已获收益</label>
                            <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:border-indigo-500 outline-none" value={formData.totalProfit} onChange={e => setFormData({...formData, totalProfit: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">持有天数</label>
                            <input type="number" placeholder="APP显示天数" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:border-indigo-500 outline-none" value={formData.daysHeld} onChange={e => setFormData({...formData, daysHeld: e.target.value})} />
                          </div>
                       </div>
                   )}

                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">当前总市值 (本金+收益)</label>
                      <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xl font-bold text-indigo-900 focus:border-indigo-500 outline-none" value={formData.marketValue} onChange={e => setFormData({...formData, marketValue: e.target.value})} />
                   </div>
                   
                   {/* 自动计算结果展示 */}
                   <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex justify-between items-center text-xs">
                        <div>
                           <div className="font-bold text-indigo-800 mb-1">
                               {isDetailMode ? "资金加权年化 (Smart)" : "简单年化估算"}
                           </div>
                           <div className="text-indigo-600 text-lg font-black">{fmt(autoCalcInfo.apy)}%</div>
                        </div>
                        <div className="text-right">
                           <div className="text-indigo-400 mb-1">预计日赚</div>
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