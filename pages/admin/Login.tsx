
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Lock, ArrowRight, ShieldCheck, Loader2, KeyRound } from 'lucide-react';
import { ADMIN_PASSWORD } from '../../constants';

const { useNavigate } = ReactRouterDOM as any;

const Login: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const SCHOOL_NAME = localStorage.getItem('school_name') || "مدرسة عماد الدين زنكي المتوسطة";
  const SCHOOL_LOGO = localStorage.getItem('school_logo') || "https://www.raed.net/img?id=1471924";

  // Check if already logged in
  useEffect(() => {
      const session = localStorage.getItem('ozr_admin_session');
      if (session) {
          navigate('/admin/dashboard', { replace: true });
      }
  }, [navigate]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate network delay for UX
    setTimeout(() => {
        if (password === ADMIN_PASSWORD) {
            localStorage.setItem('ozr_admin_session', 'true');
            navigate('/admin/dashboard', { replace: true });
        } else {
            setError('رمز الدخول غير صحيح');
            setIsLoading(false);
        }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8 font-sans">
      <div className="w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] animate-fade-in border border-slate-100">
        
        {/* Left Side: Visual Identity */}
        <div className="md:w-1/2 bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 relative p-12 flex flex-col justify-between text-white overflow-hidden">
            {/* Abstract Shapes */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 -ml-20 -mb-20"></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>

            <div className="relative z-10">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 mb-6 shadow-lg">
                    <ShieldCheck size={32} className="text-blue-300" />
                </div>
                <h2 className="text-3xl font-extrabold mb-2">بوابة الإدارة المركزية</h2>
                <p className="text-blue-200 text-sm leading-relaxed max-w-xs">
                    لوحة تحكم متكاملة لإدارة العمليات المدرسية، التقارير، والتحليل الذكي للبيانات.
                </p>
            </div>

            <div className="relative z-10 mt-12 md:mt-0">
                <div className="flex items-center gap-4 bg-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                    <img src={SCHOOL_LOGO} alt="School Logo" className="w-12 h-12 object-contain bg-white rounded-full p-1" />
                    <div>
                        <p className="font-bold text-sm">{SCHOOL_NAME}</p>
                        <p className="text-[10px] text-slate-300">نظام الإدارة الذكي v2.0</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="md:w-1/2 p-8 md:p-16 flex flex-col justify-center bg-white relative">
            <div className="max-w-sm mx-auto w-full">
                <div className="mb-10">
                    <h1 className="text-3xl font-extrabold text-slate-900 mb-2">تسجيل الدخول</h1>
                    <p className="text-slate-500 text-sm">أدخل رمز الحماية الخاص بالإدارة للمتابعة.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">رمز الدخول</label>
                        <div className="relative group">
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                className="w-full pl-4 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-50 outline-none transition-all text-lg font-bold text-slate-800 placeholder:text-slate-400 font-mono tracking-widest text-center"
                                placeholder="••••••••"
                                autoFocus
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors bg-white p-1 rounded-lg">
                                <KeyRound size={20} />
                            </div>
                        </div>
                        {error && (
                            <div className="flex items-center gap-2 text-red-500 text-sm font-medium bg-red-50 p-3 rounded-xl animate-fade-in">
                                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                {error}
                            </div>
                        )}
                    </div>

                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 bg-blue-900 text-white rounded-2xl font-bold text-lg hover:bg-blue-800 transition-all shadow-xl shadow-blue-900/20 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : <>الدخول للنظام <ArrowRight size={20} /></>}
                    </button>
                </form>

                <div className="mt-12 text-center border-t border-slate-50 pt-6">
                    <button onClick={() => navigate('/')} className="text-slate-400 hover:text-blue-600 text-sm font-bold transition-colors flex items-center justify-center gap-2 mx-auto group">
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform rotate-180" /> 
                        العودة للرئيسية
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Login;