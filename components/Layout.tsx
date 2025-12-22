import React, { useState } from 'react';
import { 
  LayoutDashboard, TrendingUp, PieChart, ShieldCheck, History, 
  Menu, Bell, UserCircle, Loader2, RefreshCw, ChevronRight, LogOut
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  onRefresh: () => void;
  onOpenNotifySettings: () => void;
  onLogout: () => void;
  dataSource: 'sina' | 'tencent';
  setDataSource: (s: 'sina' | 'tencent') => void;
  isSyncing: boolean;
  lastSyncTime: string;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, onRefresh, onOpenNotifySettings, onLogout,
  dataSource, setDataSource, isSyncing, lastSyncTime
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // 根据当前 URL 路径判断哪个 Tab 应该是激活状态
  const getActiveTab = () => {
    // 移除 URL 开头的 / (例如 /fixed-income 变成 fixed-income)
    const path = location.pathname.substring(1); 
    if (path === '' || path === 'dashboard') return 'dashboard';
    return path;
  };
  const activeTab = getActiveTab();

  const navItems = [
    { id: 'dashboard', label: '总览仪表盘', icon: LayoutDashboard },
    { id: 'stocks', label: '股票/ETF持仓', icon: TrendingUp },
    { id: 'funds', label: '场外基金持仓', icon: PieChart },
    // 👇👇👇 核心修复：这里 ID 改成了 fixed-income，和路由完美对应 👇👇👇
    { id: 'fixed-income', label: '理财/固收', icon: ShieldCheck },
    { id: 'history', label: '交易记录', icon: History }, 
  ];

  const handleNavClick = (id: string) => {
    navigate(`/${id}`); // 这样就会跳转到 /fixed-income
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* 侧边栏 Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 shadow-2xl flex flex-col`}>
        {/* Logo 区域 */}
        <div className="p-6 flex items-center space-x-3 border-b border-slate-800 shrink-0">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="font-black text-lg">M</span>
          </div>
          <span className="text-xl font-black tracking-tighter uppercase">MyAsset</span>
        </div>

        {/* 导航菜单 */}
        <nav className="p-4 space-y-1.5 mt-4 flex-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-200 group ${
                activeTab === item.id 
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/40' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <item.icon size={20} />
                <span className="font-bold text-sm">{item.label}</span>
              </div>
              {activeTab === item.id && <ChevronRight size={14} />}
            </button>
          ))}
        </nav>

        {/* 底部功能区 */}
        <div className="p-4 space-y-2 border-t border-slate-800 bg-slate-900/50 backdrop-blur shrink-0">
          <button onClick={onOpenNotifySettings} className="flex items-center space-x-3 text-slate-400 hover:text-white transition-colors px-4 py-3 w-full rounded-xl hover:bg-slate-800">
            <Bell size={18} />
            <span className="text-sm font-bold">推送配置</span>
          </button>
          
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
             <div className="flex items-center space-x-3 text-slate-300">
                <UserCircle size={20} className="text-indigo-400" />
                <span className="text-xs font-bold tracking-wide">管理员</span>
             </div>
             <button onClick={onLogout} title="退出登录" className="text-slate-500 hover:text-rose-400 transition-colors">
                <LogOut size={16} />
             </button>
          </div>
        </div>
      </aside>

      {/* 主内容区域 Main Content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen transition-all duration-300">
        
        {/* 顶部 Header */}
        <header className="bg-white h-20 border-b border-slate-200 flex items-center justify-between px-6 md:px-10 sticky top-0 z-40 shadow-sm">
          <div className="flex items-center">
            {/* 移动端菜单开关 */}
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg mr-4">
              <Menu size={24} />
            </button>
            {/* 当前版块标题 */}
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none mb-1">当前版块</span>
              <h2 className="text-xl font-black text-slate-900 leading-none">
                {navItems.find(i => i.id === activeTab)?.label || '仪表盘'}
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-4 md:space-x-8">
             {/* 数据源切换按钮 */}
             <div className="hidden md:flex bg-slate-100 p-1.5 rounded-2xl items-center border border-slate-200 shadow-inner">
                <button 
                  onClick={() => setDataSource('sina')} 
                  className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all duration-300 ${
                    dataSource === 'sina' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  新浪
                </button>
                <button 
                  onClick={() => setDataSource('tencent')} 
                  className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all duration-300 ${
                    dataSource === 'tencent' ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  腾讯
                </button>
             </div>

             {/* 同步状态展示 */}
             <div className="flex items-center space-x-4 bg-slate-50 px-6 py-2.5 rounded-2xl border border-slate-200 group">
                 <div className="flex items-center space-x-3">
                   {isSyncing ? (
                      <Loader2 size={20} className="animate-spin text-indigo-500" />
                   ) : (
                      <div className="relative">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
                      </div>
                   )}
                   <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">最后同步</span>
                      <span className="text-xs font-mono font-bold text-slate-700 leading-none">
                        {lastSyncTime || '等待数据...'}
                      </span>
                   </div>
                 </div>
                 <div className="w-px h-6 bg-slate-200"></div>
                 <button 
                   onClick={onRefresh} 
                   className={`text-slate-400 hover:text-indigo-600 transition-all duration-500 ${isSyncing ? 'rotate-180' : 'hover:rotate-180'}`}
                 >
                    <RefreshCw size={20} />
                 </button>
             </div>
          </div>
        </header>

        {/* 内容容器 */}
        <div className="flex-1 p-6 md:p-10 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;