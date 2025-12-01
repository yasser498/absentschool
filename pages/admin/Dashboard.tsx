import React, { useMemo, useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { 
  FileText, Clock, CheckCircle, Sparkles, Calendar, AlertTriangle, Loader2, BrainCircuit, 
  Search, Settings, Printer, BarChart2, Users, Trash2, ShieldAlert, Send, Megaphone, Activity, LayoutGrid, RefreshCw, Plus, UserCheck, CalendarCheck, Edit, GitCommit, List, Save, AlertCircle, Eye, ArrowRight, Gavel, Check, School, LogOut, MessageSquare
} from 'lucide-react';
import { 
  getRequests, getStudents, getConsecutiveAbsences, resolveAbsenceAlert, getBehaviorRecords, 
  sendAdminInsight, getAttendanceRecords, generateSmartContent, 
  clearAttendance, clearRequests, clearStudents, clearBehaviorRecords, clearAdminInsights, 
  clearReferrals, getSchoolNews, updateSchoolNews, addSchoolNews, deleteSchoolNews,
  getAvailableSlots, addAppointmentSlot, deleteAppointmentSlot, getDailyAppointments, getStaffUsers,
  getBotContext, getExitPermissions, generateDefaultAppointmentSlots, updateAppointmentSlot,
  getStudentObservations, getReferrals, updateReferralStatus, getAdminInsights
} from '../../services/storage';
import { ExcuseRequest, Student, BehaviorRecord, AttendanceRecord, SchoolNews, Appointment, AppointmentSlot, StaffUser, ExitPermission, StudentObservation, Referral, AdminInsight } from '../../types';

const { useNavigate } = ReactRouterDOM as any;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // Navigation & View State
  const [activeView, setActiveView] = useState<'overview' | 'tracking' | 'behavior' | 'appointments' | 'directives' | 'news' | 'settings'>('overview');
  
  // Core Data
  const [requests, setRequests] = useState<ExcuseRequest[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [behaviorRecords, setBehaviorRecords] = useState<BehaviorRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [observations, setObservations] = useState<StudentObservation[]>([]); 
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [todaysExits, setTodaysExits] = useState<ExitPermission[]>([]);
  
  const [dataLoading, setDataLoading] = useState(true);
  
  // School Identity
  const [schoolName, setSchoolName] = useState(localStorage.getItem('school_name') || 'متوسطة عماد الدين زنكي');
  const [schoolLogo, setSchoolLogo] = useState(localStorage.getItem('school_logo') || 'https://www.raed.net/img?id=1471924');
  
  // Alerts & AI
  const [alerts, setAlerts] = useState<any[]>([]);
  const [aiBriefing, setAiBriefing] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Settings
  const [tempSchoolName, setTempSchoolName] = useState(schoolName);
  const [tempSchoolLogo, setTempSchoolLogo] = useState(schoolLogo);
  const [isDeleting, setIsDeleting] = useState(false);

  // Tracking
  const [trackingFilter, setTrackingFilter] = useState<'all' | 'pending' | 'resolved'>('all');

  // Appointments
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [apptDate, setApptDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGeneratingSlots, setIsGeneratingSlots] = useState(false);
  const [appointmentsList, setAppointmentsList] = useState<Appointment[]>([]);

  // News
  const [newsList, setNewsList] = useState<SchoolNews[]>([]);
  const [newNewsTitle, setNewNewsTitle] = useState('');
  const [newNewsContent, setNewNewsContent] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  // Directives
  const [directiveContent, setDirectiveContent] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [sentDirectives, setSentDirectives] = useState<AdminInsight[]>([]);
  const [isSendingDirective, setIsSendingDirective] = useState(false);

  // Global Search
  const [globalSearch, setGlobalSearch] = useState('');

  const fetchData = async () => {
      setDataLoading(true);
      try {
        const [reqs, studs, behaviors, atts, news, apps, obs, refs, risks, slts, exits, dirs] = await Promise.all([
            getRequests(), 
            getStudents(), 
            getBehaviorRecords(),
            getAttendanceRecords(),
            getSchoolNews(),
            getDailyAppointments(apptDate),
            getStudentObservations(),
            getReferrals(),
            getConsecutiveAbsences(),
            getAvailableSlots(apptDate),
            getExitPermissions(apptDate),
            getAdminInsights()
        ]);
        setRequests(reqs);
        setStudents(studs);
        setBehaviorRecords(behaviors);
        setAttendanceRecords(atts);
        setNewsList(news);
        setAppointmentsList(apps);
        setObservations(obs);
        setReferrals(refs);
        setAlerts(risks);
        setSlots(slts);
        setTodaysExits(exits);
        setSentDirectives(dirs);

      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setDataLoading(false);
      }
  };

  useEffect(() => { fetchData(); }, [apptDate]);

  // --- STATS LOGIC ---
  const stats = useMemo(() => { 
      const todayStr = apptDate;
      const todaysAttendance = attendanceRecords.filter(r => r.date === todayStr);
      let present = 0, absent = 0, late = 0;
      todaysAttendance.forEach(record => record.records.forEach(stu => {
          if (stu.status === 'PRESENT') present++;
          else if (stu.status === 'ABSENT') absent++;
          else if (stu.status === 'LATE') late++;
      }));

      const todayViolations = behaviorRecords.filter(r => r.date === todayStr).length;
      const todayExits = todaysExits.length;
      const todayVisits = appointmentsList.filter(a => a.status === 'completed').length;

      return { 
          total: requests.length, 
          pending: requests.filter(r => r.status === 'PENDING').length, 
          studentsCount: students.length, 
          present, absent, late,
          todayViolations,
          todayExits,
          todayVisits
      }; 
  }, [requests, students, attendanceRecords, behaviorRecords, todaysExits, appointmentsList, apptDate]);

  // --- HANDLERS ---
  const handleSaveSettings = () => {
      localStorage.setItem('school_name', tempSchoolName);
      localStorage.setItem('school_logo', tempSchoolLogo);
      setSchoolName(tempSchoolName);
      setSchoolLogo(tempSchoolLogo);
      alert("تم حفظ الإعدادات بنجاح! سيتم تحديث النظام.");
      window.location.reload();
  };

  const handleClearData = async (target: 'requests'|'attendance'|'behavior'|'students'|'referrals'|'all') => {
      if(!window.confirm("تحذير: هذا الإجراء سيحذف البيانات نهائياً. هل أنت متأكد؟")) return;
      setIsDeleting(true);
      try {
          if(target==='requests') await clearRequests();
          if(target==='attendance') await clearAttendance();
          if(target==='behavior') await clearBehaviorRecords();
          if(target==='referrals') await clearReferrals();
          if(target==='students') await clearStudents();
          if(target==='all') {
              await Promise.all([clearRequests(), clearAttendance(), clearBehaviorRecords(), clearReferrals(), clearStudents()]);
          }
          alert("تم الحذف بنجاح.");
          fetchData();
      } catch(e) { alert("حدث خطأ"); } finally { setIsDeleting(false); }
  };

  const handleGenerateBriefing = async () => {
      setIsGenerating(true);
      try {
          const prompt = `بصفتك مدير مدرسة، حلل التالي ليوم ${apptDate}:
          - الغياب: ${stats.absent}
          - التأخر: ${stats.late}
          - المخالفات: ${stats.todayViolations}
          - الخروج (الاستئذان): ${stats.todayExits}
          - الزوار: ${stats.todayVisits}
          
          أعط ملخصاً تنفيذياً وتوجيهاً واحداً.`;
          const res = await generateSmartContent(prompt);
          setAiBriefing(res);
      } catch(e) { alert("خطأ"); } finally { setIsGenerating(false); }
  };

  // --- APPOINTMENTS HANDLERS ---
  const handleGenerateSlots = async () => {
      setIsGeneratingSlots(true);
      try {
          await generateDefaultAppointmentSlots(apptDate);
          await fetchData();
          alert("تم توليد المواعيد (8:00 - 11:00) بنجاح.");
      } catch (e) { alert("فشل التوليد، ربما المواعيد موجودة مسبقاً."); } finally { setIsGeneratingSlots(false); }
  };

  const handleDeleteSlot = async (id: string) => {
      if(!confirm("حذف الموعد؟")) return;
      await deleteAppointmentSlot(id);
      fetchData();
  };

  // --- NEWS HANDLERS ---
  const handleAddNews = async () => {
      if(!newNewsTitle || !newNewsContent) return;
      try {
          await addSchoolNews({
              title: newNewsTitle,
              content: newNewsContent,
              author: 'الإدارة المدرسية',
              isUrgent
          });
          setNewNewsTitle(''); setNewNewsContent(''); setIsUrgent(false);
          fetchData();
          alert("تم النشر بنجاح");
      } catch(e) { alert("خطأ"); }
  };

  const handleDeleteNews = async (id: string) => {
      if(!confirm("حذف الخبر؟")) return;
      await deleteSchoolNews(id);
      fetchData();
  };

  // --- DIRECTIVES HANDLERS ---
  const handleSendDirective = async () => {
      if(!directiveContent || selectedTargets.length === 0) {
          alert("الرجاء كتابة التوجيه وتحديد المستهدفين.");
          return;
      }
      setIsSendingDirective(true);
      try {
          // Send to each target
          for (const target of selectedTargets) {
              await sendAdminInsight(target as any, directiveContent);
          }
          alert("تم إرسال التوجيه بنجاح.");
          setDirectiveContent('');
          setSelectedTargets([]);
          fetchData();
      } catch(e) { alert("فشل الإرسال"); } finally { setIsSendingDirective(false); }
  };

  const toggleTarget = (target: string) => {
      if (selectedTargets.includes(target)) setSelectedTargets(prev => prev.filter(t => t !== target));
      else setSelectedTargets(prev => [...prev, target]);
  };

  const improveDirective = async () => {
      if(!directiveContent) return;
      try {
          const res = await generateSmartContent(`حسن صياغة هذا التوجيه الإداري ليكون رسمياً وواضحاً: "${directiveContent}"`);
          setDirectiveContent(res.trim());
      } catch(e) { alert("فشل التحسين"); }
  };

  // --- RENDERERS ---
  const StatCard = ({ title, value, icon: Icon, color }: any) => (
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
          <div>
              <p className="text-slate-500 text-xs font-bold uppercase mb-1">{title}</p>
              <h3 className={`text-3xl font-extrabold ${color}`}>{value}</h3>
          </div>
          <div className={`p-3 rounded-2xl ${color.replace('text-', 'bg-').replace('600', '50')} ${color} group-hover:scale-110 transition-transform`}>
              <Icon size={24} />
          </div>
      </div>
  );

  return (
    <div className="space-y-6 pb-20 relative font-sans bg-slate-50 min-h-screen">
      
      {/* 1. HEADER */}
      <header className="bg-white relative z-40 border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg"><LayoutGrid size={24} /></div>
              <div><h1 className="text-xl font-extrabold text-slate-800">مركز القيادة</h1><p className="text-xs text-slate-500 font-bold">لوحة التحكم المركزية</p></div>
          </div>
          <div className="flex gap-3 items-center w-full md:w-auto">
              <input type="date" value={apptDate} onChange={e => setApptDate(e.target.value)} className="bg-slate-100 border-none rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none"/>
              <div className="relative w-full md:w-64 group">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="بحث شامل..." value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} className="w-full pr-10 pl-4 py-2 bg-slate-100 border-none rounded-xl outline-none font-bold text-slate-700 text-sm"/>
              </div>
          </div>
      </header>

      {/* 2. TABS */}
      <div className="px-6 flex overflow-x-auto pb-2 gap-2 scrollbar-hide">
          {[
              { id: 'overview', label: 'المتابعة اليومية', icon: Activity },
              { id: 'tracking', label: 'الإحالات', icon: GitCommit },
              { id: 'appointments', label: 'المواعيد والأمن', icon: CalendarCheck },
              { id: 'directives', label: 'التوجيهات', icon: Megaphone },
              { id: 'news', label: 'المركز الإعلامي', icon: FileText },
              { id: 'settings', label: 'الإعدادات', icon: Settings },
          ].map(tab => (
              <button key={tab.id} onClick={() => setActiveView(tab.id as any)} className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap border ${activeView === tab.id ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                  <tab.icon size={16} /> {tab.label}
              </button>
          ))}
      </div>

      {/* === OVERVIEW (DAILY PULSE) === */}
      {activeView === 'overview' && (
          <div className="px-6 space-y-6 animate-fade-in">
              {/* AI Insight */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10 gap-4">
                      <div><h2 className="text-xl font-bold flex items-center gap-2"><Sparkles className="text-amber-300"/> ملخص القيادة اليومي</h2><p className="text-indigo-100 text-sm mt-1">تحليل فوري لبيانات المدرسة ليوم {apptDate}.</p></div>
                      <button onClick={handleGenerateBriefing} disabled={isGenerating} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2">{isGenerating ? <Loader2 className="animate-spin"/> : 'توليد التقرير'}</button>
                  </div>
                  {aiBriefing && <div className="mt-4 bg-black/20 p-4 rounded-xl text-sm whitespace-pre-line leading-relaxed border border-white/10">{aiBriefing}</div>}
              </div>

              {/* Vital Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <StatCard title="حضور اليوم" value={stats.present} icon={UserCheck} color="text-emerald-600" />
                  <StatCard title="غياب اليوم" value={stats.absent} icon={UserCheck} color="text-red-600" />
                  <StatCard title="تأخر اليوم" value={stats.late} icon={Clock} color="text-amber-600" />
                  <StatCard title="خروج (استئذان)" value={stats.todayExits} icon={LogOut} color="text-orange-600" />
                  <StatCard title="زوار اليوم" value={stats.todayVisits} icon={Users} color="text-blue-600" />
                  <StatCard title="مخالفات مرصودة" value={stats.todayViolations} icon={ShieldAlert} color="text-purple-600" />
                  <StatCard title="طلبات أعذار" value={stats.pending} icon={MessageSquare} color="text-pink-600" />
                  <StatCard title="مؤشر الخطر" value={alerts.length} icon={AlertTriangle} color="text-red-800" />
              </div>

              {/* Live Feeds Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Latest Violations */}
                  <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm h-96 flex flex-col">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><ShieldAlert size={18} className="text-red-500"/> أحدث المخالفات اليوم</h3>
                      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                          {behaviorRecords.filter(r => r.date === apptDate).length === 0 ? <p className="text-slate-400 text-sm text-center pt-10">لا يوجد مخالفات اليوم</p> : 
                           behaviorRecords.filter(r => r.date === apptDate).slice(0, 10).map((rec, i) => (
                              <div key={i} className="bg-red-50 p-3 rounded-xl border border-red-100">
                                  <div className="flex justify-between"><span className="font-bold text-slate-800 text-sm">{rec.studentName}</span><span className="text-[10px] text-red-600 bg-white px-2 rounded-full border border-red-200">{rec.violationDegree}</span></div>
                                  <p className="text-xs text-slate-500 mt-1">{rec.violationName}</p>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Latest Exits */}
                  <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm h-96 flex flex-col">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><LogOut size={18} className="text-orange-500"/> حركة الخروج (الاستئذان)</h3>
                      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                          {todaysExits.length === 0 ? <p className="text-slate-400 text-sm text-center pt-10">لا يوجد خروج اليوم</p> : 
                           todaysExits.map((ex, i) => (
                              <div key={i} className="bg-orange-50 p-3 rounded-xl border border-orange-100 flex justify-between items-center">
                                  <div><p className="font-bold text-slate-800 text-sm">{ex.studentName}</p><p className="text-[10px] text-slate-500">{ex.reason}</p></div>
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded ${ex.status==='completed'?'bg-emerald-100 text-emerald-700':'bg-white text-orange-600'}`}>{ex.status==='completed'?'خرج':'انتظار'}</span>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Latest Visitors */}
                  <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm h-96 flex flex-col">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Users size={18} className="text-blue-500"/> سجل الزوار</h3>
                      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                          {appointmentsList.length === 0 ? <p className="text-slate-400 text-sm text-center pt-10">لا يوجد زوار اليوم</p> : 
                           appointmentsList.map((app, i) => (
                              <div key={i} className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                                  <div className="flex justify-between"><span className="font-bold text-slate-800 text-sm">{app.parentName}</span><span className="text-[10px] font-mono text-blue-600">{app.slot?.startTime}</span></div>
                                  <p className="text-xs text-slate-500 mt-1">ولي أمر: {app.studentName}</p>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* === APPOINTMENTS & SECURITY === */}
      {activeView === 'appointments' && (
          <div className="px-6 space-y-6 animate-fade-in">
              <div className="flex flex-col md:flex-row gap-6">
                  {/* Slots Management */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex-1">
                      <div className="flex justify-between items-center mb-6">
                          <h3 className="font-bold text-slate-800 flex items-center gap-2"><CalendarCheck size={20} className="text-blue-600"/> إدارة المواعيد ({apptDate})</h3>
                          <button onClick={handleGenerateSlots} disabled={isGeneratingSlots} className="bg-blue-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">{isGeneratingSlots?<Loader2 className="animate-spin"/>:<Plus size={16}/>} توليد تلقائي (8-11)</button>
                      </div>
                      <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                          {slots.length === 0 ? <p className="text-center text-slate-400 py-10">لم يتم إنشاء مواعيد لهذا اليوم.</p> : 
                           slots.map(slot => (
                              <div key={slot.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                  <div className="flex items-center gap-3">
                                      <span className="font-mono font-bold text-slate-700 bg-white px-2 py-1 rounded border">{slot.startTime} - {slot.endTime}</span>
                                      <span className="text-xs text-slate-500 font-bold">حجوزات: {slot.currentBookings} / {slot.maxCapacity}</span>
                                  </div>
                                  <button onClick={() => handleDeleteSlot(slot.id)} className="text-red-400 hover:text-red-600 bg-white p-2 rounded-lg border hover:bg-red-50"><Trash2 size={16}/></button>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Today's Visitors */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex-1">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-6"><Users size={20} className="text-emerald-600"/> قائمة الزوار اليوم</h3>
                      <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                          {appointmentsList.length === 0 ? <p className="text-center text-slate-400 py-10">لا يوجد حجوزات اليوم.</p> : 
                           appointmentsList.map(app => (
                              <div key={app.id} className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <h4 className="font-bold text-slate-900">{app.parentName}</h4>
                                          <p className="text-xs text-slate-500 mt-1">ولي أمر الطالب: {app.studentName}</p>
                                          <p className="text-xs text-slate-500">السبب: {app.visitReason}</p>
                                      </div>
                                      <div className="text-left">
                                          <span className="block font-mono text-emerald-800 font-bold">{app.slot?.startTime}</span>
                                          <span className={`text-[10px] px-2 py-1 rounded font-bold ${app.status==='completed'?'bg-emerald-200 text-emerald-800':'bg-white text-slate-500 border'}`}>
                                              {app.status==='completed' ? 'تم الدخول' : 'انتظار'}
                                          </span>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* === DIRECTIVES === */}
      {activeView === 'directives' && (
          <div className="px-6 space-y-6 animate-fade-in">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Megaphone className="text-purple-600"/> إرسال توجيه إداري</h2>
                  
                  <div className="flex flex-wrap gap-4 mb-4">
                      {[{id:'teachers', label:'المعلمين'}, {id:'deputy', label:'الوكيل'}, {id:'counselor', label:'الموجه الطلابي'}].map(role => (
                          <button key={role.id} onClick={()=>toggleTarget(role.id)} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${selectedTargets.includes(role.id) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                              {role.label}
                          </button>
                      ))}
                  </div>

                  <div className="relative mb-4">
                      <textarea value={directiveContent} onChange={e=>setDirectiveContent(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl min-h-[150px] outline-none focus:ring-2 focus:ring-purple-200" placeholder="اكتب نص التوجيه هنا..."></textarea>
                      <button onClick={improveDirective} className="absolute bottom-4 left-4 text-xs bg-white border border-purple-200 text-purple-600 px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 hover:bg-purple-50"><BrainCircuit size={14}/> تحسين الصياغة</button>
                  </div>

                  <button onClick={handleSendDirective} disabled={isSendingDirective} className="bg-purple-900 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-800 transition-all shadow-lg">{isSendingDirective?<Loader2 className="animate-spin"/>:<Send size={18}/>} إرسال التوجيه</button>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-4">سجل التوجيهات المرسلة</h3>
                  <div className="space-y-3">
                      {sentDirectives.length === 0 ? <p className="text-center text-slate-400">لا يوجد توجيهات سابقة.</p> : 
                       sentDirectives.map(d => (
                          <div key={d.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-start">
                              <div>
                                  <p className="text-sm text-slate-800 leading-relaxed">{d.content}</p>
                                  <div className="flex gap-2 mt-2">
                                      <span className="text-[10px] bg-white border px-2 py-1 rounded text-slate-500">{new Date(d.createdAt).toLocaleDateString('ar-SA')}</span>
                                      <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold">{d.targetRole === 'teachers' ? 'المعلمين' : d.targetRole === 'deputy' ? 'الوكيل' : 'الموجه'}</span>
                                  </div>
                              </div>
                              <button onClick={()=>clearAdminInsights().then(fetchData)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* === NEWS (MEDIA CENTER) === */}
      {activeView === 'news' && (
          <div className="px-6 space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Add News Form */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><FileText className="text-blue-600"/> نشر خبر جديد</h2>
                      <div className="space-y-4">
                          <div><label className="text-xs font-bold text-slate-500 block mb-1">عنوان الخبر</label><input value={newNewsTitle} onChange={e=>setNewNewsTitle(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm"/></div>
                          <div><label className="text-xs font-bold text-slate-500 block mb-1">تفاصيل الخبر</label><textarea value={newNewsContent} onChange={e=>setNewNewsContent(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl text-sm min-h-[120px]"></textarea></div>
                          <div className="flex items-center gap-2 cursor-pointer" onClick={()=>setIsUrgent(!isUrgent)}>
                              <div className={`w-5 h-5 rounded border flex items-center justify-center ${isUrgent?'bg-red-500 border-red-500':'bg-white border-slate-300'}`}>{isUrgent && <Check size={14} className="text-white"/>}</div>
                              <span className="text-sm font-bold text-slate-700">خبر عاجل / هام</span>
                          </div>
                          <button onClick={handleAddNews} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg">نشر الآن</button>
                      </div>
                  </div>

                  {/* News List */}
                  <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <h3 className="font-bold text-slate-800 mb-4">الأخبار المنشورة</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {newsList.map(n => (
                              <div key={n.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                                  <button onClick={()=>handleDeleteNews(n.id)} className="absolute top-3 left-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={18}/></button>
                                  <div className="flex items-center gap-2 mb-2">
                                      <span className={`text-[10px] px-2 py-1 rounded font-bold ${n.isUrgent ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{n.isUrgent ? 'عاجل' : 'عام'}</span>
                                      <span className="text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleDateString('ar-SA')}</span>
                                  </div>
                                  <h4 className="font-bold text-slate-900 mb-1 line-clamp-1">{n.title}</h4>
                                  <p className="text-xs text-slate-500 line-clamp-2">{n.content}</p>
                              </div>
                          ))}
                          {newsList.length === 0 && <p className="text-center text-slate-400 col-span-2 py-10">لا يوجد أخبار منشورة.</p>}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Reuse Settings Tab from previous logic (kept minimal for brevity as it was already implemented) */}
      {activeView === 'settings' && (
          <div className="max-w-2xl mx-auto px-6 space-y-8 animate-fade-in">
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><School className="text-blue-600"/> إعدادات المدرسة</h2>
                  <div className="space-y-4">
                      <div><label className="block text-sm font-bold text-slate-500 mb-2">اسم المدرسة</label><input value={tempSchoolName} onChange={e=>setTempSchoolName(e.target.value)} className="w-full p-3 border rounded-xl font-bold"/></div>
                      <div><label className="block text-sm font-bold text-slate-500 mb-2">رابط الشعار (URL)</label><input value={tempSchoolLogo} onChange={e=>setTempSchoolLogo(e.target.value)} className="w-full p-3 border rounded-xl text-sm font-mono dir-ltr"/></div>
                      <button onClick={handleSaveSettings} className="w-full bg-blue-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-800"><Save size={18}/> حفظ التغييرات</button>
                  </div>
              </div>
              <div className="bg-red-50 p-8 rounded-3xl border border-red-100">
                  <h2 className="text-xl font-bold text-red-800 mb-6 flex items-center gap-2"><AlertTriangle className="text-red-600"/> منطقة الخطر</h2>
                  <button onClick={()=>handleClearData('all')} disabled={isDeleting} className="w-full bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 flex items-center justify-center gap-2"><Trash2 size={20}/> تصفير النظام بالكامل</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;