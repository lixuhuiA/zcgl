import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import StockList from './components/StockList';
import FundList from './components/FundList';
import FixedIncome from './components/FixedIncome';
import Login from './components/Login';
import PushSettingsModal from './components/PushSettingsModal';

const App: React.FC = () => {
  // --- 1. 全局状态定义 ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem('pacc_token'));
  
  // 核心资产数据
  const [stocks, setStocks] = useState<any[]>([]);
  const [funds, setFunds] = useState<any[]>([]);
  const [fixedIncome, setFixedIncome] = useState<any[]>([]);
  
  // 界面交互状态
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isPushTesting, setIsPushTesting] = useState(false);
  
  // 行情同步状态
  const [dataSource, setDataSource] = useState<'sina' | 'tencent'>('sina');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('');

  // 监听 Token 变化
  useEffect(() => {
    if (token) {
      setIsAuthenticated(true);
      const savedWebhook = localStorage.getItem('pacc_webhook_url');
      if (savedWebhook) setWebhookUrl(savedWebhook);
    }
  }, [token]);

  // --- 2. 核心逻辑：获取资产列表 (包含字段翻译层) ---
  const fetchAssets = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch('/api/assets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        
        // [股票] 数据清洗与映射
        const safeStocks = data.stocks.map((item: any) => ({
          ...item,
          costPrice: item.cost_price ?? item.costPrice ?? 0,
          quantity: item.quantity ?? 0,
          currentPrice: 0, // 初始为0，等行情刷新
          changePercent: 0,
          name: item.name || "未知标的"
        }));

        // [基金] 数据清洗与映射
        const safeFunds = data.funds.map((item: any) => ({
          ...item,
          costPrice: item.cost_price ?? item.costPrice ?? 0,
          shares: item.quantity ?? 0,
          quantity: item.quantity ?? 0,
          netValue: 0, 
          estimatedChange: 0,
          name: item.name || "未知基金"
        }));
        
        // [固收/理财] 数据清洗
        const safeFixed = data.fixed_income.map((item: any) => ({
          ...item,
          quantity: item.quantity ?? 0, // 本金
          apy: item.apy ?? 0,           // 利率
          startDate: item.start_date ?? item.startDate ?? '',
          tag: item.tag || 'deposit',   // 默认为存款模式
          costPrice: item.cost_price ?? 0, // 用户输入市值
          // 🔴 关键修复点 1：必须把后端传回来的 extra (明细) 存下来，否则页面怎么显示？
          extra: item.extra || ''       
        }));

        setStocks(safeStocks);
        setFunds(safeFunds);
        setFixedIncome(safeFixed);
        
        // 立即触发一次行情刷新
        requestAnimationFrame(() => {
            fetchMarketData();
        });
      }
    } catch (e) {
      console.error("Fetch assets failed", e);
    }
  }, [token]);

  // --- 3. 核心逻辑：刷新行情 (仅针对股票和基金) ---
  const fetchMarketData = useCallback(async () => {
    if (!token) return;
    
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/market/refresh?source=${dataSource}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const market = await res.json();
        
        // 更新股票
        setStocks(prevStocks => prevStocks.map(s => {
          const m = market.stocks[s.code];
          if (m) {
            return { 
              ...s, 
              currentPrice: m.price, 
              changePercent: m.change 
            };
          }
          return s;
        }));

        // 更新基金
        setFunds(prevFunds => prevFunds.map(f => {
          const m = market.funds[f.code];
          if (m) {
            return { 
              ...f, 
              netValue: m.price || m.nav, 
              estimatedChange: m.change,
              navDate: m.navDate
            };
          }
          return f;
        }));
        
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        setLastSyncTime(timeStr);
      }
    } catch (e) {
      console.error("Market refresh failed", e);
    } finally {
      setIsSyncing(false);
    }
  }, [token, dataSource]);

  // --- 4. 自动轮询机制 ---
  useEffect(() => {
    if (isAuthenticated) {
      fetchAssets();
      const intervalId = setInterval(() => {
        fetchMarketData();
      }, 10000); // 10秒刷新一次股票基金行情
      return () => clearInterval(intervalId);
    }
  }, [isAuthenticated, fetchAssets, fetchMarketData]);

  // --- 5. 数据处理辅助函数 (Payload Builder) ---
  const preparePayload = (asset: any) => {
    return {
      name: asset.name,
      code: asset.code,
      tag: asset.tag || '稳健',
      asset_type: asset.asset_type,
      
      // 价格翻译
      cost_price: Number(asset.costPrice ?? 0),
      
      // 数量翻译
      quantity: Number(asset.quantity ?? asset.shares ?? 0),
      
      // 日期翻译
      start_date: asset.startDate ?? null,
      
      // 收益率
      apy: Number(asset.apy ?? 0),

      // 🔴 关键修复点 2：发送请求时，必须把 extra (明细) 带上！
      // 之前就是因为缺了这行，导致你填了明细发不出去。
      extra: asset.extra || null
    };
  };

  // --- 6. CRUD 操作处理函数 ---

  const handleAddAsset = async (asset: any) => {
    try {
      const payload = preparePayload(asset);
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        fetchAssets(); // 刷新列表
      } else {
        alert("添加失败，请检查代码是否重复");
      }
    } catch (e) {
      console.error(e);
      alert("网络错误");
    }
  };

  const handleEditAsset = async (asset: any) => {
    if(!token) return;
    try {
      const payload = preparePayload(asset);
      // 注意：后端通常用 code 作为标识更新
      const res = await fetch(`/api/assets/${asset.code}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        fetchAssets(); // 刷新列表
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteAsset = async (id: number | string) => { // 兼容 string 和 number
    if (!window.confirm("确认删除吗？")) return;

    try {
      // 注意：这里用 id 删除更安全
      const res = await fetch(`/api/assets/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        fetchAssets(); // 刷新列表
      } else {
        alert("删除失败");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- 7. 推送测试逻辑 ---
  const handlePushTest = async () => {
    setIsPushTesting(true);
    try {
      await fetch('/api/config/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ webhook_url: webhookUrl })
      });
      localStorage.setItem('pacc_webhook_url', webhookUrl);
      
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) alert("✅ 推送指令已发送");
      else alert("❌ 发送失败");
      
    } catch (e) { 
        alert("❌ 网络错误"); 
    } finally { 
        setIsPushTesting(false); 
        setIsPushModalOpen(false); 
    }
  };

  const handleLogout = () => {
    setToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('pacc_token');
  };

  // --- 8. 渲染逻辑 ---

  if (!isAuthenticated) {
    return <Login onLogin={(t) => { 
        setToken(t); 
        localStorage.setItem('pacc_token', t); 
    }} />;
  }

  return (
    <Router>
      <Layout 
        onRefresh={() => fetchMarketData()}
        onOpenNotifySettings={() => setIsPushModalOpen(true)}
        onLogout={handleLogout}
        dataSource={dataSource}
        setDataSource={setDataSource}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          <Route 
            path="/dashboard" 
            element={
                <Dashboard 
                    customStocks={stocks} 
                    customFunds={funds} 
                    fixedIncome={fixedIncome} 
                />
            } 
          />
          
          <Route 
            path="/stocks" 
            element={
                <StockList 
                    stocks={stocks} 
                    onDelete={handleDeleteAsset} 
                    onEdit={handleEditAsset} 
                    onAdd={handleAddAsset} 
                />
            } 
          />
          
          <Route 
            path="/funds" 
            element={
                <FundList 
                    funds={funds} 
                    onDelete={handleDeleteAsset} 
                    onEdit={handleEditAsset} 
                    onAdd={handleAddAsset} 
                />
            } 
          />
          
          {/* ⚠️ 核心路由：理财页面 */}
          <Route 
            path="/fixed-income" 
            element={
                <FixedIncome 
                    items={fixedIncome} 
                    onDelete={handleDeleteAsset} 
                    onEdit={handleEditAsset} 
                    onAdd={handleAddAsset} 
                />
            } 
          />
          
          {/* 兜底跳转 */}
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
        
        <PushSettingsModal 
          isOpen={isPushModalOpen}
          onClose={() => setIsPushModalOpen(false)}
          webhook={webhookUrl}
          setWebhook={setWebhookUrl}
          onTest={handlePushTest}
          isLoading={isPushTesting}
        />
      </Layout>
    </Router>
  );
};

export default App;