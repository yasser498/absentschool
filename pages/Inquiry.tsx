
import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { 
  Search, User, School, Copy, Check, CalendarDays, AlertCircle, Loader2, 
  FileText, ShieldAlert, Star, MessageSquare, Send, CheckCircle, Clock, Plus, Users, Bell, 
  LogOut, ChevronRight, ArrowLeft, Activity, ChevronLeft, Archive, AlertTriangle, 
  Newspaper, CreditCard, X, Sparkles, CalendarCheck, QrCode, Paperclip, Printer, LogOut as ExitIcon, Calendar, Medal, Trophy, Phone, ArrowRight, Info
} from 'lucide-react';
import { 
  getStudentByCivilId, getRequestsByStudentId, getStudentAttendanceHistory, 
  getBehaviorRecords, getStudentObservations, acknowledgeBehavior, 
  acknowledgeObservation, getParentChildren, linkParentToStudent, 
  getNotifications, markNotificationRead, getStudentPoints, getSchoolNews, generateSmartStudentReport,
  getAvailableSlots, bookAppointment, getMyAppointments, getMyExitPermissions, getStudentsByPhone
} from '../services/storage';
import { 
  Student, ExcuseRequest, RequestStatus, AttendanceStatus, BehaviorRecord, 
  StudentObservation, AppNotification, StudentPoint, SchoolNews, AppointmentSlot, Appointment, ExitPermission 
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
  const [selectedNews, setSelectedNews] = useState<SchoolNews | null>(null);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'report' | 'calendar' | 'archive' | 'behavior' | 'positive_behavior' | 'observations' | 'visits' | 'exits'>('overview');
  
  // Data State
  const [history, setHistory] = useState<ExcuseRequest[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<{ date: string, status: AttendanceStatus }[]>([]);
  const [behaviorHistory, setBehaviorHistory] = useState<BehaviorRecord[]>([]);
  const [positiveObservations, setPositiveObservations] = useState<StudentObservation[]>([]);
  const [observations, setObservations] = useState<StudentObservation[]>([]);
  const [points, setPoints] = useState<{total: number, history: StudentPoint[]}>({ total: 0, history: [] });
  const [exitPermissions, setExitPermissions] = useState<ExitPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newChildInput, setNewChildInput] = useState('');
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [smartReport, setSmartReport] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  
  // Printing State
  const [printMode, setPrintMode] = useState<'none' | 'certificate'>('none');
  const [certificateData, setCertificateData] = useState<{studentName: string, reason: string, date: string, points?: number} | null>(null);

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

  const SCHOOL_NAME = localStorage.getItem('school_name') || "متوسطة عماد الدين زنكي";
  const SCHOOL_LOGO = localStorage.getItem('school_logo') || "https://www.raed.net/img?id=1471924";

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
  const handleAddChild = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      if (!newChildInput) return; 
      setLoading(true); 
      
      try { 
          const isPhone = newChildInput.startsWith('05') || newChildInput.startsWith('966');
          
          if (isPhone) {
              const students = await getStudentsByPhone(newChildInput);
              if (students.length === 0) {
                  alert("لم يتم العثور على طلاب مسجلين برقم الجوال هذا.");
              } else {
                  for (const s of students) {
                      await linkParentToStudent(parentCivilId, s.studentId);
                  }
                  await loadParentDashboard();
                  setNewChildInput(''); 
                  setIsAddingChild(false); 
                  alert(`تم إضافة ${students.length} طالب/طلاب بنجاح!`);
              }
          } else {
              const student = await getStudentByCivilId(newChildInput); 
              if (!student) { 
                  alert("لم يتم العثور على طالب بهذا الرقم."); 
              } else { 
                  await linkParentToStudent(parentCivilId, student.studentId); 
                  await loadParentDashboard(); 
                  setNewChildInput(''); 
                  setIsAddingChild(false); 
                  alert("تم الإضافة!"); 
              } 
          }
      } catch (e) { 
          alert("حدث خطأ."); 
      } finally { 
          setLoading(false); 
      } 
  };
  
  const handleSelectStudent = async (student: Student) => {
      setSelectedStudent(student);
      setLoading(true);
      try {
          const [reqs, att, beh, allObs, pts, slots, apps, exits] = await Promise.all([
              getRequestsByStudentId(student.studentId),
              getStudentAttendanceHistory(student.studentId, student.grade, student.className),
              getBehaviorRecords(student.studentId),
              getStudentObservations(student.studentId),
              getStudentPoints(student.studentId),
              getAvailableSlots(),
              getMyAppointments(parentCivilId),
              getMyExitPermissions([student.studentId])
          ]);
          
          setHistory(reqs);
          setAttendanceHistory(att);
          setBehaviorHistory(beh);
          setPositiveObservations(allObs.filter(o => o.type === 'positive'));
          setObservations(allObs.filter(o => o.type !== 'positive'));
          setPoints(pts);
          setAvailableSlots(slots);
          setMyAppointments(apps.filter(a => a.studentId === student.studentId));
          setExitPermissions(exits);
          setActiveTab('overview');
          setSmartReport(null); // Reset report
      } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const unexcusedAbsences = useMemo(() => { 
      if (!attendanceHistory.length) return []; 
      return attendanceHistory.filter(record => { 
          if (record.status !== AttendanceStatus.ABSENT) return false; 
          // Check if there is an approved excuse for this date
          const hasRequest = history.some(req => req.date === record.date && req.status !== RequestStatus.REJECTED); 
          return !hasRequest; 
      }); 
  }, [attendanceHistory, history]);

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  
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

  const handleGenerateSmartReport = async () => { 
      if (!selectedStudent) return; 
      setGeneratingReport(true); 
      try { 
          const report = await generateSmartStudentReport(selectedStudent.name, attendanceHistory, behaviorHistory, points.total); 
          setSmartReport(report); 
      } catch (e) { 
          alert("فشل التوليد، حاول مرة أخرى لاحقاً"); 
      } finally { 
          setGeneratingReport(false); 
      } 
  };

  const handlePrintCertificate = (record: StudentObservation) => {
      if (!selectedStudent) return;
      let reason = record.content.replace('تعزيز سلوكي: ', '');
      let pts = 5;
      const pointsMatch = reason.match(/\((\d+) درجات\)/);
      if (pointsMatch) { pts = parseInt(pointsMatch[1]); reason = reason.replace(pointsMatch[0], '').trim(); }
      setCertificateData({ studentName: selectedStudent.name, reason: reason, date: record.date, points: pts });
      setPrintMode('certificate');
      setTimeout(() => { window.print(); setPrintMode('none'); }, 300);
  };

  const handleBookSlot = async (slot: AppointmentSlot) => {
      if (!visitReason || !parentNameForVisit) { alert("يرجى إدخال اسم ولي الأمر وسبب الزيارة"); return; }
      if (!selectedStudent) return;
      setIsBooking(true);
      try {
          const appt = await bookAppointment({ slotId: slot.id, studentId: selectedStudent.studentId, studentName: selectedStudent.name, parentName: parentNameForVisit, parentCivilId: parentCivilId, visitReason: visitReason });
          setBookingSuccess(appt); setShowBookingModal(true); setVisitReason('');
          const [newSlots, newApps] = await Promise.all([getAvailableSlots(), getMyAppointments(parentCivilId)]);
          setAvailableSlots(newSlots); setMyAppointments(newApps.filter(a => a.studentId === selectedStudent.studentId));
      } catch (e: any) { alert(e.message || "حدث خطأ"); } finally { setIsBooking(false); }
  };

  const getDaysInMonth = (date: Date) => { const year = date.getFullYear(); const month = date.getMonth(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const firstDay = new Date(year, month, 1).getDay(); const days = []; for (let i = 0; i < firstDay; i++) days.push(null); for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i)); return days; };
  
  // Enhanced Calendar Logic
  const getDateStatusInfo = (date: Date) => { 
      const dateStr = date.toISOString().split('T')[0]; 
      const attendance = attendanceHistory.find(r => r.date === dateStr);
      const excuse = history.find(req => req.date === dateStr && req.status !== RequestStatus.REJECTED);
      const exit = exitPermissions.find(e => e.createdAt.startsWith(dateStr));

      // Hierarchy: Absent (Unexcused) > Absent (Excused) > Exit Permission > Late > Present
      if (attendance?.status === AttendanceStatus.ABSENT) {
          if (excuse) return { type: 'excused', color: 'bg-blue-500 text-white', label: 'غياب بعذر' };
          return { type: 'absent', color: 'bg-red-500 text-white shadow-md shadow-red-200', label: 'غياب بدون عذر' };
      }
      if (attendance?.status === AttendanceStatus.LATE) {
          return { type: 'late', color: 'bg-amber-400 text-white', label: 'تأخر' };
      }
      if (exit) {
          return { type: 'exit', color: 'bg-purple-500 text-white', label: 'استئذان' };
      }
      if (attendance?.status === AttendanceStatus.PRESENT) {
          return { type: 'present', color: 'bg-emerald-500 text-white', label: 'حضور' };
      }
      return null;
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Render Login Screen
  if (!isAuthenticated) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
            <div className="absolute -top-20 -right-20 w-72 h-72 bg-blue-600 rounded-full blur-[100px] opacity-20"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600 rounded-full blur-[80px] opacity-20"></div>

            <div className="w-full max-w-md relative z-10">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl text-center">
                    <div className="w-24 h-24 bg-white rounded-full p-2 mx-auto mb-6 shadow-lg flex items-center justify-center">
                        <img src={SCHOOL_LOGO} alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">بوابة ولي الأمر</h1>
                    <p className="text-slate-300 text-sm mb-8">سجل دخولك برقم الهوية لمتابعة أبنائك</p>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2 text-right">
                            <label className="text-xs font-bold text-slate-300 uppercase mr-1">رقم الهوية / السجل المدني</label>
                            <input 
                                type="tel" 
                                required 
                                maxLength={10} 
                                value={parentCivilId} 
                                onChange={e => setParentCivilId(e.target.value.replace(/[^0-9]/g, ''))} 
                                className="w-full p-4 bg-slate-800/50 border border-slate-600 rounded-2xl text-center text-xl font-bold tracking-widest text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                                placeholder="1XXXXXXXXX"
                            />
                        </div>
                        <button 
                            disabled={authLoading} 
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-2xl font-bold hover:shadow-lg hover:shadow-blue-600/30 transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                            {authLoading ? <Loader2 className="animate-spin"/> : 'تسجيل الدخول'}
                        </button>
                    </form>
                </div>
                <p className="text-center text-slate-500 text-xs mt-6">© {new Date().getFullYear()} {SCHOOL_NAME}</p>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans relative">
        
        {/* CERTIFICATE PRINT TEMPLATE */}
        <div id="print-area" className="hidden" dir="rtl">
            {printMode === 'certificate' && certificateData && (
                <div className="certificate-border text-center flex flex-col justify-between p-10 h-full bg-white relative overflow-hidden">
                    <img src="https://www.raed.net/img?id=1474173" className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-5 w-2/3 pointer-events-none" />
                    
                    <div className="flex justify-between items-start mb-8 relative z-10">
                        <div className="text-right text-xs font-bold">
                            <p>المملكة العربية السعودية</p>
                            <p>وزارة التعليم</p>
                            <p>{SCHOOL_NAME}</p>
                        </div>
                        <img src="https://www.raed.net/img?id=1474173" className="h-24 w-auto object-contain" alt="Logo" />
                        <div className="text-left text-xs font-bold">
                            <p>Kingdom of Saudi Arabia</p>
                            <p>Ministry of Education</p>
                        </div>
                    </div>

                    <div className="relative z-10 flex-1 flex flex-col justify-center">
                        <h1 className="text-4xl font-extrabold text-slate-800 mb-2">شهادة شكر وتقدير</h1>
                        <div className="w-1/3 h-1 bg-amber-400 mx-auto mb-8 rounded-full"></div>
                        
                        <p className="text-lg mb-6 leading-loose">
                            تسر إدارة المدرسة ووكالة شؤون الطلاب أن تتقدم بخالص الشكر والتقدير للطالب:
                        </p>
                        <h2 className="text-3xl font-bold text-blue-900 mb-8 underline underline-offset-8 decoration-amber-400 decoration-4">
                            {certificateData.studentName}
                        </h2>
                        <p className="text-lg mb-4">
                            وذلك لتميزه في: <span className="font-bold">{certificateData.reason}</span>
                        </p>
                        {certificateData.points && (
                            <div className="inline-block bg-slate-100 border border-slate-300 px-6 py-2 rounded-xl text-lg font-bold my-4">
                                تم منحه {certificateData.points} نقاط تميز
                            </div>
                        )}
                        <p className="text-lg mt-6">
                            متمنين له دوام التوفيق والنجاح.
                        </p>
                    </div>

                    <div className="flex justify-between items-end mt-16 px-10 relative z-10">
                        <div className="text-center">
                            <p className="font-bold mb-4">وكيل شؤون الطلاب</p>
                            <p className="text-slate-400">.............................</p>
                        </div>
                        <div className="text-center">
                            <div className="w-24 h-24 border-2 border-slate-300 rounded-full flex items-center justify-center text-slate-300 font-bold mb-2">
                                الختم
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="font-bold mb-4">مدير المدرسة</p>
                            <p className="text-slate-400">.............................</p>
                        </div>
                    </div>
                    <div className="text-center text-xs mt-8 text-slate-400">
                        تاريخ الإصدار: {certificateData.date} | شهادة إلكترونية معتمدة
                    </div>
                </div>
            )}
        </div>

        {/* --- APP HEADER --- */}
        <div className="bg-white sticky top-0 z-30 border-b border-slate-100 shadow-sm safe-area-top">
            <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                    <div className="bg-blue-50 p-1.5 rounded-lg text-blue-600"><Users size={20}/></div>
                    <span className="hidden md:inline">بوابة ولي الأمر</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-full hover:bg-slate-50 transition-colors">
                        <Bell size={24} className="text-slate-600"/>
                        {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
                    </button>
                    <button onClick={handleLogout} className="p-2 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                        <LogOut size={20}/>
                    </button>
                </div>
            </div>
        </div>

        {/* Notifications Dropdown */}
        {showNotifications && (
            <div className="fixed top-16 left-0 right-0 z-40 px-4 md:absolute md:left-4 md:right-auto md:w-80">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-fade-in-up">
                    <div className="p-3 border-b border-slate-50 font-bold text-sm bg-slate-50 flex justify-between items-center">
                        <span>الإشعارات</span>
                        <button onClick={()=>setShowNotifications(false)}><X size={16}/></button>
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? <p className="p-6 text-center text-xs text-slate-400">لا توجد إشعارات جديدة</p> : notifications.map(n => (
                            <div key={n.id} className={`p-3 border-b border-slate-50 text-sm hover:bg-slate-50 cursor-pointer ${!n.isRead ? 'bg-blue-50/30' : ''}`} onClick={() => markNotificationRead(n.id)}>
                                <p className="font-bold text-slate-800 mb-1">{n.title}</p>
                                <p className="text-xs text-slate-500 leading-relaxed">{n.message}</p>
                                <span className="text-[10px] text-slate-400 mt-1 block">{new Date(n.createdAt).toLocaleDateString('ar-SA')}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
            
            {/* --- DASHBOARD VIEW (List of Children) --- */}
            {!selectedStudent ? (
                <div className="animate-fade-in space-y-6">
                    {/* Welcome Card */}
                    <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-3xl p-6 text-white relative overflow-hidden shadow-lg">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                        <div className="relative z-10">
                            <h2 className="text-xl font-bold mb-1">مرحباً بك</h2>
                            <p className="text-blue-200 text-sm">تابع حضور وسلوك أبنائك لحظة بلحظة.</p>
                        </div>
                    </div>

                    {/* School News (Horizontal Scroll) */}
                    {news.length > 0 && (
                        <div>
                            <div className="flex justify-between items-center mb-3 px-1">
                                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><Newspaper size={16} className="text-blue-600"/> أخبار المدرسة</h3>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-4 px-1 snap-x scrollbar-hide">
                                {news.map(n => (
                                    <div key={n.id} onClick={() => setSelectedNews(n)} className="snap-center shrink-0 w-64 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm active:scale-95 transition-transform cursor-pointer hover:shadow-md">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${n.isUrgent ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{n.isUrgent ? 'عاجل' : 'خبر'}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleDateString('ar-SA')}</span>
                                        </div>
                                        <h4 className="font-bold text-slate-900 text-sm line-clamp-1 mb-1">{n.title}</h4>
                                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{n.content}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Children List */}
                    <div>
                        <div className="flex justify-between items-center mb-4 px-1">
                            <h3 className="font-bold text-slate-800 text-lg">أبنائي</h3>
                            <button onClick={() => setIsAddingChild(true)} className="bg-slate-100 text-slate-600 p-2 rounded-xl hover:bg-slate-200 transition-colors"><Plus size={20}/></button>
                        </div>

                        {isAddingChild && (
                            <div className="bg-white p-4 rounded-2xl shadow-lg border border-blue-100 mb-4 animate-fade-in-up">
                                <h4 className="font-bold text-sm mb-3 text-blue-900">ربط طالب جديد</h4>
                                <div className="flex gap-2">
                                    <input 
                                        autoFocus 
                                        placeholder="رقم الهوية أو الجوال..." 
                                        value={newChildInput} 
                                        onChange={e => setNewChildInput(e.target.value)} 
                                        className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                                    />
                                    <button onClick={handleAddChild} disabled={loading} className="bg-blue-600 text-white px-4 rounded-xl font-bold">{loading ? <Loader2 className="animate-spin"/> : 'إضافة'}</button>
                                </div>
                                <button onClick={() => setIsAddingChild(false)} className="text-xs text-slate-400 mt-2 text-center w-full">إلغاء</button>
                            </div>
                        )}

                        {myChildren.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"><Users className="text-slate-300"/></div>
                                <p className="font-bold text-slate-500 text-sm">لم يتم ربط أي طلاب بعد</p>
                                <button onClick={() => setIsAddingChild(true)} className="text-blue-600 text-sm font-bold mt-2">أضف ابنك الآن</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {myChildren.map(child => (
                                    <div key={child.id} onClick={() => handleSelectStudent(child)} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group hover:border-blue-300 hover:shadow-md">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center text-xl font-bold border border-slate-200 shadow-sm group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                                {child.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-slate-900 leading-tight">{child.name}</h3>
                                                <p className="text-xs text-slate-500 mt-1">{child.grade} - {child.className}</p>
                                            </div>
                                            <div className="mr-auto bg-slate-50 p-2 rounded-full text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600">
                                                <ChevronLeft size={20} />
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-amber-50 p-2 rounded-xl flex items-center gap-2">
                                                <div className="bg-white p-1.5 rounded-lg text-amber-500 shadow-sm"><Star size={14} fill="currentColor"/></div>
                                                <div>
                                                    <p className="text-[10px] text-amber-800 font-bold uppercase">التميز</p>
                                                    <p className="text-xs font-bold text-amber-900">عرض السجل</p>
                                                </div>
                                            </div>
                                            <div className="bg-red-50 p-2 rounded-xl flex items-center gap-2">
                                                <div className="bg-white p-1.5 rounded-lg text-red-500 shadow-sm"><AlertCircle size={14}/></div>
                                                <div>
                                                    <p className="text-[10px] text-red-800 font-bold uppercase">الحضور</p>
                                                    <p className="text-xs font-bold text-red-900">عرض السجل</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* --- STUDENT DETAIL VIEW --- */
                <div className="animate-fade-in space-y-6 max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2">
                        <button onClick={() => setSelectedStudent(null)} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                            <ArrowRight size={20} className="text-slate-600"/>
                        </button>
                        <h2 className="text-lg font-bold text-slate-800">ملف الطالب</h2>
                    </div>

                    {/* Student Card */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-blue-50 to-transparent"></div>
                        <div className="relative z-10">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-3xl font-bold text-blue-600 border-4 border-white shadow-lg mx-auto mb-3">
                                {selectedStudent.name.charAt(0)}
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">{selectedStudent.name}</h2>
                            <p className="text-sm text-slate-500">{selectedStudent.grade} - {selectedStudent.className}</p>
                            
                            <div className="flex justify-center gap-3 mt-5">
                                <button onClick={() => setShowDigitalId(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-slate-900/20 active:scale-95 transition-all">
                                    <CreditCard size={14}/> الهوية الرقمية
                                </button>
                                <button onClick={() => navigate(`/submit?studentId=${selectedStudent.studentId}`)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
                                    <FileText size={14}/> تقديم عذر
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                        {[
                          { id: 'overview', label: 'ملخص', icon: Activity },
                          { id: 'positive_behavior', label: 'التميز', icon: Trophy }, 
                          { id: 'calendar', label: 'التقويم', icon: CalendarDays },
                          { id: 'report', label: 'التقرير', icon: Sparkles },
                          { id: 'exits', label: 'استئذان', icon: ExitIcon }, 
                          { id: 'visits', label: 'حجز موعد', icon: CalendarCheck }, 
                          { id: 'behavior', label: 'مخالفات', icon: ShieldAlert },
                          { id: 'observations', label: 'ملاحظات', icon: MessageSquare }
                        ].map(tab => (
                            <button 
                                key={tab.id} 
                                onClick={() => setActiveTab(tab.id as any)} 
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all border ${activeTab === tab.id ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                            >
                                <tab.icon size={14}/> {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="min-h-[300px]">
                        {loading ? (
                            <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600"/></div>
                        ) : (
                            <>
                                {/* OVERVIEW TAB */}
                                {activeTab === 'overview' && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-2">
                                                <div className="bg-emerald-50 text-emerald-600 p-3 rounded-full"><CheckCircle size={24}/></div>
                                                <div><h3 className="text-2xl font-bold text-slate-800">{attendanceHistory.filter(x=>x.status==='PRESENT').length}</h3><p className="text-xs text-slate-400">أيام الحضور</p></div>
                                            </div>
                                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-2">
                                                <div className="bg-red-50 text-red-600 p-3 rounded-full"><AlertCircle size={24}/></div>
                                                <div><h3 className="text-2xl font-bold text-slate-800">{attendanceHistory.filter(x=>x.status==='ABSENT').length}</h3><p className="text-xs text-slate-400">أيام الغياب</p></div>
                                            </div>
                                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-2">
                                                <div className="bg-amber-50 text-amber-600 p-3 rounded-full"><Clock size={24}/></div>
                                                <div><h3 className="text-2xl font-bold text-slate-800">{attendanceHistory.filter(x=>x.status==='LATE').length}</h3><p className="text-xs text-slate-400">تأخر</p></div>
                                            </div>
                                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-2">
                                                <div className="bg-yellow-50 text-yellow-600 p-3 rounded-full"><Star size={24} fill="currentColor"/></div>
                                                <div><h3 className="text-2xl font-bold text-slate-800">{points.total}</h3><p className="text-xs text-slate-400">نقاط التميز</p></div>
                                            </div>
                                        </div>

                                        {/* Unexcused Absence Alert */}
                                        {unexcusedAbsences.length > 0 && (
                                            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 animate-pulse-slow">
                                                <h3 className="text-red-800 font-bold flex items-center gap-2 mb-2"><AlertTriangle size={20}/> تنبيه غياب بدون عذر</h3>
                                                <p className="text-sm text-red-700 mb-3">يوجد أيام غياب لم يتم تقديم عذر لها. يرجى تقديم عذر لتجنب حسم الدرجات.</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {unexcusedAbsences.map((rec, i) => (
                                                        <span key={i} className="bg-white border border-red-200 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-2">
                                                            {rec.date}
                                                            <button onClick={() => navigate(`/submit?studentId=${selectedStudent.studentId}&date=${rec.date}`)} className="text-blue-600 underline">تقديم عذر</button>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* CALENDAR TAB (Renamed from Attendance) */}
                                {activeTab === 'calendar' && (
                                    <div className="animate-fade-in">
                                        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm mb-4">
                                            <div className="flex justify-between items-center mb-6">
                                                <button onClick={() => setCalendarMonth(new Date(calendarMonth.setMonth(calendarMonth.getMonth() - 1)))} className="p-2 bg-slate-50 rounded-full"><ChevronRight size={16}/></button>
                                                <h3 className="font-bold text-slate-800 text-lg">{calendarMonth.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}</h3>
                                                <button onClick={() => setCalendarMonth(new Date(calendarMonth.setMonth(calendarMonth.getMonth() + 1)))} className="p-2 bg-slate-50 rounded-full"><ChevronLeft size={16}/></button>
                                            </div>
                                            
                                            {/* Days Header */}
                                            <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 mb-2">
                                                <div>أ</div><div>إ</div><div>ث</div><div>أ</div><div>خ</div><div>ج</div><div>س</div>
                                            </div>
                                            
                                            {/* Days Grid */}
                                            <div className="grid grid-cols-7 gap-2">
                                                {getDaysInMonth(calendarMonth).map((date, i) => {
                                                    if (!date) return <div key={i}></div>;
                                                    
                                                    const dateStr = date.toISOString().split('T')[0];
                                                    const attRecord = attendanceHistory.find(r => r.date === dateStr);
                                                    // Check for Approved/Pending Excuse
                                                    const hasExcuse = history.find(req => req.date === dateStr && req.status !== RequestStatus.REJECTED);
                                                    // Check for Exit Permission
                                                    const hasExit = exitPermissions.find(e => e.createdAt.startsWith(dateStr));

                                                    let bgClass = 'bg-slate-50 text-slate-300'; // Default empty
                                                    let label = '';

                                                    if (attRecord?.status === AttendanceStatus.ABSENT) {
                                                        if (hasExcuse) {
                                                            bgClass = 'bg-blue-500 text-white'; // Excused Absence
                                                            label = 'غ (عذر)';
                                                        } else {
                                                            bgClass = 'bg-red-500 text-white'; // Unexcused Absence
                                                            label = 'غ';
                                                        }
                                                    } else if (attRecord?.status === AttendanceStatus.LATE) {
                                                        bgClass = 'bg-amber-400 text-white'; // Late
                                                        label = 'ت';
                                                    } else if (attRecord?.status === AttendanceStatus.PRESENT) {
                                                        bgClass = 'bg-emerald-500 text-white'; // Present
                                                        label = 'ح';
                                                    }

                                                    // Overlay Exit Permission if present (Purple)
                                                    if (hasExit) {
                                                        // Use purple border or background if present
                                                        bgClass = 'bg-purple-500 text-white';
                                                        label = 'استئذان';
                                                    }

                                                    return (
                                                        <div key={i} className={`h-12 rounded-xl flex flex-col items-center justify-center text-xs font-bold relative overflow-hidden transition-all hover:scale-105 ${bgClass}`}>
                                                            <span>{date.getDate()}</span>
                                                            {/* Small dot indicator if needed */}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Legend */}
                                            <div className="mt-6 border-t border-slate-100 pt-4">
                                                <p className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1"><Info size={12}/> توضيح الألوان:</p>
                                                <div className="flex flex-wrap gap-3 text-[10px] font-bold">
                                                    <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> حضور</div>
                                                    <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> غياب بدون عذر</div>
                                                    <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span> غياب بعذر</div>
                                                    <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400"></span> تأخر</div>
                                                    <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-500"></span> استئذان</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* SMART REPORT TAB */}
                                {activeTab === 'report' && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden">
                                            <div className="relative z-10">
                                                <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Sparkles size={20}/> التقرير التربوي الذكي</h3>
                                                <p className="text-blue-100 text-sm mb-4">تحليل شامل لأداء الطالب (سلوكياً، دراسياً، وانضباطياً) باستخدام الذكاء الاصطناعي.</p>
                                                
                                                {!smartReport ? (
                                                    <button onClick={handleGenerateSmartReport} disabled={generatingReport} className="bg-white text-blue-700 px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-blue-50 transition-all flex items-center gap-2">
                                                        {generatingReport ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} 
                                                        توليد التقرير الآن
                                                    </button>
                                                ) : (
                                                    <button onClick={() => setSmartReport(null)} className="bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/30">إعادة التوليد</button>
                                                )}
                                            </div>
                                        </div>

                                        {smartReport && (
                                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm leading-relaxed text-slate-700 text-sm whitespace-pre-line animate-fade-in">
                                                {smartReport}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* VISITS & BOOKING TAB */}
                                {activeTab === 'visits' && (
                                    <div className="space-y-6 animate-fade-in">
                                        
                                        {/* Available Slots */}
                                        <div className="space-y-3">
                                            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><CalendarCheck size={16} className="text-blue-600"/> المواعيد المتاحة للحجز</h3>
                                            {availableSlots.length === 0 ? (
                                                <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm">
                                                    لا توجد مواعيد متاحة حالياً. يرجى مراجعة المدرسة.
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                    {availableSlots.map(slot => (
                                                        <button 
                                                            key={slot.id} 
                                                            onClick={() => handleBookSlot(slot)}
                                                            className="bg-white border border-slate-200 p-4 rounded-xl text-center hover:border-blue-500 hover:shadow-md transition-all group"
                                                        >
                                                            <p className="font-bold text-blue-900 text-lg group-hover:text-blue-600">{slot.startTime}</p>
                                                            <p className="text-xs text-slate-400 mt-1">{slot.date}</p>
                                                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded mt-2 inline-block">حجز</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* My Appointments History */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                            <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-700 text-sm">سجل حجوزاتي</div>
                                            {myAppointments.length === 0 ? (
                                                <p className="p-6 text-center text-slate-400 text-xs">لا يوجد حجوزات سابقة.</p>
                                            ) : (
                                                <div className="divide-y divide-slate-50">
                                                    {myAppointments.map(app => (
                                                        <div key={app.id} className="p-4 flex justify-between items-center text-sm">
                                                            <div>
                                                                <p className="font-bold text-slate-800">{app.slot?.startTime} - {app.slot?.date}</p>
                                                                <p className="text-xs text-slate-500">{app.visitReason}</p>
                                                            </div>
                                                            <span className={`px-2 py-1 rounded text-xs font-bold ${app.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                                                                {app.status === 'completed' ? 'تمت الزيارة' : 'قادم'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* OTHER TABS (Behavior, Positive, etc.) */}
                                {/* Reuse previous logic but ensure container width is handled by parent */}
                                {activeTab === 'positive_behavior' && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 rounded-3xl text-white shadow-lg text-center">
                                            <Trophy size={40} className="mx-auto mb-2 text-yellow-300 drop-shadow-sm"/>
                                            <h2 className="text-3xl font-extrabold">{points.total}</h2>
                                            <p className="text-emerald-100 text-sm font-bold">إجمالي نقاط التميز</p>
                                        </div>
                                        {positiveObservations.length === 0 ? (
                                            <p className="text-center text-slate-400 text-sm py-10">لا يوجد سجلات حتى الآن.</p>
                                        ) : (
                                            <div className="grid gap-3">
                                                {positiveObservations.map(obs => (
                                                    <div key={obs.id} className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="bg-emerald-50 p-2 rounded-xl text-emerald-600"><Medal size={20}/></div>
                                                            <div>
                                                                <p className="font-bold text-slate-800 text-sm">{obs.content.replace('تعزيز سلوكي: ', '').split('(')[0]}</p>
                                                                <p className="text-[10px] text-slate-400">{obs.date}</p>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => handlePrintCertificate(obs)} className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-bold border border-emerald-100 flex items-center gap-1">
                                                            <Printer size={12}/> شهادة
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* DIGITAL ID CARD */}
                                {showDigitalId && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setShowDigitalId(false)}>
                                        <div className="w-full max-w-sm aspect-[1.586/1] bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 rounded-3xl shadow-2xl relative overflow-hidden border border-white/10" onClick={e => e.stopPropagation()}>
                                            {/* Holographic Effect */}
                                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] opacity-10"></div>
                                            <div className="absolute -top-20 -right-20 w-48 h-48 bg-blue-500 rounded-full blur-[60px] opacity-40"></div>
                                            <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500 rounded-full blur-[60px] opacity-40"></div>
                                            
                                            <div className="relative z-10 p-6 h-full flex flex-col justify-between">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="text-[10px] text-blue-200 font-bold tracking-widest uppercase mb-1">Student ID Card</p>
                                                        <h3 className="text-lg font-bold text-white leading-tight">{SCHOOL_NAME}</h3>
                                                    </div>
                                                    <img src={SCHOOL_LOGO} alt="Logo" className="w-10 h-10 object-contain drop-shadow-md bg-white/10 rounded-full p-1"/>
                                                </div>
                                                
                                                <div className="flex items-end justify-between mt-auto">
                                                    <div>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Student Name</p>
                                                        <p className="text-xl font-bold text-white mb-3 tracking-wide">{selectedStudent.name}</p>
                                                        <div className="flex gap-4">
                                                            <div>
                                                                <p className="text-[9px] text-slate-400 font-bold uppercase">ID Number</p>
                                                                <p className="text-sm font-mono text-blue-100">{selectedStudent.studentId}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] text-slate-400 font-bold uppercase">Grade</p>
                                                                <p className="text-sm font-mono text-blue-100">{selectedStudent.grade}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="bg-white p-1.5 rounded-lg">
                                                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${selectedStudent.studentId}`} className="w-16 h-16 mix-blend-multiply" alt="QR"/>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Exits */}
                                {activeTab === 'exits' && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="bg-orange-50 border border-orange-100 p-5 rounded-2xl relative overflow-hidden">
                                            <div className="relative z-10 text-center">
                                                <h3 className="text-lg font-bold text-orange-900 mb-2">بطاقة الخروج</h3>
                                                {(() => {
                                                    const activeExit = exitPermissions.find(p => p.status === 'pending_pickup');
                                                    if (activeExit) {
                                                        return (
                                                            <div className="bg-white p-4 rounded-xl shadow-lg border border-orange-100 inline-block">
                                                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=EXIT:${activeExit.id}`} alt="Exit QR" className="w-32 h-32 mx-auto mix-blend-multiply mb-2"/>
                                                                <p className="text-xs font-bold text-slate-500">امسح عند البوابة</p>
                                                            </div>
                                                        );
                                                    }
                                                    return <p className="text-sm text-orange-800 opacity-70">لا يوجد إذن نشط حالياً.</p>;
                                                })()}
                                            </div>
                                        </div>
                                        
                                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                            <h3 className="font-bold text-slate-800 mb-3 text-sm">سجل سابق</h3>
                                            <div className="space-y-3">
                                                {exitPermissions.map(p => (
                                                    <div key={p.id} className="flex justify-between items-center p-3 border-b border-slate-50 last:border-0 text-sm">
                                                        <span>{p.reason || 'بدون سبب'}</span>
                                                        <span className="text-xs text-slate-400">{new Date(p.createdAt).toLocaleDateString('ar-SA')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Behaviors & Observations with Reply */}
                                {(activeTab === 'behavior' || activeTab === 'observations') && (
                                    <div className="space-y-4 animate-fade-in">
                                        {(activeTab === 'behavior' ? behaviorHistory : observations).length === 0 ? <p className="text-center py-10 text-slate-400 text-sm">سجل نظيف.</p> : (activeTab === 'behavior' ? behaviorHistory : observations).map((rec: any) => (
                                            <div key={rec.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="font-bold text-slate-800 text-sm">{activeTab === 'behavior' ? rec.violationName : rec.staffName}</h4>
                                                    <span className="text-xs text-slate-400">{rec.date}</span>
                                                </div>
                                                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl mb-3 leading-relaxed">{activeTab === 'behavior' ? rec.actionTaken : rec.content}</p>
                                                
                                                {/* Reply Section */}
                                                {!rec.parentViewed ? (
                                                    replyMode?.id === rec.id ? (
                                                        <div className="animate-fade-in">
                                                            <textarea className="w-full p-3 border rounded-xl text-sm mb-2 outline-none focus:ring-2 focus:ring-blue-100" placeholder="اكتب ردك..." value={replyContent} onChange={e => setReplyContent(e.target.value)} autoFocus></textarea>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => { setReplyMode(null); setReplyContent(''); }} className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-xs font-bold">إلغاء</button>
                                                                <button onClick={handleSubmitReply} disabled={submittingReply} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold">{submittingReply ? <Loader2 className="animate-spin mx-auto" size={14}/> : 'إرسال'}</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => { setReplyMode({id: rec.id, type: activeTab === 'behavior' ? 'behavior' : 'observation'}); setReplyContent(''); }} className="w-full bg-blue-50 text-blue-600 py-2 rounded-lg text-xs font-bold border border-blue-100 hover:bg-blue-100">تأكيد الاطلاع والرد</button>
                                                    )
                                                ) : (
                                                    <div className="bg-emerald-50 p-2 rounded-lg text-xs text-emerald-700 font-bold flex items-center gap-2 border border-emerald-100">
                                                        <CheckCircle size={14}/> تم الاطلاع {rec.parentFeedback && `- الرد: ${rec.parentFeedback}`}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* BOOKING MODAL */}
        {showBookingModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
                    {bookingSuccess ? (
                        <div className="text-center">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32}/></div>
                            <h3 className="text-xl font-bold text-slate-900">تم حجز الموعد بنجاح</h3>
                            <p className="text-sm text-slate-500 mt-2">يرجى إبراز الهوية عند البوابة</p>
                            <button onClick={()=>{setShowBookingModal(false); setBookingSuccess(null)}} className="mt-6 w-full bg-slate-100 py-3 rounded-xl font-bold">إغلاق</button>
                        </div>
                    ) : (
                        <form onSubmit={(e)=>{e.preventDefault(); if(availableSlots.length>0) handleBookSlot(availableSlots[0]); /* Logic handled in button */}} className="space-y-4">
                            <h3 className="font-bold text-lg">تأكيد الحجز</h3>
                            <input value={parentNameForVisit} onChange={e=>setParentNameForVisit(e.target.value)} placeholder="اسم ولي الأمر (الزائر)" className="w-full p-3 border rounded-xl font-bold text-sm" required/>
                            <input value={visitReason} onChange={e=>setVisitReason(e.target.value)} placeholder="سبب الزيارة" className="w-full p-3 border rounded-xl font-bold text-sm" required/>
                            <div className="flex gap-2">
                                <button type="button" onClick={()=>setShowBookingModal(false)} className="flex-1 bg-slate-100 py-3 rounded-xl font-bold text-sm">إلغاء</button>
                                <button type="submit" disabled={isBooking} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm">{isBooking ? <Loader2 className="animate-spin mx-auto"/> : 'تأكيد'}</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        )}

        {/* DETAILS MODALS (NEWS) */}
        {selectedNews && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-fade-in" onClick={() => setSelectedNews(null)}>
                <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setSelectedNews(null)} className="absolute top-4 left-4 bg-slate-100 p-2 rounded-full"><X size={16}/></button>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded mb-3 inline-block ${selectedNews.isUrgent ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{selectedNews.isUrgent ? 'عاجل' : 'خبر'}</span>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">{selectedNews.title}</h2>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto">{selectedNews.content}</p>
                    <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 flex justify-between">
                        <span>{new Date(selectedNews.createdAt).toLocaleDateString('ar-SA')}</span>
                        <span>{selectedNews.author}</span>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Inquiry;
