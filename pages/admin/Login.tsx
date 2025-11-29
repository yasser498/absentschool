import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
import { ADMIN_PASSWORD } from '../../constants';

const { useNavigate } = ReactRouterDOM as any;

const Login: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Check if already logged in
  useEffect(() => {
      const session = localStorage.getItem('ozr_admin_session');
      if (session) {
          navigate('/admin/dashboard', { replace: true });
      }
  }, [navigate]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem('ozr_admin_session', 'true');
      navigate('/admin/dashboard', { replace: true });
    } else {
      setError('كلمة المرور غير صحيحة');
    }
  };

  const SCHOOL_LOGO = "https://www.raed.net/img?id=1471924";

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-blue-900"></div>
        <div className="text-center mb-10">
          <div className="w-24 h-24 bg-white border border-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg p-2 ring-4 ring-slate-50">
            <img src={SCHOOL_LOGO} alt="School Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-blue-900">إدارة متوسطة عماد الدين زنكي</h1>
          <p className="text-slate-500 mt-2 text-sm">بوابة الدخول الرسمية للإدارة</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700">رمز الدخول السري</label>
            <div className="relative">
              <input 
                type="password" 
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                className="w-full p-4 pl-12 border-2 border-slate-200 rounded-xl focus:border-blue-900 focus:ring-0 outline-none text-center text-xl tracking-[0.5em] font-mono text-slate-800 transition-colors placeholder:text-slate-300 placeholder:tracking-normal placeholder:font-sans"
                placeholder="••••••••"
                autoFocus
              />
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            </div>
            {error && <p className="text-red-500 text-sm text-center font-medium bg-red-50 py-1 rounded-lg">{error}</p>}
          </div>

          <button 
            type="submit"
            className="w-full py-4 bg-blue-900 text-white rounded-xl font-bold hover:bg-blue-800 transition-all hover:shadow-xl shadow-blue-900/20 text-lg"
          >
            دخول للنظام
          </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-100 pt-6">
           <button onClick={() => navigate('/')} className="text-slate-500 hover:text-blue-900 text-sm flex items-center justify-center gap-2 w-full transition-colors font-medium">
             <ArrowRight size={16}/> العودة للصفحة الرئيسية
           </button>
        </div>
      </div>
    </div>
  );
};

export default Login;