import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Users, Search, Phone, User, MapPin, School, CheckCircle, 
  ShieldAlert, Printer, Plus, Inbox, FileText, LayoutGrid, 
  BookOpen, MessageSquare, AlertTriangle, Calendar, Loader2 
} from 'lucide-react';
import { 
  getStudents, getReferrals, getGuidanceSessions, getConsecutiveAbsences 
} from '../../services/storage';
import { Student, StaffUser, Referral, GuidanceSession } from '../../types';

const StaffStudents: React.FC = () => {
  const location = useLocation();
  const isDirectoryMode = location.pathname.includes('directory');
  
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [sessions, setSessions] = useState<GuidanceSession[]>([]);
  const [activeRiskList, setActiveRiskList] = useState<any[]>([]); // Derived from consecutive absences
  
  const [activeView, setActiveView] = useState<'dashboard' | 'directory' | 'inbox' | 'sessions'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Constants
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const session = localStorage.getItem('ozr_staff_session');
    if (session) setCurrentUser(JSON.parse(session));
    
    if (isDirectoryMode) setActiveView('directory');

    fetchData();
  }, [isDirectoryMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sData, rData, sessData, riskData] = await Promise.all([
        getStudents(),
        getReferrals(),
        getGuidanceSessions(),
        getConsecutiveAbsences()
      ]);
      setStudents(sData);
      setReferrals(rData);
      setSessions(sessData);
      setActiveRiskList(riskData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Derived State
  const dailySessions = useMemo(() => sessions.filter(s => s.date === today), [sessions, today]);
  const pendingReferrals = useMemo(() => referrals.filter(r => r.status === 'pending'), [referrals]);
  const activeReferrals = useMemo(() => referrals.filter(r => ['pending', 'in_progress'].includes(r.status)), [referrals]);
  const completedReferrals = useMemo(() => referrals.filter(r => r.status === 'resolved'), [referrals]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => 
      s.name.includes(searchTerm) || s.studentId.includes(searchTerm) || s.phone.includes(searchTerm)
    );
  }, [students, searchTerm]);

  // Handlers
  const handlePrintWarning = (risk: any) => {
      // Placeholder for print functionality
      alert(`سيتم طباعة إنذار للطالب ${risk.studentName}`);
  };

  const openSessionStudentSelector = () => {
      alert("سيتم فتح نافذة اختيار الطالب لجلسة جديدة في التحديث القادم.");
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto"/></div>;

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
        {/* Header Tabs */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
                <div className="bg-purple-50 p-2 rounded-xl text-purple-600"><BookOpen size={24}/></div>
                <div>
                    <h1 className="text-xl font-bold text-slate-900">
                        {isDirectoryMode ? 'دليل التواصل مع الطلاب' : 'مكتب التوجيه الطلابي'}
                    </h1>
                    <p className="text-xs text-slate-500">
                        {isDirectoryMode ? 'بيانات الاتصال وأولياء الأمور' : 'إدارة الحالات والإرشاد'}
                    </p>
                </div>
            </div>
            {!isDirectoryMode && (
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    {[
                        {id: 'dashboard', label: 'الرئيسية', icon: LayoutGrid},
                        {id: 'directory', label: 'الدليل', icon: Users},
                        {id: 'inbox', label: 'الإحالات', icon: Inbox},
                        {id: 'sessions', label: 'الجلسات', icon: MessageSquare}
                    ].map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveView(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeView === tab.id ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <tab.icon size={16}/> <span className="hidden md:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>

      {/* DASHBOARD VIEW */}
      {!isDirectoryMode && activeView === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
              {/* Counselor Profile Card */}
              {currentUser && (
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-center">
                      <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 text-3xl font-bold border-4 border-white shadow-md">
                          {currentUser.name.charAt(0)}
                      </div>
                      <div className="flex-1 text-center md:text-right">
                          <h2 className="text-2xl font-bold text-slate-800 mb-1">{currentUser.name}</h2>
                          <p className="text-slate-500 text-sm mb-3">المكتب الرقمي للموجه الطلابي</p>
                          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                              {currentUser.permissions?.map(p => (
                                  <span key={p} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-bold border border-purple-100 flex items-center gap-1">
                                      <CheckCircle size={12} />
                                      {p === 'students' ? 'توجيه طلابي' : p === 'deputy' ? 'وكيل شؤون طلاب' : p === 'attendance' ? 'رصد غياب' : p}
                                  </span>
                              ))}
                          </div>
                      </div>
                      {currentUser.assignments && currentUser.assignments.length > 0 && (
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 min-w-[250px] text-center md:text-right">
                              <h3 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2 justify-center md:justify-start">
                                  <School size={14}/> الفصول المسندة
                              </h3>
                              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                  {currentUser.assignments.map((a, i) => (
                                      <span key={i} className="text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                          {a.grade} - {a.className}
                                      </span>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-5 rounded-3xl border border-purple-100 shadow-sm text-center">
                      <p className="text-xs font-bold text-slate-400 uppercase">جلسات اليوم</p>
                      <h3 className="text-3xl font-extrabold text-purple-700 mt-1">{dailySessions.length}</h3>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-blue-100 shadow-sm text-center">
                      <p className="text-xs font-bold text-slate-400 uppercase">إحالات جديدة</p>
                      <h3 className="text-3xl font-extrabold text-blue-700 mt-1">{pendingReferrals.length}</h3>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-amber-100 shadow-sm text-center">
                      <p className="text-xs font-bold text-slate-400 uppercase">قيد المعالجة</p>
                      <h3 className="text-3xl font-extrabold text-amber-600 mt-1">{activeReferrals.length}</h3>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-sm text-center">
                      <p className="text-xs font-bold text-slate-400 uppercase">حالات مكتملة</p>
                      <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">{completedReferrals.length}</h3>
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Risk List (New Cases) */}
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
                      <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-center">
                          <h3 className="font-bold text-red-800 flex items-center gap-2"><ShieldAlert size={18}/> مؤشر الخطر (حالات جديدة)</h3>
                          <span className="bg-white text-red-600 px-3 py-1 rounded-full text-xs font-bold">{activeRiskList.length}</span>
                      </div>
                      <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-3">
                          {activeRiskList.length === 0 ? <p className="text-center py-10 text-slate-400">لا يوجد طلاب جدد في دائرة الخطر (مع استبعاد من لديهم أعذار).</p> : activeRiskList.map((risk, idx) => (
                              <div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl hover:border-red-200">
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold">{risk.studentName.charAt(0)}</div>
                                      <div><h4 className="font-bold text-sm text-slate-800">{risk.studentName}</h4><p className="text-xs text-slate-500">آخر غياب: {risk.lastDate}</p></div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                      <span className="text-red-600 font-extrabold">{risk.days} أيام</span>
                                      <button onClick={() => handlePrintWarning(risk)} className="text-xs bg-red-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-red-700 flex items-center gap-1 shadow-sm">
                                          <Printer size={14}/> إنذار
                                      </button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-4">
                      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10"></div>
                          <h3 className="text-xl font-bold mb-2">جلسة إرشادية جديدة</h3>
                          <p className="text-purple-100 text-sm mb-6">توثيق جلسة فورية لطالب.</p>
                          <button onClick={openSessionStudentSelector} className="bg-white text-purple-700 px-6 py-3 rounded-xl font-bold flex items-center gap-2"><Plus size={18}/> بدء جلسة</button>
                      </div>
                      
                      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Inbox size={18} className="text-blue-600"/> آخر الإحالات</h3>
                          {pendingReferrals.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">لا توجد إحالات جديدة.</p> : (
                              <div className="space-y-3">
                                  {pendingReferrals.slice(0, 2).map(ref => (
                                      <div key={ref.id} className="flex justify-between items-center p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                                          <div><p className="font-bold text-slate-800 text-sm">{ref.studentName}</p><p className="text-xs text-slate-500">{ref.reason}</p></div>
                                          <button onClick={() => setActiveView('inbox')} className="text-xs bg-white text-blue-600 px-3 py-1.5 rounded-lg border border-blue-200 font-bold">معاينة</button>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* DIRECTORY VIEW (For Teachers & Counselor) */}
      {(isDirectoryMode || activeView === 'directory') && (
          <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                  <input 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    placeholder="ابحث عن طالب بالاسم، الهوية، أو رقم الجوال..." 
                    className="w-full pr-12 pl-4 py-3 bg-slate-50 border-none rounded-xl outline-none font-bold text-slate-700 focus:ring-2 focus:ring-purple-100 transition-all"
                  />
              </div>

              {filteredStudents.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                      <Users size={48} className="mx-auto mb-2 opacity-30"/>
                      <p>لا توجد نتائج</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredStudents.map(student => (
                          <div key={student.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 group">
                              <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200">
                                      {student.name.charAt(0)}
                                  </div>
                                  <div>
                                      <h3 className="font-bold text-slate-900 group-hover:text-purple-700 transition-colors">{student.name}</h3>
                                      <p className="text-xs text-slate-500 font-mono">{student.studentId}</p>
                                  </div>
                              </div>
                              <div className="border-t border-slate-50 pt-3 space-y-2">
                                  <div className="flex items-center gap-2 text-xs text-slate-600">
                                      <School size={14} className="text-slate-400"/>
                                      <span>{student.grade} - {student.className}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                      <Phone size={14} className="text-purple-500"/>
                                      <span dir="ltr">{student.phone || 'غير متوفر'}</span>
                                  </div>
                              </div>
                              <div className="flex gap-2 mt-auto pt-2">
                                  <a href={`tel:${student.phone}`} className="flex-1 bg-purple-50 text-purple-600 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-purple-100">
                                      <Phone size={14}/> اتصال
                                  </a>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {/* REFERRALS INBOX VIEW */}
      {!isDirectoryMode && activeView === 'inbox' && (
          <div className="space-y-4 animate-fade-in">
              <h2 className="text-lg font-bold text-slate-800 mb-4">صندوق الإحالات الواردة</h2>
              {referrals.length === 0 ? <p className="text-slate-400">لا يوجد إحالات.</p> : (
                  referrals.map(ref => (
                      <div key={ref.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                          <div className="flex justify-between">
                              <h3 className="font-bold">{ref.studentName}</h3>
                              <span className={`px-2 py-1 rounded text-xs ${ref.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>{ref.status}</span>
                          </div>
                          <p className="text-sm text-slate-600 mt-2">{ref.reason}</p>
                          <p className="text-xs text-slate-400 mt-2">من: {ref.referredBy} - {ref.referralDate}</p>
                      </div>
                  ))
              )}
          </div>
      )}

      {/* SESSIONS VIEW */}
      {!isDirectoryMode && activeView === 'sessions' && (
          <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-slate-800">سجل الجلسات الإرشادية</h2>
                  <button onClick={openSessionStudentSelector} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"><Plus size={16}/> جلسة جديدة</button>
              </div>
              {sessions.length === 0 ? <p className="text-slate-400">لا يوجد جلسات مسجلة.</p> : (
                  sessions.map(sess => (
                      <div key={sess.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                          <div className="flex justify-between">
                              <h3 className="font-bold">{sess.studentName}</h3>
                              <span className="text-xs text-slate-500">{sess.date}</span>
                          </div>
                          <p className="text-sm text-purple-700 font-bold mt-1">{sess.topic}</p>
                          <p className="text-xs text-slate-600 mt-2 line-clamp-2">{sess.recommendations}</p>
                      </div>
                  ))
              )}
          </div>
      )}
    </div>
  );
};

export default StaffStudents;