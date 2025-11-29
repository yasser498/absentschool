import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Lock, ArrowRight, KeyRound, Loader2 } from 'lucide-react';
import { authenticateStaff } from '../../services/storage';

const { useNavigate } = ReactRouterDOM as any;

const StaffLogin: React.FC = () => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

  const SCHOOL_LOGO = "https://www.raed.net/img?id=1471924";

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-amber-500"></div>
        <div className="text-center mb-10">
          <div className="w-24 h-24 bg-white border border-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg p-2 ring-4 ring-slate-50">
            <img src={SCHOOL_LOGO} alt="School Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">بوابة المعلمين</h1>
          <p className="text-slate-500 mt-2 text-sm">أدخل الرمز السري للوصول لقوائم الفصول</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700">رمز الدخول</label>
            <div className="relative">
              <input 
                type="password" 
                value={passcode}
                onChange={(e) => { setPasscode(e.target.value); setError(''); }}
                className="w-full p-4 pl-12 border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:ring-0 outline-none text-slate-800 transition-colors text-center text-xl tracking-widest placeholder:tracking-normal font-mono"
                placeholder="****"
                autoFocus
                disabled={loading}
              />
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            </div>
            {error && <p className="text-red-500 text-sm text-center font-medium bg-red-50 py-2 rounded-lg">{error}</p>}
          </div>

          <button 
            type="submit"
            disabled={loading}
            className={`w-full py-4 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all hover:shadow-xl shadow-slate-900/20 text-lg flex items-center justify-center gap-2
              ${loading ? 'opacity-70 cursor-not-allowed' : ''}
            `}
          >
            {loading ? <Loader2 className="animate-spin" /> : 'دخول للنظام'}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-100 pt-6">
           <button onClick={() => navigate('/')} className="text-slate-500 hover:text-slate-800 text-sm flex items-center justify-center gap-2 w-full transition-colors font-medium">
             <ArrowRight size={16}/> العودة للصفحة الرئيسية
           </button>
        </div>
      </div>
    </div>
  );
};

export default StaffLogin;