import React, { useMemo, useState } from 'react';
import { 
  Plus, Trash2, Edit2, Wallet, Calendar, 
  TrendingUp, Clock, PiggyBank, Briefcase, 
  Target, StickyNote, Coins, ArrowUpRight
} from 'lucide-react';
import { FixedAsset } from '../types';

interface FixedIncomeProps {
  items: FixedAsset[];
  onDelete: (code: string) => void;
  onEdit: (asset: any) => void;
  onAdd: (asset: any) => void;
}

const FixedIncome: React.FC<FixedIncomeProps> = ({ items, onDelete, onEdit, onAdd }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editCode, setEditCode] = useState<string | null>(null);

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    principal: '',    // 总投入本金
    currentValue: '', // 当前总市值
    date: '',         // 首次买入日/主要更新日
    type: '稳健',      // 标签
    note: ''          // 备注 (记录加仓情况)
  });

  // --- 1. 核心计算逻辑 ---
  const calculatedItems = useMemo(() => {
    const today = new Date();
    
    return items.map(item => {
      const principal = Number(item.quantity); // quantity 存本金
      // costPrice 存当前市值 (如果没有录入过，暂用本金代替)
      const marketValue = Number(item.costPrice) > 0 ? Number(item.costPrice) : principal;
      
      const totalProfit = marketValue - principal;
      const totalYield = principal > 0 ? (totalProfit / principal) * 100 : 0;

      // 计算持有天数
      let daysHeld = 1; 
      if (item.startDate) {
        const start = new Date(item.startDate);
        const diffTime = Math.abs(today.getTime() - start.getTime());
        daysHeld = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1; 
      }

      // 核心指标 1: 推算年化 (CAGR)
      const annualizedYield = (totalYield / daysHeld) * 365;

      // 核心指标 2: 日均收益 (Daily Earn) - 解决加仓焦虑
      const dailyEarn = totalProfit / daysHeld;

      return {
        ...item,
        marketValue,
        totalProfit,
        totalYield,
        daysHeld,
        annualizedYield,
        dailyEarn
      };
    });
  }, [items]);

  // --- 2. 汇总统计 ---
  const totals = useMemo(() => {
    const totalPrincipal = calculatedItems.reduce((acc, item) => acc + Number(item.quantity), 0);
    const totalValue = calculatedItems.reduce((acc, item) => acc + item.marketValue, 0);
    const totalProfit = totalValue - totalPrincipal;
    const totalYield = totalPrincipal > 0 ? (totalProfit / totalPrincipal) * 100 : 0;
    
    // 总日均收益
    const totalDailyEarn = calculatedItems.reduce((acc, item) => acc + item.dailyEarn, 0);

    return { totalPrincipal, totalProfit, totalValue, totalYield, totalDailyEarn };
  }, [calculatedItems]);

  // --- 交互逻辑 ---
  const openAddModal = () => {
    setIsEditing(false);
    setFormData({ 
      name: '', principal: '', currentValue: '', 
      date: new Date().toISOString().split('T')[0],
      type: '稳健',
      note: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setIsEditing(true);
    setEditCode(item.code);
    setFormData({
      name: item.name,
      principal: item.quantity.toString(),
      currentValue: (item.costPrice || item.quantity).toString(),
      date: item.startDate || '',
      type: item.tag || '稳健',
      note: item.note || '' // 假设后端支持 note 字段，如果不支持也没事，前端暂存
    });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.principal || !formData.currentValue) {
      alert("请完整填写信息");
      return;
    }

    const principal = Number(formData.principal);
    const currentVal = Number(formData.currentValue);

    const assetData = {
      name: formData.name,
      code: isEditing && editCode ? editCode : `WEALTH_${Date.now()}`,
      quantity: principal,     // 本金
      costPrice: currentVal,   // 市值
      startDate: formData.date,
      asset_type: 'fixed',
      tag: formData.type,
      // 这里的 note 如果后端没字段，可以拼接到 name 里或者忽略，暂时先传给后端
      // 建议后端加个 extra 字段存这类信息
      extra: formData.note 
    };

    isEditing ? onEdit(assetData) : onAdd(assetData);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
      
      {/* ======================= 1. 顶部统计区 ======================= */}
      <div className="flex flex-col lg:flex-row gap-4">
        
        {/* 左卡：总市值 */}
        <div className="flex-[1.2] bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden group">
           <div className="absolute right-0 top-0 w-32 h-32 bg-slate-800 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
           <div className="relative z-10 flex justify-between items-start h-full">
             <div>
               <p className="text-[10px] font-black uppercase opacity-60 mb-2 tracking-widest flex items-center">
                 <Briefcase size={12} className="mr-1"/> 理财总市值
               </p>
               <p className="text-3xl font-mono font-black tracking-tight">¥{totals.totalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
               
               <div className="mt-3 flex items-center space-x-2 bg-slate-800/50 w-fit px-3 py-1 rounded-lg backdrop-blur-md border border-slate-700/50">
                  <Wallet size={10} className="text-slate-300"/>
                  <span className="text-[10px] text-slate-200 font-bold">本金: ¥{totals.totalPrincipal.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
               </div>
             </div>
             <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm"><PiggyBank size={24} className="text-slate-200"/></div>
           </div>
        </div>

        {/* 中卡：收益分析 */}
        <div className="flex-1 bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm flex justify-between items-center relative overflow-hidden">
           <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">累计收益 / 日均赚</p>
               <div className={`text-3xl font-black ${totals.totalProfit >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {totals.totalProfit >= 0 ? '+' : ''}{totals.totalProfit.toLocaleString(undefined, {maximumFractionDigits: 2})}
               </div>
               <div className="flex items-center space-x-2 mt-1">
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">总回报 {totals.totalYield.toFixed(2)}%</span>
                  <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded flex items-center">
                     <Coins size={10} className="mr-1"/> 日均 +{totals.totalDailyEarn.toFixed(1)}元
                  </span>
               </div>
           </div>
           <div className={`p-4 rounded-2xl ${totals.totalProfit >= 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
              <TrendingUp size={24} />
           </div>
        </div>

        {/* 右钮：添加 */}
        <button onClick={openAddModal} className="flex-none bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2.5rem] px-8 flex flex-col items-center justify-center transition-all shadow-xl shadow-indigo-600/20 active:scale-95 group min-w-[100px]">
            <div className="p-2.5 bg-white/10 rounded-full mb-1 group-hover:bg-white/20 transition-colors"><Plus size={20} /></div>
            <span className="text-[10px] font-black uppercase tracking-widest">记一笔</span>
        </button>
      </div>

      {/* ======================= 2. 列表区域 ======================= */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
        {/* 顶栏 */}
        <div className="flex flex-col md:flex-row justify-between items-center px-8 py-6 border-b border-slate-100 gap-4">
            <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Briefcase size={20}/></div>
                <div>
                    <h2 className="text-xl font-black text-slate-900">理财资产列表</h2>
                    <p className="text-xs font-bold text-slate-400">{items.length} 笔资产 · <span className="text-indigo-600">净值/市值管理</span></p>
                </div>
            </div>
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">产品名称</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">总投入 / 更新日</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">当前市值 (¥)</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">累计收益 (¥)</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">日均收益 / 年化</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calculatedItems.map((item) => (
                <tr key={item.code} className="hover:bg-indigo-50/30 transition-colors group">
                  
                  {/* 名称 + 标签 + 备注 */}
                  <td className="p-6">
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-2 mb-0.5">
                          <span className="text-sm font-black text-slate-900">{item.name}</span>
                          <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                             {item.tag || '理财'}
                          </span>
                      </div>
                      {/* 显示备注或加仓提示 */}
                      {item.extra ? (
                         <div className="flex items-center text-[10px] text-slate-400">
                            <StickyNote size={10} className="mr-1"/> {item.extra}
                         </div>
                      ) : (
                         <span className="text-[10px] text-slate-400 opacity-50">无备注</span>
                      )}
                    </div>
                  </td>

                  {/* 投入 / 日期 */}
                  <td className="p-6 text-right">
                    <div className="flex flex-col items-end">
                       <span className="text-sm font-mono font-bold text-slate-700">¥{Number(item.quantity).toLocaleString()}</span>
                       <span className="text-[10px] font-bold text-slate-400 flex items-center mt-0.5">
                          <Clock size={10} className="mr-1"/> {item.startDate} ({item.daysHeld}天)
                       </span>
                    </div>
                  </td>

                  {/* 当前市值 */}
                  <td className="p-6 text-right">
                     <span className="text-sm font-mono font-black text-slate-900">¥{item.marketValue.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                  </td>

                  {/* 累计收益 */}
                  <td className="p-6 text-right">
                    <div className="flex flex-col items-end">
                      <span className={`text-sm font-black ${item.totalProfit >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {item.totalProfit >= 0 ? '+' : ''}{item.totalProfit.toLocaleString(undefined, {maximumFractionDigits: 2})}
                      </span>
                      <span className={`text-[10px] font-bold ${item.totalProfit >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                         回报率 {item.totalYield.toFixed(2)}%
                      </span>
                    </div>
                  </td>

                  {/* 🔥核心指标：日均 + 年化 */}
                  <td className="p-6 text-right">
                    <div className="flex flex-col items-end">
                        <span className={`text-sm font-black ${item.dailyEarn >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                           {item.dailyEarn >= 0 ? '+' : ''}{item.dailyEarn.toFixed(2)} /天
                        </span>
                        <div className="flex items-center mt-0.5 space-x-1">
                            <Target size={10} className="text-slate-400" />
                            <span className="text-[10px] font-bold text-slate-500">
                               年化 {item.annualizedYield.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                  </td>

                  {/* 操作 */}
                  <td className="p-6 text-right">
                    <div className="flex items-center justify-center space-x-2 opacity-50 group-hover:opacity-100 transition-all">
                      <button onClick={() => openEditModal(item)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl"><Edit2 size={16} /></button>
                      <button onClick={() => { if(window.confirm(`确认删除 ${item.name}?`)) onDelete(item.code) }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="py-20 text-center text-slate-400 font-bold">暂无理财记录</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🟢 弹窗：录入市值 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-900 flex items-center">
                   {isEditing ? '更新资产' : '记一笔'}
                </h2>
                <div className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Wealth Management</div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-400 ml-1 uppercase">产品名称</label>
                <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none focus:border-indigo-500 transition-colors mt-1" placeholder="例如：招商朝朝宝" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 ml-1 uppercase">总投入本金 (¥)</label>
                <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none focus:border-indigo-500 transition-colors mt-1" type="number" placeholder="0.00" value={formData.principal} onChange={e => setFormData({...formData, principal: e.target.value})} />
                <p className="text-[9px] text-slate-400 mt-1 ml-1 font-bold text-indigo-500">* 如果加仓了，请在这里把本金金额累加！</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 ml-1 uppercase">当前总市值 (¥)</label>
                <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none focus:border-indigo-500 transition-colors mt-1" type="number" placeholder="APP上显示的当前总金额" value={formData.currentValue} onChange={e => setFormData({...formData, currentValue: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs font-bold text-slate-400 ml-1 uppercase">首次买入日期</label>
                    <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none focus:border-indigo-500 transition-colors mt-1" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-400 ml-1 uppercase">类型标签</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none focus:border-indigo-500 transition-colors mt-1" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                        <option value="稳健">稳健 R2</option>
                        <option value="平衡">平衡 R3</option>
                        <option value="激进">激进 R4</option>
                        <option value="黄金">黄金</option>
                        <option value="国债">国债</option>
                    </select>
                 </div>
              </div>

              <div>
                 <label className="text-xs font-bold text-slate-400 ml-1 uppercase">备注 (选填)</label>
                 <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none focus:border-indigo-500 transition-colors mt-1" placeholder="例如：1月买1w，6月加2w" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} />
              </div>
            </div>

            <div className="flex space-x-3 mt-8">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3.5 rounded-xl font-bold text-slate-500 bg-slate-50 hover:bg-slate-100">取消</button>
              <button onClick={handleSubmit} className="flex-1 py-3.5 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95 transition-all">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FixedIncome; 