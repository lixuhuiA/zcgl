import React, { useState } from 'react';
import { Lock, ChevronRight, Loader2, ShieldCheck } from 'lucide-react';

// 1. 修改接口定义，与 App.tsx 保持一致
interface LoginProps {
  onLogin: (token: string) => void; 
}

// 2. 解构参数改为 onLogin
const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const res = await fetch('/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || '验证失败');
      }

      // 3. 调用正确的父组件回调
      if (data.access_token) {
        onLogin(data.access_token);
      } else {
        throw new Error('服务器响应格式错误');
      }
      
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err.message || '无法连接服务器，请检查后端状态');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600/30 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-[100px]" />

      <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500 border border-white/20 relative z-10">
        <div className="p-8 pb-6 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-lg shadow-indigo-500/30">
            <ShieldCheck className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">PACC 指挥中心</h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">个人资产私有化管理系统</p>
        </div>

        <form onSubmit={handleLogin} className="p-8 pt-2 space-y-5">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">管理员账号</label>
            <input 
              type="text" 
              value={username}
              readOnly
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-mono text-sm cursor-not-allowed"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">安全密钥</label>
            <div className="relative">
              <div className="absolute left-4 top-3.5 text-slate-400">
                <Lock size={18} />
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-sans text-sm"
                placeholder="请输入密码..."
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl font-bold flex items-center animate-in slide-in-from-top-2">
              <span className="mr-2 text-lg">⚠️</span> {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-xl"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>验证身份中...</span>
              </>
            ) : (
              <>
                <span>解锁系统</span> 
                <ChevronRight size={18} />
              </>
            )}
          </button>
        </form>
        <div className="bg-slate-50 p-4 text-center text-[10px] text-slate-400 font-medium border-t border-slate-100 uppercase tracking-widest">
          Secure Access via FastAPI & SQLite
        </div>
      </div>
    </div>
  );
};

export default Login;