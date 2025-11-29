
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, MessageSquare, BookUser, BarChart2, ShieldCheck, LogOut, Briefcase, FileText } from 'lucide-react';
import { StaffUser } from '../../types';

const StaffHome: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<StaffUser | null>(null);

  useEffect(() => {
    const session = localStorage.getItem('ozr_staff_session');
    if (!session) {
      navigate('/staff/login');
      return;
    }
    const userData = JSON.parse(session);
    setUser(userData);

    // --- Smart Redirection Logic ---
    const perms = userData.permissions || ['attendance', 'requests', 'reports'];
    
    // If user has ONLY ONE permission, redirect them directly to it
    if (perms.length === 1) {
       if (perms.includes('attendance')) navigate('/staff/attendance', { replace: true });
       else if (perms.includes('requests')) navigate('/staff/requests', { replace: true });
       else if (perms.includes('students')) navigate('/staff/students', { replace: true });
       else if (perms.includes('deputy')) navigate('/staff/deputy', { replace: true });
       else if (perms.includes('reports')) navigate('/staff/reports', { replace: true });
       else if (perms.includes('contact_directory')) navigate('/staff/directory', { replace: true });
       else if (perms.includes('observations')) navigate('/staff/observations', { replace: true });
    }
    // Otherwise, stay here and show the menu
  }, [navigate]);

  if (!user) return null;

  const perms = user.permissions || [];

  const cards = [
    {
      key: 'attendance',
      title: 'رصد الحضور والغياب',
      desc: 'تسجيل الحضور اليومي للفصول المسندة إليك.',
      icon: ClipboardCheck,
      path: '/staff/attendance',
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100'
    },
    {
      key: 'requests',
      title: 'طلبات الأعذار',
      desc: 'مراجعة وقبول أعذار الطلاب المرسلة.',
      icon: MessageSquare,
      path: '/staff/requests',
      color: 'bg-blue-50 text-blue-600 border-blue-100'
    },
    {
      key: 'students',
      title: 'دليل الطلاب (المرشد)',
      desc: 'بحث، اتصال، وبيانات التواصل مع الطلاب.',
      icon: BookUser,
      path: '/staff/students',
      color: 'bg-purple-50 text-purple-600 border-purple-100'
    },
    {
      key: 'contact_directory', 
      title: 'دليل التواصل',
      desc: 'أرقام التواصل مع أولياء الأمور.',
      icon: BookUser,
      path: '/staff/directory',
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100'
    },
    {
      key: 'deputy',
      title: 'وكيل الشؤون الطلابية',
      desc: 'إدارة السلوك والمواظبة والإجراءات الإدارية.',
      icon: Briefcase,
      path: '/staff/deputy',
      color: 'bg-red-50 text-red-600 border-red-100'
    },
    {
      key: 'observations',
      title: 'ملاحظات الطلاب',
      desc: 'تسجيل الملاحظات السلوكية والأكاديمية اليومية.',
      icon: FileText,
      path: '/staff/observations',
      color: 'bg-pink-50 text-pink-600 border-pink-100'
    },
    {
      key: 'reports',
      title: 'تقارير فصولي',
      desc: 'إحصائيات الغياب والتأخر للفصول الخاصة بك.',
      icon: BarChart2,
      path: '/staff/reports',
      color: 'bg-amber-50 text-amber-600 border-amber-100'
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in py-8">
      {/* Welcome Header */}
      <div className="bg-white p-8 rounded-3xl shadow-lg shadow-blue-900/5 border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-full bg-gradient-to-r from-blue-50 to-transparent"></div>
        <div className="relative z-10">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              مرحباً بك، <span className="text-blue-900">{user.name}</span> 👋
            </h1>
            <p className="text-slate-500">
              يرجى اختيار الخدمة التي ترغب بالعمل عليها اليوم.
            </p>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.filter(c => perms.includes(c.key)).map((card) => (
            <button
              key={card.key}
              onClick={() => navigate(card.path)}
              className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 text-right flex flex-col h-full hover:-translate-y-1"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${card.color} border transition-transform group-hover:scale-110`}>
                 <card.icon size={28} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-blue-900 transition-colors">
                {card.title}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {card.desc}
              </p>
            </button>
        ))}

        {/* Fallback if no permissions */}
        {perms.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                <ShieldCheck size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 font-bold">عفواً، لا توجد صلاحيات مسندة لحسابك حالياً.</p>
                <p className="text-sm text-slate-400 mt-2">يرجى التواصل مع إدارة المدرسة.</p>
            </div>
        )}
      </div>
      
      <div className="text-center pt-8">
         <button 
           onClick={() => { localStorage.removeItem('ozr_staff_session'); window.location.href = '#/'; }}
           className="text-slate-400 hover:text-red-500 text-sm font-bold flex items-center justify-center gap-2 mx-auto transition-colors"
         >
            <LogOut size={16} /> تسجيل الخروج
         </button>
      </div>
    </div>
  );
};

export default StaffHome;
