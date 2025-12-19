import React, { useState, useCallback, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import StockList from './components/StockList';
import FundList from './components/FundList';
import FixedIncome from './components/FixedIncome';
import Login from './components/Login';
import { StockAsset, FundAsset, FixedIncomeAsset } from './types';
import { Send, X, AlertTriangle, BellRing } from 'lucide-react';

const API_BASE = ''; 

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('pacc_token'));
  
  // 全局核心状态
  const [dataSource, setDataSource] = useState<'sina' | 'tencent'>('sina');
  const [stocks, setStocks] = useState<StockAsset[]>([]);
  const [funds, setFunds] = useState<FundAsset[]>([]);
  const [fixedIncome, setFixedIncome] = useState<FixedIncomeAsset[]>([]);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [notifyConfig, setNotifyConfig] = useState({ webhook: '', isOpen: false });

  const handleLoginSuccess = (newToken: string) => {
    localStorage.setItem('pacc_token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('pacc_token');
    setToken(null);
  };

  // 1. 获取所有持仓数据 (基础本金/份额)
  const fetchAllData = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/assets`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (res.status === 401) { logout(); return; }
      const data = await res.json();
      
      // 这里的映射逻辑必须与后端的 Asset 字段严格对应
      setStocks(data.stocks.map((s: any) => ({ 
        ...s, id: String(s.id), currentPrice: s.costPrice, changePercent: 0 
      })));
      setFunds(data.funds.map((f: any) => ({ 
        ...f, id: String(f.id), shares: f.quantity, netValue: f.costPrice, estimatedChange: 0 
      })));
      setFixedIncome(data.fixed_income.map((i: any) => ({ 
        ...i, id: String(i.id), principal: i.quantity 
      })));
    } catch (e) {
      console.error("数据加载异常:", e);
    }
  }, [token]);

  useEffect(() => { if (token) fetchAllData(); }, [token, fetchAllData]);

  // 2. 核心行情同步逻辑 (通过选定的数据源：新浪/腾讯)
  const syncRealMarketData = useCallback(async () => {
    if (!token) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/api/market/refresh?source=${dataSource}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const market = await res.json();
      
      // 更新股票/ETF实时行情
      setStocks(prev => prev.map(s => {
        const m = market.stocks[s.code];
        return m ? { ...s, currentPrice: m.price, changePercent: m.change } : s;
      }));

      // 更新基金实时估值
      setFunds(prev => prev.map(f => {
        const m = market.funds[f.code];
        return m ? { ...f, netValue: m.nav, estimatedChange: m.change } : f;
      }));
      
      setLastSyncTime(market.timestamp);
    } catch (error) {
      console.error("行情同步错误:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [token, dataSource]);

  // 设定定时任务：每8秒同步一次最新价格
  useEffect(() => {
    if (!token) return;
    syncRealMarketData();
    const timer = setInterval(syncRealMarketData, 8000);
    return () => clearInterval(timer);
  }, [token, dataSource, syncRealMarketData]);

  // --- 持仓管理核心交互 ---

  // 【添加/加仓】：POST 请求
  const saveAsset = async (type: string, asset: any) => {
    try {
      const res = await fetch(`${API_BASE}/api/assets`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_type: type,
          name: asset.name,
          code: asset.code,
          quantity: Number(asset.quantity || asset.shares || 0),
          cost_price: Number(asset.costPrice || asset.netValue || 0),
          tag: asset.tag || '进攻',
          start_date: asset.startDate,
          apy: Number(asset.apy || 0)
        })
      });
      if (res.ok) fetchAllData();
    } catch (e) { alert("保存失败"); }
  };

  // 【修正/编辑】：PUT 请求 (对应 pencil 铅笔图标)
  const handleEditAsset = async (type: string, asset: any) => {
    try {
      const res = await fetch(`${API_BASE}/api/assets/${asset.code}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          asset_type: type,
          name: asset.name,
          code: asset.code,
          quantity: Number(asset.quantity || asset.shares || 0),
          cost_price: Number(asset.costPrice || asset.netValue || 0),
          tag: asset.tag || '已修正',
        })
      });
      if (res.ok) {
        fetchAllData();
        // 提示用户修正成功
        console.log("持仓成本修正成功");
      }
    } catch (e) { alert("修正失败"); }
  };

  // 【物理删除】：DELETE 请求 (对应 trash 垃圾桶图标)
  const handleDeleteAsset = async (code: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/assets/${code}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchAllData();
    } catch (e) { alert("删除失败"); }
  };

  // 推送测试与配置保存
  const handlePushTest = async () => {
    if (!notifyConfig.webhook) return;
    try {
      // 保存 Webhook 到系统配置表
      await fetch(`${API_BASE}/api/config/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ webhook_url: notifyConfig.webhook })
      });
      // 触发一次即时推送测试
      await fetch(`${API_BASE}/api/push/test`, { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      alert("推送测试已发起，请在客户端查看收到的 Markdown 报表");
      setNotifyConfig({ ...notifyConfig, isOpen: false });
    } catch (e) { alert("配置保存或推送失败"); }
  };

  if (!token) return <Login onLoginSuccess={handleLoginSuccess} />;

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      onRefresh={syncRealMarketData}
      onOpenNotifySettings={() => setNotifyConfig({ ...notifyConfig, isOpen: true })}
      dataSource={dataSource}
      setDataSource={setDataSource}
      isSyncing={isSyncing}
      lastSyncTime={lastSyncTime}
    >
      {/* 视图分发器 */}
      {activeTab === 'dashboard' && (
        <Dashboard customStocks={stocks} customFunds={funds} fixedIncome={fixedIncome} />
      )}
      
      {activeTab === 'stocks' && (
        <StockList 
          stocks={stocks} 
          onAdd={(a) => saveAsset('stock', a)} 
          onDelete={handleDeleteAsset}
          onEdit={(a) => handleEditAsset('stock', a)}
        />
      )}
      
      {activeTab === 'funds' && (
        <FundList 
          funds={funds} 
          onAdd={(a) => saveAsset('fund', a)} 
          onDelete={handleDeleteAsset}
          onEdit={(a) => handleEditAsset('fund', a)}
        />
      )}
      
      {activeTab === 'fixed' && (
        <FixedIncome 
          items={fixedIncome} 
          onAdd={(a) => saveAsset('fixed', a)} 
          onDelete={handleDeleteAsset}
          onEdit={(a) => handleEditAsset('fixed', a)}
        />
      )}
      
      {/* 侧边栏触发的全局配置弹窗 */}
      {notifyConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
            <div className="p-10">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><BellRing size={24}/></div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">日报推送设置</h3>
                </div>
                <button onClick={() => setNotifyConfig({...notifyConfig, isOpen: false})} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-6">
                <div className="bg-amber-50 border border-amber-100 p-5 rounded-3xl flex items-start space-x-3">
                  <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                  <p className="text-xs text-amber-800 font-bold leading-relaxed">
                    请输入企业微信或钉钉机器人的 Webhook 地址。系统将在每日下午 15:05 自动推送资产汇总日报到您的客户端。
                  </p>
                </div>
                <div className="relative">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">机器人 Webhook 链接</label>
                  <input 
                    type="text" 
                    placeholder="https://qyapi.weixin.qq.com/..." 
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 transition-all font-mono text-xs text-slate-700" 
                    value={notifyConfig.webhook} 
                    onChange={e => setNotifyConfig({...notifyConfig, webhook: e.target.value})} 
                  />
                </div>
                <button onClick={handlePushTest} className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black shadow-xl shadow-slate-900/20 active:scale-95 transition-all hover:bg-indigo-600 tracking-widest flex items-center justify-center space-x-2">
                  <Send size={18}/>
                  <span>保存配置并发送测试</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;