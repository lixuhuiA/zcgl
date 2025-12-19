import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Trash2, 
  Edit3, 
  Layers, 
  DollarSign, 
  Activity, 
  BarChart3,
  Search,
  AlertCircle
} from 'lucide-react';
import { StockAsset } from '../types';

interface StockListProps {
  stocks: StockAsset[];
  onDelete: (id: string) => void;
  onEdit: (stock: StockAsset) => void;
}

const StockList: React.FC<StockListProps> = ({ stocks, onDelete, onEdit }) => {
  // 1. 计算股票总市值与总持仓成本
  const totals = useMemo(() => {
    const marketValue = stocks.reduce((acc, s) => acc + (s.currentPrice * s.quantity), 0);
    const totalCost = stocks.reduce((acc, s) => acc + (s.purchasePrice * s.quantity), 0);
    const totalProfit = marketValue - totalCost;
    return { marketValue, totalCost, totalProfit };
  }, [stocks]);

  // 2. 空状态逻辑：如果没股票，不要只显示表头
  if (stocks.length === 0) {
    return (
      <div className="bg-white rounded-[2.5rem] p-20 border border-slate-200 border-dashed flex flex-col items-center justify-center text-slate-400">
        <div className="p-6 bg-slate-50 rounded-full mb-4">
          <Search size={40} className="text-slate-300" />
        </div>
        <h3 className="text-lg font-black text-slate-900">暂无股票/ETF持仓</h3>
        <p className="text-sm font-medium mt-2">点击上方的“添加资产”按钮开始管理你的财富</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* 顶部：小型的股票概览统计条 (核心功能：一眼看清整体盈亏情况) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 rounded-3xl p-5 text-white flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[10px] font-black uppercase opacity-50 mb-1 tracking-widest">股票账户总额</p>
            <p className="text-xl font-mono font-black">¥{totals.marketValue.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-white/10 rounded-2xl"><Layers size={20} className="text-indigo-400"/></div>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">累计总盈亏</p>
            <p className={`text-xl font-mono font-black ${totals.totalProfit >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {totals.totalProfit >= 0 ? '+' : ''}{totals.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className={`p-3 rounded-2xl ${totals.totalProfit >= 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
            <Activity size={20}/>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">持仓集中度</p>
            <p className="text-xl font-mono font-black text-slate-900">{stocks.length} <span className="text-xs text-slate-400">只标的</span></p>
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl text-slate-400"><BarChart3 size={20}/></div>
        </div>
      </div>

      {/* 股票列表容器 */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">资产名称 / 代码</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">现价 / 成本价</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">今日涨跌</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">持有数量 / 占比</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">市值 / 盈亏</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">操作控制</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stocks.map((stock) => {
                const stockMarketValue = stock.currentPrice * stock.quantity;
                const stockCost = stock.purchasePrice * stock.quantity;
                const stockProfit = stockMarketValue - stockCost;
                const weight = (stockMarketValue / totals.marketValue) * 100;

                return (
                  <tr key={stock.id} className="group hover:bg-slate-50/80 transition-all duration-300">
                    {/* 名称与代码 */}
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 mb-0.5">{stock.name}</span>
                        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 w-fit px-1.5 py-0.5 rounded uppercase tracking-wider">
                          {stock.symbol}
                        </span>
                      </div>
                    </td>

                    {/* 价格对比 */}
                    <td className="px-6 py-6 text-right">
                      <div className="flex flex-col">
                        <span className="text-sm font-mono font-black text-slate-900 tracking-tighter">
                          ¥{stock.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 italic">
                          成本 ¥{stock.purchasePrice.toFixed(2)}
                        </span>
                      </div>
                    </td>

                    {/* 今日涨跌 (核心视觉：实时涨跌幅) */}
                    <td className="px-6 py-6 text-right">
                      <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black font-mono ${
                        stock.changePercent >= 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'
                      }`}>
                        {stock.changePercent >= 0 ? <TrendingUp size={12} className="mr-1"/> : <TrendingDown size={12} className="mr-1"/>}
                        {stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </div>
                    </td>

                    {/* 数量与仓位占比 (核心功能：防止单票满仓) */}
                    <td className="px-6 py-6 text-right">
                      <div className="flex flex-col">
                        <span className="text-sm font-mono font-black text-slate-900">
                          {stock.quantity.toLocaleString()}
                        </span>
                        <div className="w-full flex justify-end mt-1.5">
                           <div className="h-1 bg-slate-100 w-12 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500" style={{ width: `${weight}%` }}></div>
                           </div>
                           <span className="text-[10px] font-black text-indigo-500 ml-2">{weight.toFixed(1)}%</span>
                        </div>
                      </div>
                    </td>

                    {/* 市值与盈亏 */}
                    <td className="px-6 py-6 text-right">
                      <div className="flex flex-col">
                        <span className="text-sm font-mono font-black text-slate-900 tracking-tight">
                          ¥{stockMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        <span className={`text-[11px] font-black ${stockProfit >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {stockProfit >= 0 ? '+' : ''}{stockProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </td>

                    {/* 控制台 (核心功能：浮动交互) */}
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => onEdit(stock)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-200"
                          title="修改参数"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`确定要从持仓中彻底移除 ${stock.name} 吗？`)) {
                              onDelete(stock.id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-200"
                          title="移除资产"
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
        </div>
        
        {/* 底部备注 */}
        <div className="bg-slate-50/80 px-8 py-4 flex items-center space-x-3 border-t border-slate-100">
           <AlertCircle size={14} className="text-slate-400" />
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
             提示：以上涨跌幅及价格由后端接口实时更新，历史盈亏数据在每日收盘后清算同步。
           </p>
        </div>
      </div>
    </div>
  );
};

export default StockList;