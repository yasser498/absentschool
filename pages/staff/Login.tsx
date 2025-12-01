
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Lock, ArrowRight, KeyRound, Loader2, Briefcase } from 'lucide-react';
import { authenticateStaff } from '../../services/storage';

const { useNavigate } = ReactRouterDOM as any;

const StaffLogin: React.FC = () => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const SCHOOL_NAME = localStorage.getItem('school_name') || "متوسطة عماد الدين زنكي";
  const SCHOOL_LOGO = localStorage.getItem('school_logo') || "https://www.raed.net/img?id=1471924";

  // Check if already logged in
  useEffect(() => {
      const session = localStorage.getItem('ozr_staff_session');
      if (session) {
          navigate('/staff/home', { replace: true });
      }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Simulate slight network delay for better UX feel
      await new Promise(resolve => setTimeout(resolve, 600));
      const user = await authenticateStaff(passcode);
      if (user) {
        localStorage.setItem('ozr_staff_session', JSON.stringify(user));
        navigate('/staff/home', { replace: true });
      } else {
        setError('رمز الدخول غير صحيح');
      }
    } catch (e) {
      setError('حدث خطأ في الاتصال، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-10"></div>
          <div className="absolute top-1/2 -right-20 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-10"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
          {/* Logo Area */}
          <div className="text-center mb-8 animate-fade-in-up">
              <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl mx-auto mb-6 flex items-center justify-center p-4 border border-slate-100 rotate-3 hover:rotate-0 transition-transform duration-500">
                  <img src={SCHOOL_LOGO} alt="School Logo" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-800">بوابة المنسوبين</h1>
              <p className="text-slate-500 text-sm mt-1">تسجيل دخول المعلمين والإداريين</p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-8 md:p-10 animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-teal-600"></div>
              
              <div className="flex items-center gap-3 mb-8 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                  <div className="bg-white p-2 rounded-xl text-emerald-600 shadow-sm">
                      <Briefcase size={20} />
                  </div>
                  <div>
                      <p className="text-xs font-bold text-emerald-800 uppercase">منطقة آمنة</p>
                      <p className="text-[10px] text-emerald-600">يرجى استخدام الرمز الشخصي المسند إليك</p>
                  </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block text-center">أدخل الرمز السري</label>
                      <div className="relative">
                          <input 
                              type="password" 
                              value={passcode}
                              onChange={(e) => { setPasscode(e.target.value); setError(''); }}
                              className="w-full py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 outline-none transition-all text-center text-3xl font-bold text-slate-800 tracking-[0.5em] font-mono placeholder:text-slate-300 placeholder:tracking-normal placeholder:font-sans shadow-inner"
                              placeholder="••••"
                              maxLength={8}
                              autoFocus
                              disabled={loading}
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
                              <KeyRound size={20} />
                          </div>
                      </div>
                      {error && (
                          <p className="text-red-500 text-xs font-bold text-center bg-red-50 py-2 rounded-lg animate-pulse">
                              {error}
                          </p>
                      )}
                  </div>

                  <button 
                      type="submit"
                      disabled={loading || !passcode}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all hover:shadow-xl hover:-translate-y-1 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                  >
                      {loading ? <Loader2 className="animate-spin" /> : 'تأكيد الدخول'}
                  </button>
              </form>
          </div>

          <div className="mt-8 text-center">
             <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-600 text-sm font-bold flex items-center justify-center gap-2 w-full transition-colors">
               <ArrowRight size={16}/> العودة للصفحة الرئيسية
             </button>
          </div>
      </div>
    </div>
  );
};

export default StaffLogin;
