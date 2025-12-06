import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { 
  Search, User, School, Copy, Check, CalendarDays, AlertCircle, Loader2, 
  FileText, ShieldAlert, Star, MessageSquare, Send, CheckCircle, Clock, Plus, Users, Bell, 
  LogOut, ChevronRight, ArrowLeft, Activity, ChevronLeft, Archive, AlertTriangle, 
  Newspaper, CreditCard, X, Sparkles, CalendarCheck, QrCode, Paperclip, Printer, LogOut as ExitIcon, Calendar, Medal, Trophy, Phone, ArrowRight, Info, BellRing, MapPin, ScanLine, FilePlus
} from 'lucide-react';
import { 
  getStudentByCivilId, getRequestsByStudentId, getStudentAttendanceHistory, 
  getBehaviorRecords, getStudentObservations, acknowledgeBehavior, 
  acknowledgeObservation, getParentChildren, linkParentToStudent, 
  getNotifications, markNotificationRead, getStudentPoints, getSchoolNews, generateSmartStudentReport,
  getAvailableSlots, bookAppointment, getMyAppointments, getMyExitPermissions, getStudentsByPhone
} from '../services/storage';
import { subscribeToPushNotifications, checkPushPermission } from '../services/pushService';
import { 
  Student, ExcuseRequest, RequestStatus, AttendanceStatus, BehaviorRecord, 
  StudentObservation, AppNotification, StudentPoint, SchoolNews, AppointmentSlot, Appointment, ExitPermission 
} from '../types';
import { supabase } from '../supabaseClient'; 

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
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedNews, setSelectedNews] = useState<SchoolNews | null>(null);
  
  const [pushStatus, setPushStatus] = useState(checkPushPermission());
  const [pushLoading, setPushLoading] = useState(false);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'absence_reg' | 'report' | 'calendar' | 'behavior' | 'positive_behavior' | 'observations' | 'visits' | 'exits'>('overview');
  
  // Data State
  const [history, setHistory] = useState<ExcuseRequest[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<{ date: string, status: AttendanceStatus }[]>([]);
  const [behaviorHistory, setBehaviorHistory] = useState<BehaviorRecord[]>([]);
  const [positiveObservations, setPositiveObservations] = useState<StudentObservation[]>([]);
  const [observations, setObservations] = useState<StudentObservation[]>([]);
  const [points, setPoints] = useState<{total: number, history: StudentPoint[]}>({ total: 0, history: [] });
  const [exitPermissions, setExitPermissions] = useState<ExitPermission[]>([]);
  const [loading, setLoading] = useState(false);
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
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState<AppointmentSlot | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Appointment | null>(null);

  const SCHOOL_NAME = localStorage.getItem('school_name') || "مدرسة عماد الدين زنكي المتوسطة";
  const SCHOOL_LOGO = localStorage.getItem('school_logo') || "https://www.raed.net/img?id=1471924";

  // Login
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

  useEffect(() => { if (isAuthenticated) loadParentDashboard(); }, [isAuthenticated]);

  // Realtime & Polling for Notifications
  useEffect(() => {
      if (!isAuthenticated || !parentCivilId) return;

      const fetchLatestNotifications = async () => {
          // Fetch parent notifications
          const myNotifs = await getNotifications(parentCivilId);
          
          // Fetch children notifications (looping through all linked children)
          let childrenNotifs: AppNotification[] = [];
          for (const child of myChildren) {
              const cn = await getNotifications(child.studentId);
              childrenNotifs = [...childrenNotifs, ...cn];
          }

          // Fetch Global Notifications
          const globalNotifs = await getNotifications('ALL');

          // Merge and Dedup
          const all = [...myNotifs, ...childrenNotifs, ...globalNotifs];
          const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
          const sorted = unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          setNotifications(sorted);
      };

      // 1. Initial Fetch
      fetchLatestNotifications();

      // 2. Realtime Listener
      const channel = supabase.channel('public:notifications').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
          const newNotif = payload.new as AppNotification;
          const isMine = newNotif.targetUserId === parentCivilId;
          const isMyChild = myChildren.some(child => child.studentId === newNotif.targetUserId);
          const isGlobal = newNotif.targetUserId === 'ALL';
          
          if (isMine || isMyChild || isGlobal) {
              setNotifications(prev => [newNotif, ...prev]);
              
              // TRIGGER MOBILE NOTIFICATION (Service Worker)
              if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
                  navigator.serviceWorker.ready.then(registration => {
                      registration.showNotification(newNotif.title, {
                          body: newNotif.message,
                          icon: SCHOOL_LOGO,
                          badge: SCHOOL_LOGO,
                          // @ts-ignore
                          vibrate: [200, 100, 200], // Vibrate phone
                          requireInteraction: true,  // Keep notification visible
                          data: { url: window.location.origin }
                      });
                  });
              } else if (Notification.permission === 'granted') {
                  // Fallback for Desktop if SW fails
                  new Notification(newNotif.title, { body: newNotif.message, icon: SCHOOL_LOGO });
              }
          }
      }).subscribe();

      // 3. Polling Fallback (Every 15s) to guarantee arrival
      const interval = setInterval(fetchLatestNotifications, 15000);

      return () => { 
          supabase.removeChannel(channel); 
          clearInterval(interval);
      };
  }, [isAuthenticated, parentCivilId, myChildren]);

  const handleEnablePush = async () => {
      setPushLoading(true);
      try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') { 
              await subscribeToPushNotifications(parentCivilId); 
              setPushStatus('granted'); 
              
              // Trigger a test notification via Service Worker
              if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.ready.then(registration => {
                      registration.showNotification("تم تفعيل الإشعارات", {
                          body: "ستصلك التنبيهات المدرسية هنا فوراً.",
                          icon: SCHOOL_LOGO,
                          // @ts-ignore
                          vibrate: [200, 100, 200]
                      });
                  });
              }
              
              alert("تم تفعيل الإشعارات بنجاح!"); 
          } 
          else { alert("تم رفض الإذن."); }
      } catch (e) { alert("تعذر تفعيل الإشعارات."); } 
      finally { setPushLoading(false); }
  };

  const handleAddChild = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      if (!newChildInput) return; 
      setLoading(true); 
      try { 
          const isPhone = newChildInput.startsWith('05') || newChildInput.startsWith('966');
          if (isPhone) {
              const students = await getStudentsByPhone(newChildInput);
              if (students.length === 0) alert("لم يتم العثور على طلاب مسجلين برقم الجوال هذا.");
              else { for (const s of students) await linkParentToStudent(parentCivilId, s.studentId); await loadParentDashboard(); setNewChildInput(''); setIsAddingChild(false); alert(`تم إضافة ${students.length} طالب/طلاب بنجاح!`); }
          } else {
              const student = await getStudentByCivilId(newChildInput); 
              if (!student) alert("لم يتم العثور على طالب بهذا الرقم."); 
              else { await linkParentToStudent(parentCivilId, student.studentId); await loadParentDashboard(); setNewChildInput(''); setIsAddingChild(false); alert("تم الإضافة!"); } 
          }
      } catch (e) { alert("حدث خطأ."); } finally { setLoading(false); } 
  };
  
  const handleSelectStudent = async (student: Student) => {
      setSelectedStudent(student);
      setLoading(true);
      try {
          // Fetch ALL necessary data for tabs
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
          setSmartReport(null); 
      } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const missingExcuses = useMemo(() => {
      if (!attendanceHistory.length) return [];
      return attendanceHistory.filter(record => {
          if (record.status !== AttendanceStatus.ABSENT) return false;
          // Check if there is an approved or pending excuse for this date
          const hasRequest = history.some(req => req.date === record.date && req.status !== RequestStatus.REJECTED);
          return !hasRequest;
      });
  }, [attendanceHistory, history]);

  // Derived Stats for Summary
  const summaryStats = useMemo(() => {
      const present = attendanceHistory.filter(x => x.status === AttendanceStatus.PRESENT).length;
      const late = attendanceHistory.filter(x => x.status === AttendanceStatus.LATE).length;
      const exits = exitPermissions.length;
      
      let excused = 0;
      let unexcused = 0;

      attendanceHistory.filter(x => x.status === AttendanceStatus.ABSENT).forEach(rec => {
          const hasApprovedExcuse = history.some(req => req.date === rec.date && req.status === RequestStatus.APPROVED);
          if(hasApprovedExcuse) excused++;
          else unexcused++;
      });

      return { present, late, exits, excused, unexcused };
  }, [attendanceHistory, exitPermissions, history]);

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
      try { const report = await generateSmartStudentReport(selectedStudent.name, attendanceHistory, behaviorHistory, points.total); setSmartReport(report); } 
      catch (e) { alert("فشل التوليد"); } finally { setGeneratingReport(false); } 
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

  const handleSlotClick = (slot: AppointmentSlot) => {
      const activeApp = myAppointments.find(a => a.status === 'pending');
      const today = new Date();
      const hasActive = activeApp && (new Date(`${activeApp.slot?.date}T23:59:59`) >= today);
      if (hasActive) { alert("عفواً، لديك موعد قائم بالفعل."); if(activeApp) openTicket(activeApp); return; }
      setSelectedSlotForBooking(slot);
      setBookingSuccess(null);
      setVisitReason('');
      setParentNameForVisit('');
      setShowBookingModal(true);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!visitReason || !parentNameForVisit) { alert("يرجى إدخال البيانات"); return; }
      if (!selectedStudent || !selectedSlotForBooking) return;
      setIsBooking(true);
      try {
          const appt = await bookAppointment({ slotId: selectedSlotForBooking.id, studentId: selectedStudent.studentId, studentName: selectedStudent.name, parentName: parentNameForVisit, parentCivilId: parentCivilId, visitReason: visitReason });
          setBookingSuccess(appt); 
          const [newSlots, newApps] = await Promise.all([getAvailableSlots(), getMyAppointments(parentCivilId)]);
          setAvailableSlots(newSlots); 
          setMyAppointments(newApps.filter(a => a.studentId === selectedStudent.studentId));
      } catch (e: any) { alert(e.message || "حدث خطأ"); setShowBookingModal(false); } finally { setIsBooking(false); }
  };

  const openTicket = (appt: Appointment) => {
      setSelectedTicket(appt);
      setShowTicketModal(true);
  };

  const getDaysInMonth = (date: Date) => { const year = date.getFullYear(); const month = date.getMonth(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const firstDay = new Date(year, month, 1).getDay(); const days = []; for (let i = 0; i < firstDay; i++) days.push(null); for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i)); return days; };
  
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const VisitorPass = ({ appt }: { appt: Appointment }) => (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden relative w-full max-w-sm mx-auto">
          <div className="h-3 bg-gradient-to-r from-blue-600 to-indigo-600 w-full"></div>
          <div className="p-6 text-center relative">
              <img src={SCHOOL_LOGO} alt="Logo" className="w-16 h-16 object-contain mx-auto mb-2 opacity-90"/>
              <h3 className="text-lg font-extrabold text-slate-900">{SCHOOL_NAME}</h3>
              <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">بطاقة دخول زائر</p>
          </div>
          <div className="relative flex items-center justify-center my-2"><div className="absolute left-0 w-4 h-8 bg-slate-900 rounded-r-full -ml-2"></div><div className="w-full border-t-2 border-dashed border-slate-200 mx-6"></div><div className="absolute right-0 w-4 h-8 bg-slate-900 rounded-l-full -mr-2"></div></div>
          <div className="p-6 space-y-5">
              <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2"><span className="text-slate-400 text-xs font-bold uppercase">الزائر</span><span className="font-bold text-slate-800 text-base">{appt.parentName}</span></div>
              <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2"><span className="text-slate-400 text-xs font-bold uppercase">الطالب</span><span className="font-bold text-slate-800">{appt.studentName}</span></div>
              <div className="grid grid-cols-2 gap-4"><div className="bg-slate-50 p-2 rounded-lg text-center"><p className="text-[10px] text-slate-400 font-bold uppercase">التاريخ</p><p className="font-bold text-slate-800">{appt.slot?.date}</p></div><div className="bg-blue-50 p-2 rounded-lg text-center"><p className="text-[10px] text-blue-400 font-bold uppercase">الوقت</p><p className="font-bold text-blue-800 text-lg">{appt.slot?.startTime}</p></div></div>
          </div>
          <div className="bg-slate-900 p-6 flex flex-col items-center justify-center text-white relative">
              {appt.status === 'completed' ? (
                  <div className="text-center py-6">
                      <div className="bg-emerald-500 rounded-full p-4 mx-auto mb-4 w-20 h-20 flex items-center justify-center animate-bounce-slow"><CheckCircle size={40} className="text-white"/></div>
                      <h3 className="text-2xl font-bold mb-2">تم تسجيل الدخول</h3>
                      <p className="text-emerald-300 font-mono text-lg">{new Date(appt.arrivedAt || '').toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'})}</p>
                  </div>
              ) : (
                  <>
                    <div className="bg-white p-3 rounded-xl mb-3 shadow-lg"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${appt.id}`} alt="QR" className="w-32 h-32"/></div>
                    <p className="text-xs mt-2 font-bold text-emerald-400 flex items-center gap-1"><ScanLine size={14}/> يرجى إبراز الرمز عند البوابة</p>
                  </>
              )}
          </div>
      </div>
  );

  if (!isAuthenticated) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 font-sans">
            <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl text-center">
                <img src={SCHOOL_LOGO} alt="Logo" className="w-24 h-24 mx-auto mb-6 bg-white rounded-full p-2" />
                <h1 className="text-2xl font-bold text-white mb-2">بوابة ولي الأمر</h1>
                <p className="text-slate-300 text-sm mb-8">سجل دخولك برقم الهوية</p>
                <form onSubmit={handleLogin} className="space-y-6">
                    <input type="tel" required maxLength={10} value={parentCivilId} onChange={e => setParentCivilId(e.target.value.replace(/[^0-9]/g, ''))} className="w-full p-4 bg-slate-800/50 border border-slate-600 rounded-2xl text-center text-xl font-bold text-white tracking-widest outline-none focus:ring-2 focus:ring-blue-500" placeholder="1XXXXXXXXX"/>
                    <button disabled={authLoading} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center">{authLoading ? <Loader2 className="animate-spin"/> : 'تسجيل الدخول'}</button>
                </form>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans relative">
        <div id="print-area" className="hidden" dir="rtl">
            {printMode === 'certificate' && certificateData && (
                <div className="certificate-border text-center flex flex-col justify-between p-10 h-full bg-white relative">
                    <div className="flex justify-between items-start mb-8 relative z-10">
                        <div className="text-right text-xs font-bold"><p>المملكة العربية السعودية</p><p>وزارة التعليم</p><p>{SCHOOL_NAME}</p></div>
                        <img src="https://www.raed.net/img?id=1474173" className="h-24 w-auto object-contain" alt="Logo" />
                        <div className="text-left text-xs font-bold"><p>Kingdom of Saudi Arabia</p><p>Ministry of Education</p></div>
                    </div>
                    <div className="relative z-10 flex-1 flex flex-col justify-center">
                        <h1 className="text-4xl font-extrabold text-slate-800 mb-2">شهادة شكر وتقدير</h1>
                        <div className="w-1/3 h-1 bg-amber-400 mx-auto mb-8 rounded-full"></div>
                        <p className="text-lg mb-6 leading-loose">تسر إدارة المدرسة ووكالة شؤون الطلاب أن تتقدم بخالص الشكر والتقدير للطالب:</p>
                        <h2 className="text-3xl font-bold text-blue-900 mb-8 underline underline-offset-8 decoration-amber-400 decoration-4">{certificateData.studentName}</h2>
                        <p className="text-lg mb-4">وذلك لتميزه في: <span className="font-bold">{certificateData.reason}</span></p>
                        {certificateData.points && <div className="inline-block bg-slate-100 border border-slate-300 px-6 py-2 rounded-xl text-lg font-bold my-4">تم منحه {certificateData.points} نقاط تميز</div>}
                        <p className="text-lg mt-6">متمنين له دوام التوفيق والنجاح.</p>
                    </div>
                    <div className="flex justify-between items-end mt-16 px-10 relative z-10">
                        <div className="text-center"><p className="font-bold mb-4">وكيل شؤون الطلاب</p><p>.............................</p></div>
                        <div className="text-center"><div className="w-24 h-24 border-2 border-slate-300 rounded-full flex items-center justify-center text-slate-300 font-bold mb-2">الختم</div></div>
                        <div className="text-center"><p className="font-bold mb-4">مدير المدرسة</p><p>.............................</p></div>
                    </div>
                </div>
            )}
        </div>

        <div className="bg-white sticky top-0 z-30 border-b border-slate-100 shadow-sm safe-area-top">
            <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-800"><Users size={20} className="text-blue-600"/><span className="hidden md:inline">بوابة ولي الأمر</span></div>
                <div className="flex items-center gap-2">
                    {pushStatus === 'default' && <button onClick={handleEnablePush} disabled={pushLoading} className="bg-blue-600 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1">{pushLoading ? <Loader2 size={12}/> : <BellRing size={12}/>} تفعيل التنبيهات</button>}
                    <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-full hover:bg-slate-50"><Bell size={24} className="text-slate-600"/>{unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-bounce"></span>}</button>
                    <button onClick={handleLogout} className="p-2 rounded-full text-red-500 hover:bg-red-50"><LogOut size={20}/></button>
                </div>
            </div>
        </div>

        {showNotifications && (
            <div className="fixed top-16 left-0 right-0 z-40 px-4 md:absolute md:left-4 md:right-auto md:w-80 animate-fade-in-up">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="p-3 border-b border-slate-50 font-bold text-sm flex justify-between bg-slate-50"><span>الإشعارات</span><button onClick={()=>setShowNotifications(false)}><X size={16}/></button></div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? <p className="p-6 text-center text-xs text-slate-400">لا توجد إشعارات</p> : notifications.map(n => (
                            <div key={n.id} className={`p-3 border-b text-sm cursor-pointer hover:bg-slate-50 ${!n.isRead?'bg-blue-50/30':''}`} onClick={() => markNotificationRead(n.id)}>
                                <p className="font-bold mb-1 flex items-center gap-2">{n.type === 'alert' && <AlertTriangle size={12} className="text-red-500"/>}{n.title}</p><p className="text-xs text-slate-500">{n.message}</p>
                                <span className="text-[10px] text-slate-400 block mt-1">{new Date(n.createdAt).toLocaleTimeString('ar-SA')}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
            {!selectedStudent ? (
                <div className="animate-fade-in space-y-6">
                    <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-3xl p-6 text-white relative overflow-hidden shadow-lg">
                        <div className="relative z-10"><h2 className="text-xl font-bold mb-1">مرحباً بك</h2><p className="text-blue-200 text-sm">تابع أبناءك لحظة بلحظة.</p></div>
                    </div>
                    {news.length > 0 && (
                        <div>
                            <div className="flex justify-between items-center mb-3 px-1"><h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><Newspaper size={16} className="text-blue-600"/> أخبار المدرسة</h3></div>
                            <div className="flex gap-3 overflow-x-auto pb-4 px-1 snap-x scrollbar-hide">
                                {news.map(n => (
                                    <div key={n.id} onClick={() => setSelectedNews(n)} className="snap-center shrink-0 w-64 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm cursor-pointer hover:shadow-md">
                                        <div className="flex items-center justify-between mb-2"><span className={`text-[10px] px-2 py-0.5 rounded font-bold ${n.isUrgent ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{n.isUrgent ? 'عاجل' : 'خبر'}</span><span className="text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleDateString('ar-SA')}</span></div>
                                        <h4 className="font-bold text-slate-900 text-sm line-clamp-1 mb-1">{n.title}</h4>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div>
                        <div className="flex justify-between items-center mb-4 px-1"><h3 className="font-bold text-slate-800 text-lg">أبنائي</h3><button onClick={() => setIsAddingChild(true)} className="bg-slate-100 p-2 rounded-xl"><Plus size={20}/></button></div>
                        {isAddingChild && (
                            <div className="bg-white p-4 rounded-2xl shadow-lg border border-blue-100 mb-4 animate-fade-in-up">
                                <div className="flex gap-2"><input autoFocus placeholder="رقم الهوية أو الجوال..." value={newChildInput} onChange={e => setNewChildInput(e.target.value)} className="flex-1 p-3 bg-slate-50 border rounded-xl text-sm font-bold outline-none"/><button onClick={handleAddChild} disabled={loading} className="bg-blue-600 text-white px-4 rounded-xl font-bold">{loading ? <Loader2 className="animate-spin"/> : 'إضافة'}</button></div>
                                <button onClick={() => setIsAddingChild(false)} className="text-xs text-slate-400 mt-2 w-full">إلغاء</button>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {myChildren.map(child => (
                                <div key={child.id} onClick={() => handleSelectStudent(child)} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-blue-300 relative group overflow-hidden active:scale-95 transition-all">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center text-xl font-bold">{child.name.charAt(0)}</div>
                                        <div><h3 className="font-bold text-lg text-slate-900">{child.name}</h3><p className="text-xs text-slate-500">{child.grade}</p></div>
                                        <div className="mr-auto bg-slate-50 p-2 rounded-full text-slate-400"><ChevronLeft size={20} /></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="animate-fade-in space-y-6 max-w-4xl mx-auto">
                    <div className="flex items-center gap-2 mb-2">
                        <button onClick={() => setSelectedStudent(null)} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"><ArrowRight size={20} className="text-slate-600"/></button>
                        <h2 className="text-lg font-bold text-slate-800">ملف الطالب</h2>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-blue-50 to-transparent"></div>
                        <div className="relative z-10">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-3xl font-bold text-blue-600 border-4 border-white shadow-lg mx-auto mb-3">{selectedStudent.name.charAt(0)}</div>
                            <h2 className="text-xl font-bold text-slate-900">{selectedStudent.name}</h2>
                            <p className="text-sm text-slate-500">{selectedStudent.grade} - {selectedStudent.className}</p>
                            <div className="flex justify-center gap-3 mt-5">
                                <button onClick={() => setShowDigitalId(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg"><CreditCard size={14}/> الهوية الرقمية</button>
                                <button onClick={() => navigate(`/submit?studentId=${selectedStudent.studentId}`)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg"><FileText size={14}/> تقديم عذر</button>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                        {[
                          { id: 'overview', label: 'ملخص', icon: Activity },
                          { id: 'absence_reg', label: 'تسجيل غياب', icon: FilePlus },
                          { id: 'positive_behavior', label: 'التميز', icon: Trophy }, 
                          { id: 'calendar', label: 'التقويم', icon: CalendarDays },
                          { id: 'report', label: 'التقرير', icon: Sparkles },
                          { id: 'exits', label: 'استئذان', icon: ExitIcon }, 
                          { id: 'visits', label: 'حجز موعد', icon: CalendarCheck }, 
                          { id: 'behavior', label: 'مخالفات', icon: ShieldAlert },
                          { id: 'observations', label: 'ملاحظات', icon: MessageSquare }
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all border ${activeTab === tab.id ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                                <tab.icon size={14}/> {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="min-h-[300px]">
                        {loading ? <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600"/></div> : (
                            <>
                                {activeTab === 'overview' && (
                                    <div className="space-y-6 animate-fade-in">
                                        {/* Comprehensive Dashboard (8 Key Metrics) */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {/* 1. Days Present */}
                                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center hover:shadow-md transition-shadow">
                                                <div className="bg-white text-emerald-600 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm"><Check size={20}/></div>
                                                <h3 className="text-2xl font-bold text-emerald-700">{summaryStats.present}</h3>
                                                <p className="text-xs text-slate-500 font-bold uppercase">أيام الحضور</p>
                                            </div>
                                            
                                            {/* 2. Unexcused Absence (Red) */}
                                            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-center hover:shadow-md transition-shadow">
                                                <div className="bg-white text-red-600 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm"><AlertTriangle size={20}/></div>
                                                <h3 className="text-2xl font-bold text-red-700">{summaryStats.unexcused}</h3>
                                                <p className="text-xs text-slate-500 font-bold uppercase">غياب (بدون عذر)</p>
                                            </div>

                                            {/* 3. Excused Absence (Blue) */}
                                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-center hover:shadow-md transition-shadow">
                                                <div className="bg-white text-blue-600 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm"><FileText size={20}/></div>
                                                <h3 className="text-2xl font-bold text-blue-700">{summaryStats.excused}</h3>
                                                <p className="text-xs text-slate-500 font-bold uppercase">غياب (بعذر)</p>
                                            </div>

                                            {/* 4. Lateness (Amber) */}
                                            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-center hover:shadow-md transition-shadow">
                                                <div className="bg-white text-amber-600 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm"><Clock size={20}/></div>
                                                <h3 className="text-2xl font-bold text-amber-700">{summaryStats.late}</h3>
                                                <p className="text-xs text-slate-500 font-bold uppercase">مرات التأخير</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            {/* 5. Exit Permissions (Purple/Orange) */}
                                            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center gap-3 shadow-sm">
                                                <div className="bg-purple-50 text-purple-600 p-3 rounded-full"><ExitIcon size={24}/></div>
                                                <div>
                                                    <h3 className="text-2xl font-bold text-slate-800">{summaryStats.exits}</h3>
                                                    <p className="text-xs text-slate-400 font-bold">مرات الاستئذان</p>
                                                </div>
                                            </div>

                                            {/* Points (Gold) */}
                                            <div className="bg-gradient-to-br from-yellow-400 to-amber-500 p-4 rounded-2xl text-white shadow-lg flex items-center gap-3">
                                                <div className="bg-white/20 p-3 rounded-full"><Trophy size={24}/></div>
                                                <div>
                                                    <h3 className="text-2xl font-bold">{points.total}</h3>
                                                    <p className="text-xs text-white/80 font-bold">نقاط التميز</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Latest Updates Feed (6, 7, 8) */}
                                        <h3 className="font-bold text-slate-800 text-lg mt-6 mb-4 flex items-center gap-2"><Activity size={20} className="text-blue-600"/> آخر المستجدات</h3>
                                        <div className="grid md:grid-cols-3 gap-4">
                                            
                                            {/* 8. Last Positive Behavior */}
                                            <div className="bg-white border-l-4 border-emerald-500 p-4 rounded-xl shadow-sm">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2"><Star size={14} className="text-emerald-500" fill="currentColor"/> آخر سلوك إيجابي</h4>
                                                {positiveObservations.length > 0 ? (
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-sm line-clamp-2">{positiveObservations[0].content.replace('تعزيز سلوكي: ', '').split('(')[0]}</p>
                                                        <span className="text-[10px] text-slate-400 mt-1 block">{positiveObservations[0].date}</span>
                                                    </div>
                                                ) : <p className="text-xs text-slate-400 italic">لا يوجد سجلات.</p>}
                                            </div>

                                            {/* 6. Last Violation */}
                                            <div className="bg-white border-l-4 border-red-500 p-4 rounded-xl shadow-sm">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2"><ShieldAlert size={14} className="text-red-500"/> آخر مخالفة سلوكية</h4>
                                                {behaviorHistory.length > 0 ? (
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-sm line-clamp-1">{behaviorHistory[0].violationName}</p>
                                                        <span className="text-[10px] text-slate-400 mt-1 block">{behaviorHistory[0].date} - {behaviorHistory[0].violationDegree}</span>
                                                    </div>
                                                ) : <p className="text-xs text-slate-400 italic">سجل نظيف.</p>}
                                            </div>

                                            {/* 7. Last Observation */}
                                            <div className="bg-white border-l-4 border-blue-500 p-4 rounded-xl shadow-sm">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2"><MessageSquare size={14} className="text-blue-500"/> آخر ملاحظة مسجلة</h4>
                                                {observations.length > 0 ? (
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-sm line-clamp-2">{observations[0].content}</p>
                                                        <span className="text-[10px] text-slate-400 mt-1 block">{observations[0].date} - {observations[0].staffName}</span>
                                                    </div>
                                                ) : <p className="text-xs text-slate-400 italic">لا يوجد ملاحظات.</p>}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'absence_reg' && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl text-center">
                                            <FileText size={48} className="mx-auto text-blue-500 mb-4"/>
                                            <h3 className="text-lg font-bold text-blue-900 mb-2">تقديم عذر غياب</h3>
                                            <p className="text-sm text-blue-700 mb-6">يمكنك تقديم عذر لغياب اليوم أو أيام سابقة بسهولة.</p>
                                            <button 
                                                onClick={() => navigate(`/submit?studentId=${selectedStudent.studentId}&date=${new Date().toISOString().split('T')[0]}`)} 
                                                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 mx-auto"
                                            >
                                                <Plus size={18}/> تقديم عذر لغياب اليوم
                                            </button>
                                        </div>
                                        {missingExcuses.length > 0 && (
                                            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                                                <h3 className="text-red-800 font-bold flex items-center gap-2 mb-3"><AlertTriangle size={18}/> أيام غياب بدون عذر</h3>
                                                <div className="space-y-2">
                                                    {missingExcuses.map((record, idx) => (
                                                        <div key={idx} className="bg-white p-3 rounded-xl border border-red-100 flex justify-between items-center">
                                                            <span className="font-bold text-slate-800 text-sm">{record.date}</span>
                                                            <button 
                                                                onClick={() => navigate(`/submit?studentId=${selectedStudent.studentId}&date=${record.date}`)}
                                                                className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-700"
                                                            >
                                                                تقديم عذر
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div className="bg-white p-4 rounded-2xl border border-slate-200">
                                            <h4 className="font-bold text-sm mb-3">سجل الطلبات السابقة</h4>
                                            {history.length === 0 ? <p className="text-center text-slate-400 text-xs py-4">لا توجد طلبات سابقة.</p> : (
                                                <div className="space-y-2">
                                                    {history.map(req => (
                                                        <div key={req.id} className="flex justify-between items-center p-3 border-b border-slate-50 last:border-0 text-sm">
                                                            <div><p className="font-bold text-slate-800">{req.date}</p><p className="text-xs text-slate-500">{req.reason}</p></div>
                                                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${req.status==='APPROVED'?'bg-emerald-100 text-emerald-700':req.status==='REJECTED'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{req.status==='APPROVED'?'مقبول':req.status==='REJECTED'?'مرفوض':'قيد المراجعة'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'exits' && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="bg-orange-50 border border-orange-100 p-5 rounded-2xl relative overflow-hidden text-center">
                                            <h3 className="text-lg font-bold text-orange-900 mb-2">بطاقة الخروج</h3>
                                            {(() => {
                                                const activeExit = exitPermissions.find(p => {
                                                    if (p.status !== 'pending_pickup') return false;
                                                    const createdTime = new Date(p.createdAt).getTime();
                                                    const now = new Date().getTime();
                                                    const diffHours = (now - createdTime) / (1000 * 60 * 60);
                                                    return diffHours < 1;
                                                });
                                                if (activeExit) {
                                                    return (
                                                        <div className="bg-white p-4 rounded-xl shadow-lg border border-orange-100 inline-block animate-fade-in-up">
                                                            <div className="mb-2"><img src={SCHOOL_LOGO} className="w-8 h-8 mx-auto object-contain opacity-50"/></div>
                                                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=EXIT:${activeExit.id}`} alt="Exit QR" className="w-40 h-40 mx-auto mix-blend-multiply mb-2"/>
                                                            <p className="text-sm font-bold text-slate-800">تصريح خروج طالب</p>
                                                            <p className="text-[10px] text-slate-500 mt-1">يرجى إبراز الرمز عند البوابة</p>
                                                            <p className="text-[10px] text-orange-400 mt-1">صالحة لمدة ساعة</p>
                                                        </div>
                                                    );
                                                }
                                                return <p className="text-sm text-orange-800 opacity-70 py-4">لا يوجد إذن خروج نشط حالياً.</p>;
                                            })()}
                                        </div>
                                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                            <h3 className="font-bold text-slate-800 mb-3 text-sm">سجل الاستئذان</h3>
                                            <div className="space-y-3">
                                                {exitPermissions.length === 0 ? <p className="text-center text-slate-400 text-xs">السجل فارغ.</p> : exitPermissions.map(p => (
                                                    <div key={p.id} className="flex justify-between items-center p-3 border-b border-slate-50 last:border-0 text-sm">
                                                        <div><p className="font-bold text-slate-800">{p.reason || 'بدون سبب'}</p><p className="text-xs text-slate-400">{new Date(p.createdAt).toLocaleDateString('ar-SA')}</p></div>
                                                        <div className="text-left"><span className={`text-[10px] font-bold block ${p.status==='completed'?'text-emerald-600':'text-orange-600'}`}>{p.status==='completed'?'تم الخروج':'لم يخرج'}</span>{p.status === 'completed' && p.completedAt && <span className="text-[10px] text-slate-400 font-mono">{new Date(p.completedAt).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'})}</span>}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'positive_behavior' && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 rounded-3xl text-white shadow-lg text-center relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10 blur-xl"></div>
                                            <div className="relative z-10">
                                                <Trophy size={48} className="mx-auto mb-2 text-yellow-300 drop-shadow-md"/>
                                                <h2 className="text-4xl font-extrabold">{points.total}</h2>
                                                <p className="text-emerald-100 text-sm font-bold tracking-widest uppercase">إجمالي نقاط التميز</p>
                                            </div>
                                        </div>
                                        <h3 className="font-bold text-slate-800 text-sm px-2">سجل التكريم والملاحظات الإيجابية</h3>
                                        {positiveObservations.length === 0 ? <p className="text-center text-slate-400 text-sm py-10 border-2 border-dashed border-slate-200 rounded-2xl">لا يوجد سجلات حتى الآن.</p> : (
                                            <div className="grid gap-3">
                                                {positiveObservations.map(obs => (
                                                    <div key={obs.id} className="bg-white p-4 rounded-2xl border-l-4 border-emerald-500 shadow-sm flex flex-col gap-3">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex items-center gap-3">
                                                                <div className="bg-emerald-50 p-2 rounded-xl text-emerald-600"><Medal size={24}/></div>
                                                                <div><p className="font-bold text-slate-800 text-sm">{obs.content.replace('تعزيز سلوكي: ', '').split('(')[0]}</p><p className="text-[10px] text-slate-400 mt-0.5">{obs.date} • {obs.staffName}</p></div>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => handlePrintCertificate(obs)} className="text-xs bg-slate-800 text-white w-full py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-900 transition-colors"><Printer size={14}/> عرض وطباعة الشهادة</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'calendar' && (
                                    <div className="animate-fade-in">
                                        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm mb-4">
                                            <div className="flex justify-between items-center mb-6">
                                                <button onClick={() => setCalendarMonth(new Date(calendarMonth.setMonth(calendarMonth.getMonth() - 1)))} className="p-2 bg-slate-50 rounded-full"><ChevronRight size={16}/></button>
                                                <h3 className="font-bold text-slate-800 text-lg">{calendarMonth.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}</h3>
                                                <button onClick={() => setCalendarMonth(new Date(calendarMonth.setMonth(calendarMonth.getMonth() + 1)))} className="p-2 bg-slate-50 rounded-full"><ChevronLeft size={16}/></button>
                                            </div>
                                            <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 mb-2"><div>أ</div><div>إ</div><div>ث</div><div>أ</div><div>خ</div><div>ج</div><div>س</div></div>
                                            <div className="grid grid-cols-7 gap-2">
                                                {getDaysInMonth(calendarMonth).map((date, i) => {
                                                    if (!date) return <div key={i}></div>;
                                                    const dateStr = date.toISOString().split('T')[0];
                                                    const attRecord = attendanceHistory.find(r => r.date === dateStr);
                                                    const hasExcuse = history.find(req => req.date === dateStr && req.status !== RequestStatus.REJECTED);
                                                    const hasExit = exitPermissions.find(e => e.createdAt.startsWith(dateStr));
                                                    let bgClass = 'bg-slate-50 text-slate-300';
                                                    if (attRecord?.status === AttendanceStatus.ABSENT) bgClass = hasExcuse ? 'bg-blue-500 text-white' : 'bg-red-500 text-white';
                                                    else if (attRecord?.status === AttendanceStatus.LATE) bgClass = 'bg-amber-400 text-white';
                                                    else if (attRecord?.status === AttendanceStatus.PRESENT) bgClass = 'bg-emerald-500 text-white';
                                                    let borderClass = hasExit ? 'ring-2 ring-purple-500' : '';
                                                    return <div key={i} className={`h-12 rounded-xl flex flex-col items-center justify-center text-xs font-bold ${bgClass} ${borderClass}`}><span>{date.getDate()}</span></div>;
                                                })}
                                            </div>
                                            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-4 justify-center text-[10px] font-bold text-slate-600">
                                                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> حضور</div>
                                                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> غياب (بدون عذر)</div>
                                                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span> غياب (بعذر)</div>
                                                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400"></span> تأخر</div>
                                                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border-2 border-purple-500"></span> استئذان</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'report' && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden">
                                            <div className="relative z-10"><h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Sparkles size={20}/> التقرير التربوي الذكي</h3><p className="text-blue-100 text-sm mb-4">تحليل شامل لأداء الطالب.</p>{!smartReport ? <button onClick={handleGenerateSmartReport} disabled={generatingReport} className="bg-white text-blue-700 px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-blue-50 transition-all flex items-center gap-2">{generatingReport ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} توليد التقرير الآن</button> : <button onClick={() => setSmartReport(null)} className="bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/30">إعادة التوليد</button>}</div>
                                        </div>
                                        {smartReport && <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm leading-relaxed text-slate-700 text-sm whitespace-pre-line animate-fade-in">{smartReport}</div>}
                                    </div>
                                )}

                                {(activeTab === 'behavior' || activeTab === 'observations') && (
                                    <div className="space-y-4 animate-fade-in">
                                        {(activeTab === 'behavior' ? behaviorHistory : observations).length === 0 ? <p className="text-center py-10 text-slate-400 text-sm">سجل نظيف.</p> : (activeTab === 'behavior' ? behaviorHistory : observations).map((rec: any) => (
                                            <div key={rec.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                                <div className="flex justify-between items-start mb-2"><h4 className="font-bold text-slate-800 text-sm">{activeTab === 'behavior' ? rec.violationName : rec.staffName}</h4><span className="text-xs text-slate-400">{rec.date}</span></div>
                                                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl mb-3 leading-relaxed">{activeTab === 'behavior' ? rec.actionTaken : rec.content}</p>
                                                {!rec.parentViewed ? (replyMode?.id === rec.id ? <div className="animate-fade-in"><textarea className="w-full p-3 border rounded-xl text-sm mb-2 outline-none" placeholder="اكتب ردك..." value={replyContent} onChange={e => setReplyContent(e.target.value)} autoFocus></textarea><div className="flex gap-2"><button onClick={() => { setReplyMode(null); setReplyContent(''); }} className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-xs font-bold">إلغاء</button><button onClick={handleSubmitReply} disabled={submittingReply} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold">{submittingReply ? <Loader2 className="animate-spin mx-auto" size={14}/> : 'إرسال'}</button></div></div> : <button onClick={() => { setReplyMode({id: rec.id, type: activeTab === 'behavior' ? 'behavior' : 'observation'}); setReplyContent(''); }} className="w-full bg-blue-50 text-blue-600 py-2 rounded-lg text-xs font-bold border border-blue-100 hover:bg-blue-100">تأكيد الاطلاع والرد</button>) : <div className="bg-emerald-50 p-2 rounded-lg text-xs text-emerald-700 font-bold flex items-center gap-2 border border-emerald-100"><CheckCircle size={14}/> تم الاطلاع {rec.parentFeedback && `- الرد: ${rec.parentFeedback}`}</div>}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeTab === 'visits' && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="space-y-3">
                                            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><CalendarCheck size={16} className="text-blue-600"/> المواعيد المتاحة</h3>
                                            {availableSlots.length === 0 ? <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm">لا توجد مواعيد متاحة حالياً.</div> : <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{availableSlots.map(slot => (<button key={slot.id} onClick={() => handleSlotClick(slot)} className="bg-white border border-slate-200 p-4 rounded-xl text-center hover:border-blue-500 hover:shadow-md transition-all group"><p className="font-bold text-blue-900 text-lg group-hover:text-blue-600">{slot.startTime}</p><p className="text-xs text-slate-400 mt-1">{slot.date}</p><span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded mt-2 inline-block">حجز</span></button>))}</div>}
                                        </div>
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                            <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-700 text-sm">سجل حجوزاتي</div>
                                            {myAppointments.length === 0 ? <p className="p-6 text-center text-slate-400 text-xs">لا يوجد حجوزات سابقة.</p> : (
                                                <div className="divide-y divide-slate-50">
                                                    {myAppointments.map(app => (
                                                        <div key={app.id} className="p-4 flex justify-between items-center text-sm hover:bg-slate-50 cursor-pointer" onClick={() => { if(app.status !== 'cancelled') openTicket(app); }}>
                                                            <div><p className="font-bold text-slate-800">{app.slot?.startTime} - {app.slot?.date}</p><p className="text-xs text-slate-500">{app.visitReason}</p></div>
                                                            <div className="flex flex-col items-end gap-1">{app.status === 'pending' && <span className="text-blue-500"><QrCode size={18}/></span>}<span className={`px-2 py-1 rounded text-xs font-bold ${app.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{app.status === 'completed' ? `وصل ${new Date(app.arrivedAt || '').toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'})}` : 'قادم'}</span></div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* MODALS */}
        {showBookingModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-3xl p-6 w-full max-w-sm relative">
                    {bookingSuccess ? (
                        <div className="relative w-full">
                            <button onClick={()=>{setShowBookingModal(false); setBookingSuccess(null)}} className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white/20 text-white p-2 rounded-full hover:bg-white/30"><X size={24}/></button>
                            <VisitorPass appt={bookingSuccess} />
                            <p className="text-center text-slate-500 text-xs mt-4">تم الحفظ</p>
                        </div>
                    ) : (
                        <form onSubmit={handleConfirmBooking} className="space-y-4">
                            <h3 className="font-bold text-lg text-slate-900">تأكيد الحجز</h3>
                            <input value={parentNameForVisit} onChange={e=>setParentNameForVisit(e.target.value)} placeholder="اسم الزائر" className="w-full p-3 border rounded-xl font-bold text-sm" required/>
                            <input value={visitReason} onChange={e=>setVisitReason(e.target.value)} placeholder="سبب الزيارة" className="w-full p-3 border rounded-xl font-bold text-sm" required/>
                            <div className="flex gap-2"><button type="button" onClick={()=>setShowBookingModal(false)} className="flex-1 bg-slate-100 py-3 rounded-xl font-bold text-sm">إلغاء</button><button type="submit" disabled={isBooking} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm">{isBooking ? <Loader2 className="animate-spin mx-auto"/> : 'تأكيد'}</button></div>
                        </form>
                    )}
                </div>
            </div>
        )}

        {showTicketModal && selectedTicket && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
                <div className="relative w-full max-w-sm">
                    <button onClick={()=>{setShowTicketModal(false); setSelectedTicket(null)}} className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white/20 text-white p-2 rounded-full hover:bg-white/30"><X size={24}/></button>
                    <VisitorPass appt={selectedTicket} />
                </div>
            </div>
        )}

        {showDigitalId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setShowDigitalId(false)}>
                <div className="w-full max-w-sm aspect-[1.586/1] bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 rounded-3xl shadow-2xl relative overflow-hidden border border-white/10" onClick={e => e.stopPropagation()}>
                    <div className="relative z-10 p-6 h-full flex flex-col justify-between">
                        <div className="flex justify-between items-start"><div><p className="text-[10px] text-blue-200 font-bold tracking-widest uppercase mb-1">Student ID Card</p><h3 className="text-lg font-bold text-white leading-tight">{SCHOOL_NAME}</h3></div><img src={SCHOOL_LOGO} alt="Logo" className="w-10 h-10 object-contain bg-white/10 rounded-full p-1"/></div>
                        <div className="flex items-end justify-between mt-auto">
                            <div><p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Name</p><p className="text-xl font-bold text-white mb-3 tracking-wide">{selectedStudent?.name}</p><div className="flex gap-4"><div><p className="text-[9px] text-slate-400 font-bold uppercase">ID</p><p className="text-sm font-mono text-blue-100">{selectedStudent?.studentId}</p></div><div><p className="text-[9px] text-slate-400 font-bold uppercase">Grade</p><p className="text-sm font-mono text-blue-100">{selectedStudent?.grade}</p></div></div></div>
                            <div className="bg-white p-1.5 rounded-lg"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${selectedStudent?.studentId}`} className="w-16 h-16 mix-blend-multiply" alt="QR"/></div>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Inquiry;