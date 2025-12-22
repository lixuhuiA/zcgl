import React from 'react';
import { X, BellRing, AlertTriangle, Send, Loader2 } from 'lucide-react';

interface PushSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  webhook: string;
  setWebhook: (val: string) => void;
  onTest: () => void;
  isLoading?: boolean;
}

const PushSettingsModal: React.FC<PushSettingsModalProps> = ({ 
  isOpen, onClose, webhook, setWebhook, onTest, isLoading 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-10">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><BellRing size={24}/></div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">日报推送设置</h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
              <X size={24} />
            </button>
          </div>
          
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-100 p-5 rounded-3xl flex items-start space-x-3">
              <AlertTriangle className="text-amber-500 shrink-0" size={18} />
              <p className="text-xs text-amber-800 font-bold leading-relaxed">
                请输入企业微信/钉钉机器人的 Webhook 地址。系统将在每日 15:05 自动发送资产纯文本日报。
              </p>
            </div>
            
            <div className="relative">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Webhook 链接
              </label>
              <input 
                type="text" 
                placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." 
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 transition-all font-mono text-xs text-slate-700 break-all" 
                value={webhook} 
                onChange={e => setWebhook(e.target.value)} 
              />
            </div>
            
            <button 
              onClick={onTest} 
              disabled={isLoading || !webhook} 
              className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black shadow-xl shadow-slate-900/20 active:scale-95 transition-all hover:bg-indigo-600 tracking-widest flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>}
              <span>保存配置并发送测试</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PushSettingsModal;