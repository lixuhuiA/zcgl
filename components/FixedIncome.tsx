import React, { useMemo } from 'react';
import { 
  ShieldCheck, 
  TrendingUp, 
  Trash2, 
  Edit3, 
  Calendar,
  DollarSign,
  Briefcase,
  Clock,
  ArrowRight
} from 'lucide-react';
import { FixedIncomeAsset } from '../types';

interface FixedIncomeProps {
  items: FixedIncomeAsset[];
  onDelete: (id: string) => void;
  onEdit: (item: FixedIncomeAsset) => void;
}

const FixedIncome: React.FC<FixedIncomeProps> = ({ items, onDelete, onEdit }) => {
  // 1. 汇总计算
  const totals = useMemo(() => {
    const totalPrincipal = items.reduce((acc, i) => acc + i.principal, 0);
    const dailyIncome = items.reduce((acc, i) => acc + (i.principal * (i.apy / 100) / 365), 0);
    return { totalPrincipal, dailyIncome };
  }, [items]);

  // 2. 空状态
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-[2.5rem] p-20 border border-slate-200 border-dashed flex flex-col items-center justify-center text-slate-400">
        <div className="p-6 bg-slate-50 rounded-full mb-4 text-emerald-500">
          <ShieldCheck size={40} />
        </div>
        <h3 className="text-lg font-black text-slate-900">暂无理财/固收配置</h3>
        <p className="text-sm font-medium mt-2">添加银行存单、货币基金或定期理财，锁定稳健收益</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* 顶部：固收看板 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-emerald-600 rounded-[2rem] p-8 text-white flex items-center justify-between shadow-xl shadow-emerald-900/10">
          <div>
            <p className="text-[10px] font-black uppercase opacity-60 mb-1 tracking-widest">稳健资产总额</p>
            <p className="text-4xl font-mono font-black">¥{totals.totalPrincipal.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md"><Briefcase size={32}/></div>
        </div>
        
        <div className="bg-white rounded-[2rem] p-8 border border-slate-200 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">平均每日收益 (预计)</p>
            <p className="text-4xl font-mono font-black text-emerald-600">
              +¥{totals.dailyIncome.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-400 font-bold mt-1 tracking-wider italic">基于各产品年化收益率计算</p>
          </div>
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <TrendingUp size={32}/>
          </div>
        </div>
      </div>

      {/* 列表容器 */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest">
              <th className="px-8 py-5">项目名称 / 机构</th>
              <th className="px-6 py-5 text-right">年化收益率</th>
              <th className="px-6 py-5 text-right">投入本金</th>
              <th className="px-6 py-5 text-right">起息日期</th>
              <th className="px-6 py-5 text-right">预计日收益</th>
              <th className="px-8 py-5 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {items.map((item) => {
              const itemDaily = (item.principal * (item.apy / 100)) / 365;
              return (
                <tr key={item.id} className="group hover:bg-slate-50/80 transition-all duration-300">
                  <td className="px-8 py-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-8 bg-emerald-500 rounded-full group-hover:h-10 transition-all"></div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 mb-0.5">{item.name}</span>
                        <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                          {item.tag || '稳健资产'}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-6 text-right">
                    <div className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-mono font-black text-xs">
                      {item.apy.toFixed(2)}%
                    </div>
                  </td>

                  <td className="px-6 py-6 text-right">
                    <span className="text-sm font-mono font-black text-slate-900 tracking-tight">
                      ¥{item.principal.toLocaleString()}
                    </span>
                  </td>

                  <td className="px-6 py-6 text-right">
                    <div className="flex items-center justify-end text-[11px] font-bold text-slate-500">
                      <Calendar size={12} className="mr-1.5 opacity-50" />
                      {item.startDate || '实时存取'}
                    </div>
                  </td>

                  <td className="px-6 py-6 text-right">
                    <div className="text-sm font-mono font-black text-emerald-600">
                      +¥{itemDaily.toFixed(2)}
                    </div>
                  </td>

                  <td className="px-8 py-6">
                    <div className="flex items-center justify-center space-x-1">
                      <button
                        onClick={() => onEdit(item)}
                        className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="编辑资产信息"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`确认移除稳健资产：${item.name}？`)) {
                            onDelete(item.id);
                          }
                        }}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        title="彻底移除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 底部引导栏 */}
        <div className="bg-slate-900 px-8 py-6 flex items-center justify-between text-white">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-xs font-black tracking-widest uppercase">固收资产通常作为账户压舱石</p>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5 tracking-tight">
                建议配置比例：30% - 50%，以应对市场剧烈波动
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-[10px] font-black uppercase text-slate-400">
            <span>资产流动性评价</span>
            <div className="flex space-x-1">
              <div className="w-3 h-1 bg-emerald-500 rounded-full"></div>
              <div className="w-3 h-1 bg-emerald-500 rounded-full"></div>
              <div className="w-3 h-1 bg-emerald-500 rounded-full opacity-30"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FixedIncome;