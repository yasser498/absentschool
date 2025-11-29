
import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { 
  Search, User, School, Copy, Check, CalendarDays, AlertCircle, Loader2, 
  FileText, ShieldAlert, Star, MessageSquare, Send, CheckCircle, Clock, Plus, Users, Bell, 
  LogOut, ChevronRight, ArrowLeft, Activity, ChevronLeft, Archive, AlertTriangle, 
  Newspaper, CreditCard, X, Sparkles, CalendarCheck, QrCode, Paperclip, Printer
} from 'lucide-react';
import { 
  getStudentByCivilId, getRequestsByStudentId, getStudentAttendanceHistory, 
  getBehaviorRecords, getStudentObservations, acknowledgeBehavior, 
  acknowledgeObservation, getParentChildren, linkParentToStudent, 
  getNotifications, markNotificationRead, getStudentPoints, getSchoolNews, generateSmartStudentReport,
  getAvailableSlots, bookAppointment, getMyAppointments
} from '../services/storage';
import { 
  Student, ExcuseRequest, RequestStatus, AttendanceStatus, BehaviorRecord, 
  StudentObservation, AppNotification, StudentPoint, SchoolNews, AppointmentSlot, Appointment 
} from '../types';

const { useNavigate } = ReactRouterDOM as any;

const Inquiry: React.FC = () => {
  const navigate = useNavigate();
  
  // State
  const [parentCivilId, setParentCivilId] = useState(localStorage.getItem('ozr_parent_id') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('ozr_parent_id'));
  const [authLoading, setAuthLoading] = useState(false);
  const [myChildren, setMyChildren] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [news, setNews] = useState<SchoolNews[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDigitalId, setShowDigitalId] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'report' | 'attendance' | 'archive' | 'behavior' | 'observations' | 'visits'>('overview');
  
  // Data State
  const [history, setHistory] = useState<ExcuseRequest[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<{ date: string, status: AttendanceStatus }[]>([]);
  const [behaviorHistory, setBehaviorHistory] = useState<BehaviorRecord[]>([]);
  const [observations, setObservations] = useState<StudentObservation[]>([]);
  const [points, setPoints] = useState<{total: number, history: StudentPoint[]}>({ total: 0, history: [] });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newChildId, setNewChildId] = useState('');
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [smartReport, setSmartReport] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  
  // Reply State
  const [replyMode, setReplyMode] = useState<{ id: string, type: 'behavior' | 'observation' } | null>(null);
  const [replyContent, setReplyContent] = useState('');
  
  // Calendar
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Appointments
  const [availableSlots, setAvailableSlots] = useState<AppointmentSlot[]>([]);
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [visitReason, setVisitReason] = useState('');
  const [parentNameForVisit, setParentNameForVisit] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<Appointment | null>(null);

  // Authentication & Load Logic
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

  // Helpers
  const handleAddChild = async (e: React.FormEvent) => { e.preventDefault(); if (!newChildId) return; setLoading(true); try { const student = await getStudentByCivilId(newChildId); if (!student) { alert("لم يتم العثور على طالب بهذا الرقم."); } else { await linkParentToStudent(parentCivilId, student.studentId); await loadParentDashboard(); setNewChildId(''); setIsAddingChild(false); alert("تم الإضافة!"); } } catch (e) { alert("حدث خطأ."); } finally { setLoading(false); } };
  
  const handleSelectStudent = async (student: Student) => {
      setSelectedStudent(student);
      setLoading(true);
      try {
          const [reqs, att, beh, obs, pts, slots, apps] = await Promise.all([
              getRequestsByStudentId(student.studentId),
              getStudentAttendanceHistory(student.studentId, student.grade, student.className),
              getBehaviorRecords(student.studentId),
              getStudentObservations(student.studentId),
              getStudentPoints(student.studentId),
              getAvailableSlots(),
              getMyAppointments(parentCivilId)
          ]);
          setHistory(reqs);
          setAttendanceHistory(att);
          setBehaviorHistory(beh);
          setObservations(obs);
          setPoints(pts);
          setAvailableSlots(slots);
          setMyAppointments(apps.filter(a => a.studentId === student.studentId));
          setActiveTab('overview');
      } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const unexcusedAbsences = useMemo(() => { if (!attendanceHistory.length) return []; return attendanceHistory.filter(record => { if (record.status !== AttendanceStatus.ABSENT) return false; const hasRequest = history.some(req => req.date === record.date); return !hasRequest; }); }, [attendanceHistory, history]);
  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  
  // Reply Logic
  const handleSubmitReply = async () => {
      if (!replyMode || !replyContent.trim()) return;
      setSubmittingReply(true);
      try {
          if (replyMode.type === 'behavior') await acknowledgeBehavior(replyMode.id, replyContent);
          else await acknowledgeObservation(replyMode.id, replyContent);
          if(selectedStudent) await handleSelectStudent(selectedStudent);
          setReplyMode(null); setReplyContent(''); alert("تم إرسال الرد.");
      } catch(e) { alert("حدث خطأ"); } finally { setSubmittingReply(false); }
  };

  const handleGenerateSmartReport = async () => { if (!selectedStudent) return; setGeneratingReport(true); try { const report = await generateSmartStudentReport(selectedStudent.name, attendanceHistory, behaviorHistory, points.total); setSmartReport(report); } catch (e) { alert("فشل التوليد"); } finally { setGeneratingReport(false); } };

  // BOOKING LOGIC
  const handleBookSlot = async (slot: AppointmentSlot) => {
      if (!visitReason || !parentNameForVisit) { alert("يرجى إدخال اسم ولي الأمر وسبب الزيارة"); return; }
      if (!selectedStudent) return;
      setIsBooking(true);
      try {
          const appt = await bookAppointment({
              slotId: slot.id,
              studentId: selectedStudent.studentId,
              studentName: selectedStudent.name,
              parentName: parentNameForVisit,
              parentCivilId: parentCivilId,
              visitReason: visitReason
          });
          setBookingSuccess(appt);
          setShowBookingModal(true);
          setVisitReason('');
          const [newSlots, newApps] = await Promise.all([getAvailableSlots(), getMyAppointments(parentCivilId)]);
          setAvailableSlots(newSlots);
          setMyAppointments(newApps.filter(a => a.studentId === selectedStudent.studentId));
      } catch (e: any) { alert(e.message || "حدث خطأ"); } finally { setIsBooking(false); }
  };

  // Calendar Logic
  const getDaysInMonth = (date: Date) => { const year = date.getFullYear(); const month = date.getMonth(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const firstDay = new Date(year, month, 1).getDay(); const days = []; for (let i = 0; i < firstDay; i++) days.push(null); for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i)); return days; };
  const getAttendanceStatusForDate = (date: Date) => { const dateStr = date.toISOString().split('T')[0]; const record = attendanceHistory.find(r => r.date === dateStr); return record ? record.status : null; };
  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (!isAuthenticated) {
      return (<div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans"><div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative overflow-hidden"><div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-purple-600"></div><div className="text-center mb-8"><div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100"><Users size={32} className="text-blue-600"/></div><h1 className="text-2xl font-bold text-slate-800">بوابة ولي الأمر</h1><p className="text-slate-500 text-sm mt-2">سجل دخولك برقم الهوية لمتابعة أبنائك</p></div><form onSubmit={handleLogin} className="space-y-6"><div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase">رقم الهوية / السجل المدني</label><input type="text" required maxLength={10} value={parentCivilId} onChange={e => setParentCivilId(e.target.value.replace(/[^0-9]/g, ''))} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xl font-bold tracking-widest focus:ring-2 focus:ring-blue-600 outline-none" placeholder="1XXXXXXXXX"/></div><button disabled={authLoading} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">{authLoading ? <Loader2 className="animate-spin"/> : 'تسجيل الدخول'}</button></form></div></div>);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans relative">
        <div className="bg-white sticky top-0 z-30 border-b border-slate-100 shadow-sm"><div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between"><div className="flex items-center gap-2 font-bold text-slate-800"><Users className="text-blue-600"/> بوابة ولي الأمر</div><div className="flex items-center gap-3"><button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-full hover:bg-slate-100"><Bell size={24} className="text-slate-600"/>{unreadCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}</button><button onClick={handleLogout} className="p-2 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500"><LogOut size={20}/></button></div></div></div>
        {showNotifications && (<div className="max-w-5xl mx-auto px-4 relative z-20"><div className="absolute top-2 left-4 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden"><div className="p-3 border-b border-slate-50 font-bold text-sm bg-slate-50">الإشعارات</div><div className="max-h-64 overflow-y-auto">{notifications.length === 0 ? <p className="p-4 text-center text-xs text-slate-400">لا توجد إشعارات</p> : notifications.map(n => (<div key={n.id} className={`p-3 border-b border-slate-50 text-sm ${!n.isRead ? 'bg-blue-50/50' : ''}`} onClick={() => markNotificationRead(n.id)}><p className="font-bold text-slate-800">{n.title}</p><p className="text-xs text-slate-500 mt-1">{n.message}</p></div>))}</div></div></div>)}

        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
            
            {/* NEWS */}
            {news.length > 0 && !selectedStudent && (
                <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden p-4 relative animate-fade-in"><div className="flex items-center gap-2 mb-3"><span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider animate-pulse">هام</span><h3 className="font-bold text-slate-800 flex items-center gap-2"><Newspaper size={16} className="text-blue-500"/> أخبار المدرسة</h3></div><div className="space-y-3">{news.slice(0, 3).map(n => (<div key={n.id} className={`p-3 rounded-xl border-l-4 ${n.isUrgent ? 'bg-red-50 border-red-500' : 'bg-slate-50 border-blue-500'}`}><h4 className="font-bold text-sm text-slate-900">{n.title}</h4><p className="text-xs text-slate-600 mt-1 line-clamp-2">{n.content}</p><div className="mt-2 text-[10px] text-slate-400 flex justify-between"><span>{new Date(n.createdAt).toLocaleDateString('ar-SA')}</span><span>بواسطة: {n.author}</span></div></div>))}</div></div>
            )}

            {/* Children List */}
            {!selectedStudent ? (
                <div className="animate-fade-in space-y-6">
                    <div className="flex justify-between items-center"><h2 className="text-xl font-bold text-slate-800">أبنائي</h2><button onClick={() => setIsAddingChild(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-200"><Plus size={16}/> إضافة ابن</button></div>
                    {isAddingChild && (<div className="bg-white p-4 rounded-2xl shadow-sm border border-blue-100 animate-fade-in-up"><form onSubmit={handleAddChild} className="flex gap-2"><input autoFocus placeholder="رقم هوية الطالب..." value={newChildId} onChange={e => setNewChildId(e.target.value)} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 font-bold text-slate-800"/><button disabled={loading} className="bg-blue-600 text-white px-6 rounded-xl font-bold">{loading ? <Loader2 className="animate-spin"/> : 'إضافة'}</button><button type="button" onClick={() => setIsAddingChild(false)} className="bg-slate-100 text-slate-500 px-4 rounded-xl font-bold">إلغاء</button></form></div>)}
                    {myChildren.length === 0 ? (<div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300"><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"><Users className="text-slate-300"/></div><p className="font-bold text-slate-500">لم يتم ربط أي طلاب بحسابك بعد.</p><p className="text-sm text-slate-400 mt-1">اضغط "إضافة ابن" وأدخل رقم الهوية.</p></div>) : (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">{myChildren.map(child => (<div key={child.id} onClick={() => handleSelectStudent(child)} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"><div className="flex items-center gap-4"><div className="w-14 h-14 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xl font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors">{child.name.charAt(0)}</div><div><h3 className="font-bold text-lg text-slate-900 group-hover:text-blue-800">{child.name}</h3><p className="text-sm text-slate-500">{child.grade} - {child.className}</p></div><ChevronRight className="mr-auto text-slate-300 group-hover:text-blue-500"/></div></div>))}</div>)}
                </div>
            ) : (
                <div className="animate-fade-in space-y-6">
                    <button onClick={() => setSelectedStudent(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold mb-4"><ArrowLeft size={18}/> العودة للقائمة</button>
                    
                    {/* Header */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-blue-50 to-transparent"></div>
                        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-right">
                            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-3xl font-bold shadow-inner">{selectedStudent.name.charAt(0)}</div>
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold text-slate-900">{selectedStudent.name}</h2>
                                <p className="text-slate-500">{selectedStudent.grade} - {selectedStudent.className}</p>
                                <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-3">
                                    <div className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 border border-amber-100"><Star size={16}/> {points.total} نقطة تميز</div>
                                    <button onClick={() => setShowDigitalId(true)} className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 border border-purple-100 hover:bg-purple-100 transition-colors"><CreditCard size={16}/> البطاقة الرقمية</button>
                                </div>
                            </div>
                            <button onClick={() => navigate(`/submit?studentId=${selectedStudent.studentId}`)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2"><FileText size={18}/> تقديم عذر</button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {[{ id: 'overview', label: 'ملخص', icon: Activity }, { id: 'visits', label: 'حجز موعد', icon: CalendarCheck }, { id: 'report', label: 'التقرير الذكي', icon: Sparkles }, { id: 'attendance', label: 'التقويم', icon: CalendarDays }, { id: 'archive', label: 'أرشيف الأعذار', icon: Archive }, { id: 'behavior', label: 'السلوك', icon: ShieldAlert }, { id: 'observations', label: 'الملاحظات', icon: MessageSquare }].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap border ${activeTab === tab.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}><tab.icon size={16}/> {tab.label}</button>
                        ))}
                    </div>

                    {loading ? <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600"/></div> : (
                        <div className="min-h-[300px]">
                            {/* OVERVIEW */}
                            {activeTab === 'overview' && (
                                <div className="space-y-6 animate-fade-in">
                                    {unexcusedAbsences.length > 0 && (<div className="bg-red-50 border-2 border-red-100 rounded-2xl p-5 shadow-sm"><div className="flex justify-between items-start mb-4"><h3 className="font-bold text-red-800 flex items-center gap-2"><AlertTriangle className="text-red-600"/> غياب لم يتم تقديم عذر له</h3><span className="bg-white text-red-600 px-3 py-1 rounded-lg text-xs font-bold border border-red-100">{unexcusedAbsences.length} أيام</span></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{unexcusedAbsences.map((rec, idx) => (<div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-red-100"><span className="font-mono font-bold text-slate-700">{rec.date}</span><button onClick={() => navigate(`/submit?studentId=${selectedStudent.studentId}&date=${rec.date}`)} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-700 transition-colors">تقديم عذر</button></div>))}</div></div>)}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Clock className="text-blue-500"/> الحضور والغياب</h3><div className="flex justify-between text-center"><div><p className="text-2xl font-bold text-red-600">{attendanceHistory.filter(x=>x.status==='ABSENT').length}</p><p className="text-xs text-slate-400">غياب</p></div><div><p className="text-2xl font-bold text-amber-500">{attendanceHistory.filter(x=>x.status==='LATE').length}</p><p className="text-xs text-slate-400">تأخر</p></div><div><p className="text-2xl font-bold text-emerald-600">{attendanceHistory.filter(x=>x.status==='PRESENT').length}</p><p className="text-xs text-slate-400">حضور</p></div></div></div><div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Star className="text-amber-500"/> نقاط التميز</h3>{points.history.length > 0 ? (<div className="space-y-3">{points.history.slice(0,3).map(p => (<div key={p.id} className="flex justify-between text-sm bg-amber-50 p-2 rounded-lg text-amber-800"><span>{p.reason}</span><span className="font-bold">+{p.points}</span></div>))}</div>) : <p className="text-slate-400 text-sm">لا يوجد نقاط مكتسبة بعد.</p>}</div></div>
                                </div>
                            )}

                            {/* ARCHIVE - FIXED */}
                            {activeTab === 'archive' && (
                                <div className="space-y-4 animate-fade-in">
                                    {history.length === 0 ? (
                                        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
                                            <FileText size={48} className="mx-auto mb-4 opacity-20 text-slate-400"/>
                                            <p className="text-slate-500 font-medium">لم يتم تقديم أي أعذار سابقة لهذا الطالب.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-4">
                                            {history.map(req => (
                                                <div key={req.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-4 items-start md:items-center justify-between group">
                                                    <div className="flex items-start gap-4">
                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-xl font-bold ${
                                                            req.status === RequestStatus.APPROVED ? 'bg-emerald-100 text-emerald-600' :
                                                            req.status === RequestStatus.REJECTED ? 'bg-red-100 text-red-600' :
                                                            'bg-amber-100 text-amber-600'
                                                        }`}>
                                                            {req.status === RequestStatus.APPROVED ? <CheckCircle size={24}/> :
                                                             req.status === RequestStatus.REJECTED ? <X size={24}/> :
                                                             <Clock size={24}/>}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-mono font-bold text-slate-800 text-lg">{req.date}</span>
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                    req.status === RequestStatus.APPROVED ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                                    req.status === RequestStatus.REJECTED ? 'bg-red-50 text-red-700 border border-red-100' :
                                                                    'bg-amber-50 text-amber-700 border border-amber-100'
                                                                }`}>
                                                                    {req.status === RequestStatus.APPROVED ? 'تم القبول' : req.status === RequestStatus.REJECTED ? 'مرفوض' : 'قيد المراجعة'}
                                                                </span>
                                                            </div>
                                                            <p className="text-slate-600 font-medium text-sm">{req.reason} {req.details ? `- ${req.details}` : ''}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    {req.attachmentUrl && (
                                                        <a 
                                                            href={req.attachmentUrl} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors border border-slate-100 w-full md:w-auto justify-center"
                                                        >
                                                            <Paperclip size={14}/> عرض المرفق
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ATTENDANCE CALENDAR - FIXED */}
                            {activeTab === 'attendance' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                        <div className="flex justify-between items-center mb-6">
                                            <button onClick={() => setCalendarMonth(new Date(calendarMonth.setMonth(calendarMonth.getMonth() - 1)))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight size={20}/></button>
                                            <h3 className="font-bold text-lg text-slate-800">{calendarMonth.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}</h3>
                                            <button onClick={() => setCalendarMonth(new Date(calendarMonth.setMonth(calendarMonth.getMonth() + 1)))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft size={20}/></button>
                                        </div>
                                        <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 mb-2">
                                            <div>الأحد</div><div>الإثنين</div><div>الثلاثاء</div><div>الأربعاء</div><div>الخميس</div><div>الجمعة</div><div>السبت</div>
                                        </div>
                                        <div className="grid grid-cols-7 gap-2">
                                            {getDaysInMonth(calendarMonth).map((date, i) => {
                                                if (!date) return <div key={i}></div>;
                                                const status = getAttendanceStatusForDate(date);
                                                const isWeekend = date.getDay() === 5 || date.getDay() === 6;
                                                const isFuture = date > new Date();
                                                
                                                let bgClass = 'bg-slate-50 border-slate-100 text-slate-700';
                                                if (status === AttendanceStatus.ABSENT) bgClass = 'bg-red-500 text-white border-red-500 shadow-md shadow-red-200';
                                                else if (status === AttendanceStatus.LATE) bgClass = 'bg-amber-400 text-white border-amber-400 shadow-md shadow-amber-200';
                                                else if (status === AttendanceStatus.PRESENT) bgClass = 'bg-emerald-500 text-white border-emerald-500';
                                                else if (isWeekend) bgClass = 'bg-slate-100 text-slate-300 border-transparent';
                                                
                                                return (
                                                    <div key={i} className={`h-12 md:h-16 rounded-xl border flex items-center justify-center text-sm font-bold transition-all ${bgClass} ${!isWeekend && !isFuture && !status ? 'opacity-50' : ''}`}>
                                                        {date.getDate()}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex gap-4 justify-center mt-6 text-xs font-bold text-slate-600">
                                            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500"></div>حضور</div>
                                            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div>غياب</div>
                                            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-amber-400"></div>تأخر</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SMART REPORT - FIXED */}
                            {activeTab === 'report' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white relative overflow-hidden shadow-lg">
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                                        <div className="relative z-10 text-center">
                                            <Sparkles className="mx-auto mb-4 text-amber-300" size={48}/>
                                            <h2 className="text-2xl font-bold mb-2">التقرير التربوي الذكي</h2>
                                            <p className="text-blue-100 mb-6 max-w-md mx-auto">يقوم نظامنا بتحليل بيانات الحضور والسلوك والملاحظات ليقدم لك تقريراً شاملاً ونصائح تربوية مخصصة لابنك.</p>
                                            <button 
                                                onClick={handleGenerateSmartReport} 
                                                disabled={generatingReport}
                                                className="bg-white text-blue-700 px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-50 transition-all flex items-center justify-center gap-2 mx-auto disabled:opacity-70 disabled:cursor-not-allowed"
                                            >
                                                {generatingReport ? <Loader2 className="animate-spin"/> : <Sparkles size={18}/>}
                                                {generatingReport ? 'جاري إعداد التقرير...' : 'إصدار التقرير الآن'}
                                            </button>
                                        </div>
                                    </div>

                                    {smartReport && (
                                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm animate-fade-in-up">
                                            <div className="prose prose-lg text-slate-800 leading-relaxed whitespace-pre-line font-medium text-right">
                                                {smartReport}
                                            </div>
                                            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                                                <button onClick={() => window.print()} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold">
                                                    <Printer size={18}/> طباعة التقرير
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* Visits */}
                            {activeTab === 'visits' && (
                                <div className="space-y-6 animate-fade-in">
                                    {myAppointments.filter(a => a.status === 'pending').length > 0 && (
                                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl"><h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2"><Clock size={18}/> حجوزاتك القادمة</h3>{myAppointments.filter(a => a.status === 'pending').map(a => (<div key={a.id} className="bg-white p-3 rounded-xl border border-amber-100 flex justify-between items-center mb-2"><div><p className="font-bold text-slate-800">{a.slot?.date}</p><p className="text-xs text-slate-500">{a.slot?.startTime} - {a.slot?.endTime}</p></div><button onClick={() => { setBookingSuccess(a); setShowBookingModal(true); }} className="text-xs bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg font-bold">عرض التذكرة</button></div>))}</div>
                                    )}
                                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"><h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><CalendarCheck className="text-blue-600"/> المواعيد المتاحة للحجز</h3>{availableSlots.length === 0 ? (<div className="text-center py-10 text-slate-400"><CalendarDays size={40} className="mx-auto mb-2 opacity-30"/><p>لا توجد مواعيد متاحة حالياً.</p></div>) : (<div className="space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-xs font-bold text-slate-500 block mb-1.5">اسم ولي الأمر (الزائر)</label><input value={parentNameForVisit} onChange={e => setParentNameForVisit(e.target.value)} className="w-full p-3 border rounded-xl font-bold text-sm bg-slate-50 focus:ring-2 focus:ring-blue-100 outline-none" placeholder="الاسم الثلاثي..."/></div><div><label className="text-xs font-bold text-slate-500 block mb-1.5">سبب الزيارة</label><input value={visitReason} onChange={e => setVisitReason(e.target.value)} className="w-full p-3 border rounded-xl font-bold text-sm bg-slate-50 focus:ring-2 focus:ring-blue-100 outline-none" placeholder="مثال: مناقشة مستوى الطالب..."/></div></div><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{availableSlots.map(slot => (<button key={slot.id} onClick={() => handleBookSlot(slot)} disabled={isBooking || slot.currentBookings >= slot.maxCapacity} className={`border rounded-xl p-4 text-right transition-all relative overflow-hidden group ${slot.currentBookings >= slot.maxCapacity ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:border-blue-400 hover:shadow-md bg-white'}`}>{slot.currentBookings >= slot.maxCapacity && <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 font-bold text-slate-500 z-10">ممتلئ</div>}<p className="font-bold text-blue-900">{slot.date}</p><p className="text-sm text-slate-600 mt-1 font-mono">{slot.startTime} - {slot.endTime}</p><div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden"><div className="bg-blue-500 h-full rounded-full" style={{width: `${(slot.currentBookings/slot.maxCapacity)*100}%`}}></div></div><p className="text-[10px] text-slate-400 mt-1 text-left">المتبقي: {slot.maxCapacity - slot.currentBookings}</p></button>))}</div></div>)}</div>
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
                                                            <textarea className="w-full p-3 border rounded-xl text-sm mb-2 outline-none focus:ring-2 focus:ring-blue-100" placeholder="اكتب ردك..." value={replyContent} onChange={e => setReplyContent(e.target.value)} autoFocus></textarea>
                                                            <div className="flex gap-2 justify-end"><button onClick={() => { setReplyMode(null); setReplyContent(''); }} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors">إلغاء</button><button onClick={handleSubmitReply} disabled={submittingReply} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1">{submittingReply ? <Loader2 className="animate-spin" size={14}/> : <Send size={14}/>} إرسال</button></div>
                                                        </div>
                                                    ) : (<button onClick={() => { setReplyMode({id: rec.id, type: 'behavior'}); setReplyContent(''); }} className="w-full bg-red-50 text-red-700 py-2 rounded-lg text-sm font-bold border border-red-100 hover:bg-red-100 transition-colors">تأكيد الاطلاع والرد</button>)}
                                                </div>
                                            ) : (<div className="mt-3 bg-slate-50 p-3 rounded-xl text-xs text-slate-500 flex items-center gap-2 border border-slate-100"><CheckCircle size={16} className="text-emerald-500"/><div><span className="font-bold text-emerald-700 block">تم الاطلاع</span>{rec.parentFeedback && <span className="text-slate-600 mt-1 block">رد ولي الأمر: {rec.parentFeedback}</span>}</div></div>)}
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

        {/* SUCCESS BOOKING MODAL */}
        {showBookingModal && bookingSuccess && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in" onClick={() => setShowBookingModal(false)}>
                 <div className="bg-teal-600 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden w-full max-w-md" onClick={e => e.stopPropagation()}>
                     <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10"></div>
                     <div className="flex justify-between items-start relative z-10">
                         <div>
                             <h3 className="text-2xl font-bold mb-1 flex items-center gap-2"><CheckCircle/> تم تأكيد الحجز!</h3>
                             <p className="opacity-90 text-sm">يرجى إبراز هذا الرمز عند بوابة المدرسة</p>
                         </div>
                         <button onClick={() => setShowBookingModal(false)} className="bg-white/20 p-1 rounded-full hover:bg-white/30"><X size={20}/></button>
                     </div>
                     <div className="mt-6 bg-white text-slate-900 rounded-2xl p-4 flex flex-col items-center gap-6">
                         <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${bookingSuccess.id}`} alt="Booking QR" className="w-40 h-40 mix-blend-multiply"/>
                         </div>
                         <div className="w-full grid grid-cols-2 gap-4 text-sm text-center">
                             <div className="bg-slate-50 p-2 rounded-lg"><p className="text-slate-400 font-bold text-xs">التاريخ</p><p className="font-bold">{bookingSuccess.slot?.date}</p></div>
                             <div className="bg-slate-50 p-2 rounded-lg"><p className="text-slate-400 font-bold text-xs">الوقت</p><p className="font-bold">{bookingSuccess.slot?.startTime}</p></div>
                         </div>
                         <button onClick={() => setShowBookingModal(false)} className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold">إغلاق</button>
                     </div>
                 </div>
             </div>
        )}

        {/* DIGITAL ID MODAL */}
        {showDigitalId && selectedStudent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in" onClick={() => setShowDigitalId(false)}>
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden relative" onClick={e => e.stopPropagation()}>
                    <div className="h-32 bg-blue-900 relative">
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 p-1 bg-white rounded-full">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-2xl font-bold text-slate-600 border-2 border-slate-200">{selectedStudent.name.charAt(0)}</div>
                        </div>
                    </div>
                    <div className="pt-12 pb-8 px-6 text-center">
                        <h2 className="text-2xl font-bold text-slate-900">{selectedStudent.name}</h2>
                        <p className="text-slate-500 text-sm mt-1">طالب منتظم - {selectedStudent.grade}</p>
                        <div className="my-6 border-t border-b border-slate-100 py-4 grid grid-cols-2 gap-4"><div><p className="text-xs text-slate-400 font-bold uppercase">الرقم الأكاديمي</p><p className="font-mono font-bold text-slate-800">{selectedStudent.studentId}</p></div><div><p className="text-xs text-slate-400 font-bold uppercase">الفصل</p><p className="font-bold text-slate-800">{selectedStudent.className}</p></div></div>
                        <div className="bg-white p-2 rounded-xl inline-block border border-slate-200"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${selectedStudent.studentId}`} alt="ID QR" className="w-32 h-32" /></div>
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
