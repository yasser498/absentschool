
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, MessageSquare, BookUser, BarChart2, ShieldCheck, LogOut, Briefcase, FileText, BellRing, Sparkles, X, Calendar, User } from 'lucide-react';
import { StaffUser, SchoolNews, AdminInsight } from '../../types';
import { getSchoolNews, getAdminInsights } from '../../services/storage';

const StaffHome: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [news, setNews] = useState<SchoolNews[]>([]);
  const [directives, setDirectives] = useState<AdminInsight[]>([]);
  
  // State for viewing full details
  const [selectedItem, setSelectedItem] = useState<{
    title: string;
    content: string;
    date: string;
    type: 'news' | 'directive';
    author?: string;
  } | null>(null);

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
    
    // Load News and Directives
    const loadInfo = async () => {
        const [n, d] = await Promise.all([
            getSchoolNews(),
            getAdminInsights('teachers')
        ]);
        setNews(n);
        setDirectives(d);
    };
    loadInfo();

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
      title: 'وكيل شؤون الطلاب',
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
    <div className="space-y-8 animate-fade-in py-8 relative">
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
      
      {/* COMMUNICATION CENTER (NEWS & DIRECTIVES) */}
      {(news.length > 0 || directives.length > 0) && (
          <div className="mt-8 space-y-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><BellRing className="text-amber-500"/> لوحة الإعلانات والتعاميم</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* News Feed */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <h3 className="font-bold text-slate-700 mb-4 border-b border-slate-100 pb-2">أخبار المدرسة</h3>
                      {news.length === 0 ? <p className="text-sm text-slate-400">لا يوجد أخبار جديدة.</p> : (
                          <div className="space-y-4 max-h-60 overflow-y-auto custom-scrollbar">
                              {news.map(n => (
                                  <div 
                                    key={n.id} 
                                    onClick={() => setSelectedItem({
                                        title: n.title,
                                        content: n.content,
                                        date: n.createdAt,
                                        type: 'news',
                                        author: n.author
                                    })}
                                    className={`p-4 rounded-xl border-l-4 cursor-pointer hover:bg-slate-50 transition-colors ${n.isUrgent ? 'bg-red-50 border-red-500' : 'bg-slate-50 border-blue-500'}`}
                                  >
                                      <div className="flex justify-between items-start mb-1">
                                          <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{n.title}</h4>
                                          {n.isUrgent && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold shrink-0">هام</span>}
                                      </div>
                                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{n.content}</p>
                                      <span className="text-[10px] text-slate-400 mt-2 flex justify-between">
                                          <span>{new Date(n.createdAt).toLocaleDateString('ar-SA')}</span>
                                          <span className="text-blue-600 font-bold">اقرأ المزيد</span>
                                      </span>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>

                  {/* Admin Directives */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <h3 className="font-bold text-slate-700 mb-4 border-b border-slate-100 pb-2">التعاميم الإدارية</h3>
                      {directives.length === 0 ? <p className="text-sm text-slate-400">لا يوجد تعاميم موجهة للمعلمين.</p> : (
                          <div className="space-y-4 max-h-60 overflow-y-auto custom-scrollbar">
                              {directives.map(d => (
                                  <div 
                                    key={d.id} 
                                    onClick={() => setSelectedItem({
                                        title: 'توجيه إداري',
                                        content: d.content,
                                        date: d.createdAt,
                                        type: 'directive'
                                    })}
                                    className="p-4 rounded-xl bg-purple-50 border border-purple-100 cursor-pointer hover:bg-purple-100 transition-colors"
                                  >
                                      <div className="flex items-center gap-2 mb-2 text-purple-700 font-bold text-sm">
                                          <Sparkles size={14}/> توجيه إداري
                                      </div>
                                      <p className="text-xs text-slate-700 leading-relaxed font-medium line-clamp-3">{d.content}</p>
                                      <span className="text-[10px] text-purple-400 mt-2 block text-left">{new Date(d.createdAt).toLocaleDateString('ar-SA')}</span>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* DETAIL MODAL */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in" onClick={() => setSelectedItem(null)}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className={`p-6 text-white flex justify-between items-start shrink-0 ${selectedItem.type === 'news' ? 'bg-blue-900' : 'bg-purple-800'}`}>
                    <div>
                        <span className="inline-block px-2 py-1 rounded bg-white/20 text-[10px] font-bold mb-2">
                            {selectedItem.type === 'news' ? 'خبر مدرسي' : 'تعميم إداري'}
                        </span>
                        <h2 className="text-xl font-bold leading-tight">{selectedItem.title}</h2>
                        <div className="flex items-center gap-4 mt-3 text-xs text-white/80">
                            <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(selectedItem.date).toLocaleDateString('ar-SA')}</span>
                            {selectedItem.author && <span className="flex items-center gap-1"><User size={12}/> {selectedItem.author}</span>}
                        </div>
                    </div>
                    <button onClick={() => setSelectedItem(null)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><X size={20}/></button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <p className="text-slate-800 text-base leading-loose whitespace-pre-line font-medium">
                        {selectedItem.content}
                    </p>
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <button onClick={() => setSelectedItem(null)} className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-colors">
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="text-center pt-8 border-t border-slate-100 mt-8">
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
