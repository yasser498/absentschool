import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { 
  Search, User, School, Copy, Check, CalendarDays, AlertCircle, Loader2, 
  FileText, ShieldAlert, Star, MessageSquare, Clock, Plus, Users, Bell, 
  LogOut, ChevronRight, ArrowLeft, Activity, ChevronLeft, Archive, AlertTriangle, 
  Newspaper, CreditCard, X, CheckCircle, Send 
} from 'lucide-react';
import { 
  getStudentByCivilId, getRequestsByStudentId, getStudentAttendanceHistory, 
  getBehaviorRecords, getStudentObservations, acknowledgeBehavior, 
  acknowledgeObservation, getParentChildren, linkParentToStudent, 
  getNotifications, markNotificationRead, getStudentPoints, getSchoolNews 
} from '../services/storage';
import { 
  Student, ExcuseRequest, RequestStatus, AttendanceStatus, BehaviorRecord, 
  StudentObservation, AppNotification, StudentPoint, SchoolNews 
} from '../types';

const { useNavigate } = ReactRouterDOM as any;

const Inquiry: React.FC = () => {
  const navigate = useNavigate();
  
  const [parentCivilId, setParentCivilId] = useState(localStorage.getItem('ozr_parent_id') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('ozr_parent_id'));
  const [authLoading, setAuthLoading] = useState(false);

  const [myChildren, setMyChildren] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [news, setNews] = useState<SchoolNews[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDigitalId, setShowDigitalId] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'archive' | 'behavior' | 'observations'>('overview');
  const [history, setHistory] = useState<ExcuseRequest[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<{ date: string, status: AttendanceStatus }[]>([]);
  const [behaviorHistory, setBehaviorHistory] = useState<BehaviorRecord[]>([]);
  const [observations, setObservations] = useState<StudentObservation[]>([]);
  const [points, setPoints] = useState<{total: number, history: StudentPoint[]}>({ total: 0, history: [] });
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newChildId, setNewChildId] = useState('');
  const [isAddingChild, setIsAddingChild] = useState(false);

  // Reply State
  const [replyMode, setReplyMode] = useState<{ id: string, type: 'behavior' | 'observation' } | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!parentCivilId) return;
      setAuthLoading(true);
      setTimeout(async () => {
          localStorage.setItem('ozr_parent_id', parentCivilId);
          setIsAuthenticated(true);
          await loadParentDashboard();
          setAuthLoading(false);
      }, 1000);
  };

  const handleLogout = () => {
      localStorage.removeItem('ozr_parent_id');
      setIsAuthenticated(false);
      setMyChildren([]);
      setSelectedStudent(null);
  };

  const loadParentDashboard = async () => {
      if (!parentCivilId) return;
      try {
          const [children, notifs, schoolNews] = await Promise.all([
              getParentChildren(parentCivilId),
              getNotifications(parentCivilId),
              getSchoolNews()
          ]);
          setMyChildren(children);
          setNotifications(notifs);
          setNews(schoolNews);
      } catch (e) { console.error(e); }
  };

  useEffect(() => {
      if (isAuthenticated) loadParentDashboard();
  }, [isAuthenticated]);

  const handleAddChild = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newChildId) return;
      setLoading(true);
      try {
          const student = await getStudentByCivilId(newChildId);
          if (!student) { alert("لم يتم العثور على طالب بهذا الرقم."); } 
          else { await linkParentToStudent(parentCivilId, student.studentId); await loadParentDashboard(); setNewChildId(''); setIsAddingChild(false); alert("تم الإضافة!"); }
      } catch (e) { alert("حدث خطأ."); } finally { setLoading(false); }
  };

  const handleSelectStudent = async (student: Student) => {
      setSelectedStudent(student);
      setLoading(true);
      try {
          const [reqs, att, beh, obs, pts] = await Promise.all([
              getRequestsByStudentId(student.studentId),
              getStudentAttendanceHistory(student.studentId, student.grade, student.className),
              getBehaviorRecords(student.studentId),
              getStudentObservations(student.studentId),
              getStudentPoints(student.studentId)
          ]);
          setHistory(reqs);
          setAttendanceHistory(att);
          setBehaviorHistory(beh);
          setObservations(obs);
          setPoints(pts);
          setActiveTab('overview');
      } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const unexcusedAbsences = useMemo(() => {
      if (!attendanceHistory.length) return [];
      return attendanceHistory.filter(record => {
          if (record.status !== AttendanceStatus.ABSENT) return false;
          const hasRequest = history.some(req => req.date === record.date);
          return !hasRequest;
      });
  }, [attendanceHistory, history]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitReply = async () => {
      if (!replyMode || !replyContent.trim()) return;
      setSubmittingReply(true);
      try {
          if (replyMode.type === 'behavior') await acknowledgeBehavior(replyMode.id, replyContent);
          else await acknowledgeObservation(replyMode.id, replyContent);
          
          if(selectedStudent) await handleSelectStudent(selectedStudent);
          
          setReplyMode(null); 
          setReplyContent('');
          alert("تم إرسال الرد وتأكيد الاطلاع بنجاح");
      } catch(e) {
          alert("حدث خطأ");
      } finally { setSubmittingReply(false); }
  };

  const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay(); 
      const days = [];
      for (let i = 0; i < firstDay; i++) days.push(null);
      for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
      return days;
  };
  const getAttendanceStatusForDate = (date: Date) => {
      const dateStr = date.toISOString().split('T')[0];
      const record = attendanceHistory.find(r => r.date === dateStr);
      return record ? record.status : null;
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (!isAuthenticated) {
      return (
          <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-purple-600"></div>
                  <div className="text-center mb-8">
                      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                          <Users size={32} className="text-blue-600"/>
                      </div>
                      <h1 className="text-2xl font-bold text-slate-800">بوابة ولي الأمر</h1>
                      <p className="text-slate-500 text-sm mt-2">سجل دخولك برقم الهوية لمتابعة أبنائك</p>
                  </div>
                  <form onSubmit={handleLogin} className="space-y-6">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">رقم الهوية / السجل المدني</label>
                          <input 
                              type="text" 
                              required 
                              maxLength={10}
                              value={parentCivilId}
                              onChange={e => setParentCivilId(e.target.value.replace(/[^0-9]/g, ''))}
                              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xl font-bold tracking-widest focus:ring-2 focus:ring-blue-600 outline-none"
                              placeholder="1XXXXXXXXX"
                          />
                      </div>
                      <button disabled={authLoading} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
                          {authLoading ? <Loader2 className="animate-spin"/> : 'تسجيل الدخول'}
                      </button>
                  </form>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans relative">
        <div className="bg-white sticky top-0 z-30 border-b border-slate-100 shadow-sm">
            <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                    <Users className="text-blue-600"/> بوابة ولي الأمر
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-full hover:bg-slate-100">
                        <Bell size={24} className="text-slate-600"/>
                        {unreadCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
                    </button>
                    <button onClick={handleLogout} className="p-2 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500"><LogOut size={20}/></button>
                </div>
            </div>
        </div>

        {showNotifications && (
            <div className="max-w-5xl mx-auto px-4 relative z-20">
                <div className="absolute top-2 left-4 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="p-3 border-b border-slate-50 font-bold text-sm bg-slate-50">الإشعارات</div>
                    <div className="max-h-64 overflow-y-auto">
                        {notifications.length === 0 ? <p className="p-4 text-center text-xs text-slate-400">لا توجد إشعارات</p> : 
                        notifications.map(n => (
                            <div key={n.id} className={`p-3 border-b border-slate-50 text-sm ${!n.isRead ? 'bg-blue-50/50' : ''}`} onClick={() => markNotificationRead(n.id)}>
                                <p className="font-bold text-slate-800">{n.title}</p>
                                <p className="text-xs text-slate-500 mt-1">{n.message}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
            
            {news.length > 0 && !selectedStudent && (
                <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden p-4 relative animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider animate-pulse">هام</span>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Newspaper size={16} className="text-blue-500"/> أخبار المدرسة</h3>
                    </div>
                    <div className="space-y-3">
                        {news.slice(0, 3).map(n => (
                            <div key={n.id} className={`p-3 rounded-xl border-l-4 ${n.isUrgent ? 'bg-red-50 border-red-500' : 'bg-slate-50 border-blue-500'}`}>
                                <h4 className="font-bold text-sm text-slate-900">{n.title}</h4>
                                <p className="text-xs text-slate-600 mt-1 line-clamp-2">{n.content}</p>
                                <div className="mt-2 text-[10px] text-slate-400 flex justify-between">
                                    <span>{new Date(n.createdAt).toLocaleDateString('ar-SA')}</span>
                                    <span>بواسطة: {n.author}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!selectedStudent ? (
                <div className="animate-fade-in space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-800">أبنائي</h2>
                        <button onClick={() => setIsAddingChild(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-200">
                            <Plus size={16}/> إضافة ابن
                        </button>
                    </div>

                    {isAddingChild && (
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-blue-100 animate-fade-in-up">
                            <form onSubmit={handleAddChild} className="flex gap-2">
                                <input autoFocus placeholder="رقم هوية الطالب..." value={newChildId} onChange={e => setNewChildId(e.target.value)} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 font-bold text-slate-800"/>
                                <button disabled={loading} className="bg-blue-600 text-white px-6 rounded-xl font-bold">{loading ? <Loader2 className="animate-spin"/> : 'إضافة'}</button>
                                <button type="button" onClick={() => setIsAddingChild(false)} className="bg-slate-100 text-slate-500 px-4 rounded-xl font-bold">إلغاء</button>
                            </form>
                        </div>
                    )}

                    {myChildren.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"><Users className="text-slate-300"/></div>
                            <p className="font-bold text-slate-500">لم يتم ربط أي طلاب بحسابك بعد.</p>
                            <p className="text-sm text-slate-400 mt-1">اضغط "إضافة ابن" وأدخل رقم الهوية.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {myChildren.map(child => (
                                <div key={child.id} onClick={() => handleSelectStudent(child)} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xl font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            {child.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-900 group-hover:text-blue-800">{child.name}</h3>
                                            <p className="text-sm text-slate-500">{child.grade} - {child.className}</p>
                                        </div>
                                        <ChevronRight className="mr-auto text-slate-300 group-hover:text-blue-500"/>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="animate-fade-in space-y-6">
                    <button onClick={() => setSelectedStudent(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold mb-4">
                        <ArrowLeft size={18}/> العودة للقائمة
                    </button>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-blue-50 to-transparent"></div>
                        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-right">
                            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-3xl font-bold shadow-inner">
                                {selectedStudent.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold text-slate-900">{selectedStudent.name}</h2>
                                <p className="text-slate-500">{selectedStudent.grade} - {selectedStudent.className}</p>
                                <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-3">
                                    <div className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 border border-amber-100">
                                        <Star size={16}/> {points.total} نقطة تميز
                                    </div>
                                    <button onClick={() => setShowDigitalId(true)} className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 border border-purple-100 hover:bg-purple-100 transition-colors">
                                        <CreditCard size={16}/> البطاقة الرقمية
                                    </button>
                                </div>
                            </div>
                            <button onClick={() => navigate(`/submit?studentId=${selectedStudent.studentId}`)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2">
                                <FileText size={18}/> تقديم عذر
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {[
                            { id: 'overview', label: 'ملخص', icon: Activity },
                            { id: 'attendance', label: 'التقويم', icon: CalendarDays },
                            { id: 'archive', label: 'أرشيف الأعذار', icon: Archive },
                            { id: 'behavior', label: 'السلوك', icon: ShieldAlert },
                            { id: 'observations', label: 'الملاحظات', icon: MessageSquare }
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap border ${activeTab === tab.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                                <tab.icon size={16}/> {tab.label}
                            </button>
                        ))}
                    </div>

                    {loading ? <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600"/></div> : (
                        <div className="min-h-[300px]">
                            {activeTab === 'overview' && (
                                <div className="space-y-6 animate-fade-in">
                                    {unexcusedAbsences.length > 0 && (
                                        <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-5 shadow-sm">
                                            <div className="flex justify-between items-start mb-4">
                                                <h3 className="font-bold text-red-800 flex items-center gap-2"><AlertTriangle className="text-red-600"/> غياب لم يتم تقديم عذر له</h3>
                                                <span className="bg-white text-red-600 px-3 py-1 rounded-lg text-xs font-bold border border-red-100">{unexcusedAbsences.length} أيام</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {unexcusedAbsences.map((rec, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-red-100">
                                                        <span className="font-mono font-bold text-slate-700">{rec.date}</span>
                                                        <button onClick={() => navigate(`/submit?studentId=${selectedStudent.studentId}&date=${rec.date}`)} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-700 transition-colors">تقديم عذر</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Clock className="text-blue-500"/> الحضور والغياب</h3>
                                            <div className="flex justify-between text-center">
                                                <div><p className="text-2xl font-bold text-red-600">{attendanceHistory.filter(x=>x.status==='ABSENT').length}</p><p className="text-xs text-slate-400">غياب</p></div>
                                                <div><p className="text-2xl font-bold text-amber-500">{attendanceHistory.filter(x=>x.status==='LATE').length}</p><p className="text-xs text-slate-400">تأخر</p></div>
                                                <div><p className="text-2xl font-bold text-emerald-600">{attendanceHistory.filter(x=>x.status==='PRESENT').length}</p><p className="text-xs text-slate-400">حضور</p></div>
                                            </div>
                                        </div>
                                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Star className="text-amber-500"/> نقاط التميز</h3>
                                            {points.history.length > 0 ? (
                                                <div className="space-y-3">
                                                    {points.history.slice(0,3).map(p => (
                                                        <div key={p.id} className="flex justify-between text-sm bg-amber-50 p-2 rounded-lg text-amber-800">
                                                            <span>{p.reason}</span>
                                                            <span className="font-bold">+{p.points}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : <p className="text-slate-400 text-sm">لا يوجد نقاط مكتسبة بعد.</p>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'attendance' && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><CalendarDays className="text-blue-600"/> تقويم الحضور - {calendarMonth.toLocaleString('ar-SA', { month: 'long', year: 'numeric' })}</h3>
                                            <div className="flex gap-2">
                                                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200"><ChevronRight size={16}/></button>
                                                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200"><ChevronLeft size={16}/></button>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 mb-2">
                                            <span>أحد</span><span>اثنين</span><span>ثلاثاء</span><span>أربعاء</span><span>خميس</span><span>جمعة</span><span>سبت</span>
                                        </div>
                                        <div className="grid grid-cols-7 gap-2">
                                            {getDaysInMonth(calendarMonth).map((day, idx) => {
                                                if (!day) return <div key={idx} className="aspect-square"></div>;
                                                const status = getAttendanceStatusForDate(day);
                                                let bgClass = "bg-slate-50 text-slate-700 border-slate-100";
                                                
                                                if (status === 'ABSENT') bgClass = "bg-red-100 text-red-700 border-red-200 font-bold";
                                                else if (status === 'LATE') bgClass = "bg-amber-100 text-amber-700 border-amber-200 font-bold";
                                                else if (status === 'PRESENT') bgClass = "bg-emerald-100 text-emerald-700 border-emerald-200 font-bold";

                                                return (
                                                    <div key={idx} className={`aspect-square flex items-center justify-center rounded-xl border ${bgClass} text-sm transition-all hover:scale-105 shadow-sm`}>
                                                        {day.getDate()}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex gap-4 justify-center mt-6 text-xs font-bold text-slate-500">
                                            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded"></div> حضور</span>
                                            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div> غياب</span>
                                            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-100 border border-amber-200 rounded"></div> تأخر</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'archive' && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Archive className="text-blue-500"/> أرشيف الأعذار المقدمة</h3>
                                        {history.length === 0 ? (
                                            <div className="text-center py-10 text-slate-400">
                                                <FileText size={40} className="mx-auto mb-2 opacity-50"/>
                                                <p>لم يتم تقديم أي أعذار سابقاً.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {history.map((req) => (
                                                    <div key={req.id} className="border border-slate-100 rounded-xl p-4 hover:bg-slate-50 transition-colors">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <span className="font-mono font-bold text-slate-800">{req.date}</span>
                                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                                                req.status === RequestStatus.APPROVED ? 'bg-emerald-100 text-emerald-700' :
                                                                req.status === RequestStatus.REJECTED ? 'bg-red-100 text-red-700' :
                                                                'bg-amber-100 text-amber-700'
                                                            }`}>
                                                                {req.status === RequestStatus.APPROVED ? 'مقبول' : 
                                                                 req.status === RequestStatus.REJECTED ? 'مرفوض' : 'قيد المراجعة'}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm font-bold text-slate-700 mb-1">{req.reason}</p>
                                                        {req.details && <p className="text-xs text-slate-500">{req.details}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'behavior' && (
                                <div className="space-y-4 animate-fade-in">
                                    {behaviorHistory.length === 0 ? <p className="text-center py-10 text-slate-400">سجل سلوكي نظيف وممتاز!</p> : behaviorHistory.map(rec => (
                                        <div key={rec.id} className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm">
                                            <div className="flex justify-between mb-2">
                                                <span className="font-bold text-red-700">{rec.violationName}</span>
                                                <span className="text-xs text-slate-400">{rec.date}</span>
                                            </div>
                                            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl mb-3">{rec.actionTaken}</p>
                                            
                                            {!rec.parentViewed ? (
                                                <div className="mt-3">
                                                    {replyMode?.id === rec.id && replyMode.type === 'behavior' ? (
                                                        <div className="animate-fade-in">
                                                            <textarea 
                                                                className="w-full p-3 border rounded-xl text-sm mb-2 outline-none focus:ring-2 focus:ring-blue-100" 
                                                                placeholder="اكتب ردك أو ملاحظتك هنا..."
                                                                value={replyContent}
                                                                onChange={e => setReplyContent(e.target.value)}
                                                                autoFocus
                                                            ></textarea>
                                                            <div className="flex gap-2 justify-end">
                                                                <button onClick={() => { setReplyMode(null); setReplyContent(''); }} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors">إلغاء</button>
                                                                <button onClick={handleSubmitReply} disabled={submittingReply} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1">
                                                                    {submittingReply ? <Loader2 className="animate-spin" size={14}/> : <Send size={14}/>} إرسال
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => { setReplyMode({id: rec.id, type: 'behavior'}); setReplyContent(''); }} className="w-full bg-red-50 text-red-700 py-2 rounded-lg text-sm font-bold border border-red-100 hover:bg-red-100 transition-colors">
                                                            تأكيد الاطلاع والرد
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="mt-3 bg-slate-50 p-3 rounded-xl text-xs text-slate-500 flex items-center gap-2 border border-slate-100">
                                                    <CheckCircle size={16} className="text-emerald-500"/>
                                                    <div>
                                                        <span className="font-bold text-emerald-700 block">تم الاطلاع</span>
                                                        {rec.parentFeedback && <span className="text-slate-600 mt-1 block">رد ولي الأمر: {rec.parentFeedback}</span>}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {activeTab === 'observations' && (
                                <div className="space-y-4 animate-fade-in">
                                    {observations.length === 0 ? <p className="text-center py-10 text-slate-400">لا توجد ملاحظات.</p> : observations.map(obs => (
                                        <div key={obs.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                                            <div className={`absolute top-0 right-0 w-1 h-full ${obs.sentiment === 'positive' ? 'bg-emerald-500' : obs.sentiment === 'negative' ? 'bg-red-500' : 'bg-slate-300'}`}></div>
                                            <p className="text-sm font-bold text-slate-800 mb-2">{obs.staffName}</p>
                                            <p className="text-sm text-slate-600 mb-4">{obs.content}</p>
                                            
                                            {!obs.parentViewed ? (
                                                <div className="mt-3 pt-3 border-t border-slate-100">
                                                    {replyMode?.id === obs.id && replyMode.type === 'observation' ? (
                                                        <div className="animate-fade-in">
                                                            <textarea 
                                                                className="w-full p-3 border rounded-xl text-sm mb-2 outline-none focus:ring-2 focus:ring-blue-100" 
                                                                placeholder="اكتب ردك أو ملاحظتك هنا..."
                                                                value={replyContent}
                                                                onChange={e => setReplyContent(e.target.value)}
                                                                autoFocus
                                                            ></textarea>
                                                            <div className="flex gap-2 justify-end">
                                                                <button onClick={() => { setReplyMode(null); setReplyContent(''); }} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors">إلغاء</button>
                                                                <button onClick={handleSubmitReply} disabled={submittingReply} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1">
                                                                    {submittingReply ? <Loader2 className="animate-spin" size={14}/> : <Send size={14}/>} إرسال
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => { setReplyMode({id: obs.id, type: 'observation'}); setReplyContent(''); }} className="w-full bg-blue-50 text-blue-700 py-2 rounded-lg text-sm font-bold border border-blue-100 hover:bg-blue-100 transition-colors">
                                                            تأكيد الاطلاع والرد
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="mt-3 bg-slate-50 p-3 rounded-xl text-xs text-slate-500 flex items-center gap-2 border border-slate-100">
                                                    <CheckCircle size={16} className="text-emerald-500"/>
                                                    <div>
                                                        <span className="font-bold text-emerald-700 block">تم الاطلاع</span>
                                                        {obs.parentFeedback && <span className="text-slate-600 mt-1 block">رد ولي الأمر: {obs.parentFeedback}</span>}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>

        {showDigitalId && selectedStudent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in" onClick={() => setShowDigitalId(false)}>
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden relative" onClick={e => e.stopPropagation()}>
                    <div className="h-32 bg-blue-900 relative">
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 p-1 bg-white rounded-full">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-2xl font-bold text-slate-600 border-2 border-slate-200">
                                {selectedStudent.name.charAt(0)}
                            </div>
                        </div>
                    </div>
                    <div className="pt-12 pb-8 px-6 text-center">
                        <h2 className="text-2xl font-bold text-slate-900">{selectedStudent.name}</h2>
                        <p className="text-slate-500 text-sm mt-1">طالب منتظم - {selectedStudent.grade}</p>
                        
                        <div className="my-6 border-t border-b border-slate-100 py-4 grid grid-cols-2 gap-4">
                            <div><p className="text-xs text-slate-400 font-bold uppercase">الرقم الأكاديمي</p><p className="font-mono font-bold text-slate-800">{selectedStudent.studentId}</p></div>
                            <div><p className="text-xs text-slate-400 font-bold uppercase">الفصل</p><p className="font-bold text-slate-800">{selectedStudent.className}</p></div>
                        </div>

                        <div className="bg-white p-2 rounded-xl inline-block border border-slate-200">
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${selectedStudent.studentId}`} alt="ID QR" className="w-32 h-32" />
                        </div>
                        <p className="text-xs text-slate-400 mt-4 font-bold">بطاقة تعريفية رقمية - متوسطة عماد الدين زنكي</p>
                    </div>
                    <button onClick={() => setShowDigitalId(false)} className="absolute top-4 left-4 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full backdrop-blur-sm transition-colors"><X size={20}/></button>
                </div>
            </div>
        )}
    </div>
  );
};

export default Inquiry;