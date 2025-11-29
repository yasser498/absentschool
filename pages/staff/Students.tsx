
import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Search, Phone, MessageCircle, X, Loader2, BookUser, Copy, Check, School, Smartphone, Inbox, LayoutGrid, HeartHandshake, UserPlus, Users, ArrowRight, ClipboardList, Send, FileText, Printer, Calendar, Plus, ShieldAlert, FileWarning, Eye, TrendingDown, Clock, AlertCircle, CheckCircle, ArrowLeft, RefreshCw, Activity, GitCommit, UserCheck, Sparkles } from 'lucide-react';
import { getStudents, getStudentAttendanceHistory, getReferrals, updateReferralStatus, addGuidanceSession, getGuidanceSessions, getBehaviorRecords, getStudentObservations, getConsecutiveAbsences, generateGuidancePlan } from '../../services/storage';
import { Student, StaffUser, AttendanceStatus, Referral, GuidanceSession, BehaviorRecord, StudentObservation } from '../../types';
import { GRADES } from '../../constants';

const { useNavigate, useLocation } = ReactRouterDOM as any;

const StaffStudents: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Detect Mode: Directory only vs Full Counselor Office
  const isDirectoryMode = location.pathname === '/staff/directory';

  // View State
  const [activeView, setActiveView] = useState<'dashboard' | 'directory' | 'inbox' | 'sessions'>('dashboard');

  // Force Directory View if in Directory Mode
  useEffect(() => {
      if (isDirectoryMode) {
          setActiveView('directory');
      }
  }, [isDirectoryMode]);

  // Data
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [sessions, setSessions] = useState<GuidanceSession[]>([]);
  const [riskList, setRiskList] = useState<any[]>([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterClass, setFilterClass] = useState('');

  // Student Details Modal
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'tracking' | 'sessions' | 'behavior' | 'observations'>('info');
  const [studentHistory, setStudentHistory] = useState<{ date: string, status: AttendanceStatus }[]>([]);
  const [studentBehaviors, setStudentBehaviors] = useState<BehaviorRecord[]>([]);
  const [studentObservations, setStudentObservations] = useState<StudentObservation[]>([]);
  const [studentReferrals, setStudentReferrals] = useState<Referral[]>([]); // New State for Tracking
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Forms
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionTopic, setSessionTopic] = useState('');
  const [sessionRecs, setSessionRecs] = useState('');
  const [sessionType, setSessionType] = useState<'individual' | 'group' | 'parent_meeting'>('individual');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false); // NEW

  const [referralReplyMode, setReferralReplyMode] = useState<string | null>(null);
  const [referralOutcome, setReferralOutcome] = useState('');

  // Session Selector State
  const [isSelectingStudentForSession, setIsSelectingStudentForSession] = useState(false);

  // Reporting
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const session = localStorage.getItem('ozr_staff_session');
    if (session) setCurrentUser(JSON.parse(session));
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
        const [s, r, g, risks] = await Promise.all([
            getStudents(),
            getReferrals(),
            getGuidanceSessions(),
            !isDirectoryMode ? getConsecutiveAbsences() : Promise.resolve([])
        ]);
        setStudents(s);
        setReferrals(r.filter(ref => ref.status === 'pending' || ref.status === 'in_progress'));
        setSessions(g);
        setRiskList(risks);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isDirectoryMode]);

  // Directory Logic
  const availableClasses = useMemo(() => {
    if (!filterGrade) return [];
    const classes = new Set(students.filter(s => s.grade === filterGrade).map(s => s.className));
    return Array.from(classes).sort();
  }, [students, filterGrade]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = s.name.includes(searchTerm) || s.studentId.includes(searchTerm) || s.phone.includes(searchTerm);
      const matchesGrade = filterGrade ? s.grade === filterGrade : true;
      const matchesClass = filterClass ? s.className === filterClass : true;
      return matchesSearch && matchesGrade && matchesClass;
    });
  }, [students, searchTerm, filterGrade, filterClass]);

  // Session Reporting Logic
  const dailySessions = useMemo(() => {
      return sessions.filter(s => s.date === reportDate);
  }, [sessions, reportDate]);

  const openWhatsApp = (phone: string) => {
    if (!phone) return;
    let cleanPhone = phone.replace(/\D/g, ''); 
    if (cleanPhone.startsWith('05')) cleanPhone = '966' + cleanPhone.substring(1);
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  // Actions
  const handleOpenStudent = async (student: Student, defaultTab: 'info' | 'sessions' = 'info') => {
      setSelectedStudent(student);
      setActiveTab(defaultTab);
      setLoadingDetails(true);
      
      try {
        const [hist, beh, obs, refs] = await Promise.all([
            getStudentAttendanceHistory(student.studentId, student.grade, student.className),
            getBehaviorRecords(student.studentId),
            getStudentObservations(student.studentId),
            getReferrals(student.studentId) // Fetch referrals for this student
        ]);
        setStudentHistory(hist);
        setStudentBehaviors(beh);
        setStudentObservations(obs);
        setStudentReferrals(refs);
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingDetails(false);
      }
  };

  const openSessionStudentSelector = () => {
      setIsSelectingStudentForSession(true);
      setSearchTerm('');
      setFilterGrade('');
      setFilterClass('');
  };

  const handleAcceptReferral = async (id: string) => {
      await updateReferralStatus(id, 'in_progress');
      fetchData();
  };

  const handleReturnReferral = async (id: string) => {
      if (!referralOutcome.trim()) { alert("يرجى كتابة المرئيات قبل الإعادة."); return; }
      await updateReferralStatus(id, 'returned_to_deputy', referralOutcome);
      setReferralReplyMode(null);
      setReferralOutcome('');
      fetchData();
      alert("تم إعادة الحالة لوكيل الشؤون الطلابية مع التقرير.");
  };

  const handleGeneratePlan = async () => {
      if(!selectedStudent) return;
      setIsGeneratingPlan(true);
      try {
          // Summarize history
          const summary = `
             غياب: ${studentHistory.filter(h=>h.status==='ABSENT').length} أيام.
             مخالفات: ${studentBehaviors.map(b=>b.violationName).join(', ')}.
             ملاحظات: ${studentObservations.map(o=>o.content).join(', ')}.
          `;
          const plan = await generateGuidancePlan(selectedStudent.name, summary);
          setSessionRecs(plan);
      } catch(e) { alert("فشل التوليد"); }
      finally { setIsGeneratingPlan(false); }
  };

  const handleSaveSession = async () => {
      if (!selectedStudent || !sessionTopic) return;
      try {
          await addGuidanceSession({
              id: '',
              studentId: selectedStudent.studentId,
              studentName: selectedStudent.name,
              date: new Date().toISOString().split('T')[0],
              sessionType: sessionType,
              topic: sessionTopic,
              recommendations: sessionRecs,
              status: 'completed'
          });
          alert("تم حفظ الجلسة بنجاح.");
          setShowSessionForm(false);
          setSessionTopic('');
          setSessionRecs('');
          // Refresh sessions
          fetchData(); 
      } catch (e) {
          alert("حدث خطأ أثناء الحفظ.");
      }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert('تم النسخ');
  };

  const handlePrintReport = () => {
      window.print();
  };

  const getStudentClass = (studentId: string) => {
      const s = students.find(st => st.studentId === studentId);
      return s ? `${s.grade} - ${s.className}` : '---';
  };

  const getReferralStatusBadge = (status: string) => {
      switch(status) {
          case 'pending': return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold border border-amber-200">جديد / معلق</span>;
          case 'in_progress': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-200">قيد المعالجة</span>;
          case 'returned_to_deputy': return <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold border border-purple-200">معاد للوكيل</span>;
          case 'resolved': return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold border border-emerald-200">مغلق / تم الحل</span>;
          default: return <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold border border-slate-200">{status}</span>;
      }
  };

  if (!currentUser) return null;

  return (
    <>
    <style>
    {`
        @media print {
        body * { visibility: hidden; }
        #session-report-print, #session-report-print * { visibility: visible; }
        #session-report-print { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; background: white; z-index: 9999; }
        .no-print { display: none !important; }
        }
    `}
    </style>

    {/* PRINTABLE REPORT */}
    <div id="session-report-print" className="hidden" dir="rtl">
        <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
            <div className="text-right font-bold text-sm space-y-1">
                <p>المملكة العربية السعودية</p>
                <p>وزارة التعليم</p>
                <p>التوجيه الطلابي</p>
            </div>
            <div className="text-center">
                <h1 className="text-2xl font-bold mb-2">تقرير الجلسات الإرشادية اليومي</h1>
                <p className="text-lg">التاريخ: {reportDate}</p>
            </div>
            <div className="text-left font-bold text-sm">
                <p>الموجه الطلابي</p>
                <p>{currentUser.name}</p>
            </div>
        </div>

        <table className="w-full text-right border-collapse border border-black text-sm">
            <thead>
                <tr className="bg-gray-100">
                    <th className="border border-black p-3 w-10">م</th>
                    <th className="border border-black p-3">اسم الطالب</th>
                    <th className="border border-black p-3">الصف / الفصل</th>
                    <th className="border border-black p-3">نوع الجلسة</th>
                    <th className="border border-black p-3">الموضوع / المشكلة</th>
                    <th className="border border-black p-3">النتائج / التوصيات</th>
                </tr>
            </thead>
            <tbody>
                {dailySessions.length > 0 ? (
                    dailySessions.map((s, idx) => (
                        <tr key={idx}>
                            <td className="border border-black p-3 text-center">{idx + 1}</td>
                            <td className="border border-black p-3 font-bold">{s.studentName}</td>
                            <td className="border border-black p-3">{getStudentClass(s.studentId)}</td>
                            <td className="border border-black p-3">
                                {s.sessionType === 'individual' ? 'فردية' : s.sessionType === 'group' ? 'جماعية' : 'ولي أمر'}
                            </td>
                            <td className="border border-black p-3">{s.topic}</td>
                            <td className="border border-black p-3">{s.recommendations}</td>
                        </tr>
                    ))
                ) : (
                    <tr><td colSpan={6} className="border border-black p-4 text-center">لا توجد جلسات مسجلة لهذا اليوم.</td></tr>
                )}
            </tbody>
        </table>

        <div className="mt-12 flex justify-between px-10">
            <div className="text-center">
                <p className="font-bold mb-8">الموجه الطلابي</p>
                <p>{currentUser.name}</p>
            </div>
            <div className="text-center">
                <p className="font-bold mb-8">مدير المدرسة</p>
                <p>.............................</p>
            </div>
        </div>
    </div>

    {/* APP UI */}
    <div className="space-y-6 pb-20 animate-fade-in relative no-print">
      
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
         <div className="flex items-center gap-3">
             <div className="bg-purple-50 p-3 rounded-2xl text-purple-600">
                 {isDirectoryMode ? <BookUser size={28} /> : <HeartHandshake size={28} />}
             </div>
             <div>
                 <h1 className="text-2xl font-bold text-slate-900">{isDirectoryMode ? 'دليل التواصل المدرسي' : 'مكتب الموجه الطلابي'}</h1>
                 <p className="text-sm text-slate-500">{isDirectoryMode ? 'البحث عن بيانات الطلاب وأرقام التواصل' : 'رعاية الطلاب | دراسة الحالات | تعديل السلوك'}</p>
             </div>
         </div>
         
         {/* Navigation for Counselor */}
         {!isDirectoryMode && (
             <div className="flex bg-slate-100 p-1 rounded-xl">
                 {[
                     { id: 'dashboard', label: 'الرئيسية', icon: LayoutGrid },
                     { id: 'inbox', label: 'الإحالات', icon: Inbox, count: referrals.filter(r => r.status === 'pending').length },
                     { id: 'sessions', label: 'الجلسات', icon: ClipboardList },
                     { id: 'directory', label: 'الدليل', icon: BookUser },
                 ].map(tab => (
                     <button
                        key={tab.id}
                        onClick={() => setActiveView(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeView === tab.id ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                         <tab.icon size={16} />
                         <span className="hidden md:inline">{tab.label}</span>
                         {tab.count && tab.count > 0 ? <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{tab.count}</span> : null}
                     </button>
                 ))}
             </div>
         )}
      </div>

      {/* DASHBOARD (Counselor Home) */}
      {!isDirectoryMode && activeView === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-purple-100 shadow-sm flex items-center justify-between">
                      <div>
                          <p className="text-slate-500 text-xs font-bold uppercase mb-1">جلسات اليوم</p>
                          <h3 className="text-3xl font-extrabold text-purple-700">{dailySessions.length}</h3>
                      </div>
                      <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center"><ClipboardList size={24}/></div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm flex items-center justify-between">
                      <div>
                          <p className="text-slate-500 text-xs font-bold uppercase mb-1">إحالات جديدة</p>
                          <h3 className="text-3xl font-extrabold text-blue-700">{referrals.filter(r => r.status === 'pending').length}</h3>
                      </div>
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center"><Inbox size={24}/></div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-red-100 shadow-sm flex items-center justify-between">
                      <div>
                          <p className="text-slate-500 text-xs font-bold uppercase mb-1">مؤشرات الخطر</p>
                          <h3 className="text-3xl font-extrabold text-red-700">{riskList.length}</h3>
                      </div>
                      <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center"><ShieldAlert size={24}/></div>
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Risk Analysis Card */}
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                      <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-center">
                          <h3 className="font-bold text-red-800 flex items-center gap-2"><ShieldAlert size={18}/> مؤشر الخطر (الغياب المتصل)</h3>
                          <span className="bg-white text-red-600 px-3 py-1 rounded-full text-xs font-bold border border-red-100">{riskList.length} طلاب</span>
                      </div>
                      <div className="p-4 flex-1 overflow-y-auto max-h-[300px]">
                          {riskList.length === 0 ? (
                              <div className="text-center py-10 text-slate-400">
                                  <CheckCircle size={40} className="mx-auto mb-2 text-emerald-400"/>
                                  <p>لا يوجد طلاب في دائرة الخطر حالياً.</p>
                              </div>
                          ) : (
                              <div className="space-y-3">
                                  {riskList.map((risk, idx) => (
                                      <div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl hover:border-red-200 transition-colors shadow-sm">
                                          <div className="flex items-center gap-3">
                                              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm">{risk.studentName.charAt(0)}</div>
                                              <div>
                                                  <h4 className="font-bold text-slate-800 text-sm">{risk.studentName}</h4>
                                                  <p className="text-xs text-slate-500">آخر غياب: {risk.lastDate}</p>
                                              </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                              <div className="text-right mr-2">
                                                  <span className="block text-red-600 font-extrabold text-lg">{risk.days}</span>
                                                  <span className="text-[10px] text-slate-400">أيام متصلة</span>
                                              </div>
                                              <button onClick={() => { const s = students.find(x => x.studentId === risk.studentId); if(s) { handleOpenStudent(s, 'sessions'); setShowSessionForm(true); } }} className="text-xs bg-red-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-red-700">متابعة</button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="space-y-4">
                      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10"></div>
                          <h3 className="text-xl font-bold mb-2">جلسة إرشادية جديدة</h3>
                          <p className="text-purple-100 text-sm mb-6 max-w-xs">توثيق جلسة فورية لطالب، سواء كانت فردية أو جماعية.</p>
                          <button onClick={openSessionStudentSelector} className="bg-white text-purple-700 px-6 py-3 rounded-xl font-bold shadow-md hover:bg-purple-50 transition-colors flex items-center gap-2">
                              <Plus size={18}/> بدء جلسة الآن
                          </button>
                      </div>

                      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Inbox size={18} className="text-blue-600"/> آخر الإحالات</h3>
                          {referrals.filter(r => r.status === 'pending').length === 0 ? (
                              <p className="text-slate-400 text-sm text-center py-4">لا توجد إحالات جديدة معلقة.</p>
                          ) : (
                              <div className="space-y-3">
                                  {referrals.filter(r => r.status === 'pending').slice(0, 2).map(ref => (
                                      <div key={ref.id} className="flex justify-between items-center p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                                          <div>
                                              <p className="font-bold text-slate-800 text-sm">{ref.studentName}</p>
                                              <p className="text-xs text-slate-500 truncate max-w-[150px]">{ref.reason}</p>
                                          </div>
                                          <button onClick={() => setActiveView('inbox')} className="text-xs bg-white text-blue-600 px-3 py-1.5 rounded-lg border border-blue-200 font-bold hover:bg-blue-50">معاينة</button>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* VIEW: SESSIONS LOG */}
      {!isDirectoryMode && activeView === 'sessions' && (
          <div className="animate-fade-in max-w-4xl mx-auto space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ClipboardList className="text-emerald-600"/> سجل الجلسات الإرشادية</h2>
                  <div className="flex gap-2 items-center flex-wrap">
                      <button onClick={openSessionStudentSelector} className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-2 text-sm font-bold">
                          <Plus size={16} /> تسجيل جلسة
                      </button>
                      <div className="flex gap-2 items-center bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                          <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-700 outline-none" />
                          <button onClick={handlePrintReport} className="bg-slate-700 text-white p-2 rounded-lg hover:bg-slate-800 transition-colors shadow-sm" title="طباعة التقرير">
                              <Printer size={16} />
                          </button>
                      </div>
                  </div>
              </div>

              {sessions.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                      <Users size={48} className="mx-auto mb-4 opacity-50" />
                      <p>لا يوجد جلسات مسجلة.</p>
                  </div>
              ) : (
                  <div className="grid gap-4">
                    {sessions.map(s => (
                        <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                            <div className={`absolute top-0 right-0 w-1.5 h-full ${s.sessionType === 'individual' ? 'bg-purple-500' : s.sessionType === 'group' ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
                            <div className="flex justify-between items-start mb-3 pl-2 pr-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200">
                                        {s.studentName.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 text-base">{s.studentName}</h4>
                                        <p className="text-xs text-slate-500 font-mono">{s.date}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-600">
                                    {s.sessionType === 'individual' ? 'فردية' : s.sessionType === 'group' ? 'جماعية' : 'ولي أمر'}
                                </span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm space-y-2 mr-3">
                                <p className="text-slate-800"><span className="font-bold text-slate-500">الموضوع:</span> {s.topic}</p>
                                <p className="text-slate-600 border-t border-slate-200 pt-2 mt-2"><span className="font-bold text-slate-500">التوصيات:</span> {s.recommendations}</p>
                            </div>
                        </div>
                    ))}
                  </div>
              )}
          </div>
      )}

      {/* VIEW: INBOX */}
      {!isDirectoryMode && activeView === 'inbox' && (
          <div className="animate-fade-in max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Inbox className="text-blue-600"/> صندوق الإحالات الواردة</h2>
                  <button onClick={fetchData} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><RefreshCw size={16}/></button>
              </div>
              
              {referrals.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                      <Check size={48} className="mx-auto mb-4 opacity-50"/>
                      <p>صندوق الوارد فارغ. ممتاز!</p>
                  </div>
              ) : (
                  <div className="space-y-6">
                      {referrals.map(ref => (
                          <div key={ref.id} className={`bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden ${ref.status === 'pending' ? 'border-blue-200 ring-4 ring-blue-50' : 'border-slate-200'}`}>
                              {ref.status === 'pending' && <div className="absolute top-0 left-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-br-xl">طلب جديد</div>}
                              {ref.status === 'in_progress' && <div className="absolute top-0 left-0 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-br-xl">قيد المعالجة</div>}
                              
                              <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                                  <div className="flex items-center gap-4">
                                      <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center font-bold text-lg border border-blue-100">
                                          {ref.studentName.charAt(0)}
                                      </div>
                                      <div>
                                          <h3 className="font-bold text-xl text-slate-900">{ref.studentName}</h3>
                                          <p className="text-sm text-slate-500 flex items-center gap-1 mt-1"><School size={12}/> {ref.grade} - {ref.className}</p>
                                      </div>
                                  </div>
                                  <div className="text-left bg-slate-50 p-2 rounded-lg border border-slate-100">
                                      <span className="text-xs font-bold text-slate-400 block mb-1 uppercase">تاريخ الإحالة</span>
                                      <span className="font-mono text-slate-700 font-bold">{ref.referralDate}</span>
                                  </div>
                              </div>

                              <div className="bg-slate-50 p-4 rounded-xl border-l-4 border-l-blue-500 text-sm mb-6 shadow-inner">
                                  <p className="text-slate-500 text-xs font-bold uppercase mb-1">سبب الإحالة (من الوكيل/الإدارة):</p>
                                  <p className="text-slate-800 font-medium leading-relaxed text-base">{ref.reason}</p>
                                  {ref.notes && <p className="text-slate-600 mt-2 text-xs pt-2 border-t border-slate-200">{ref.notes}</p>}
                              </div>
                              
                              <div className="flex flex-col gap-3 pt-2">
                                  {ref.status === 'pending' ? (
                                      <button onClick={() => handleAcceptReferral(ref.id)} className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
                                          <CheckCircle size={18}/> قبول الحالة وبدء المعالجة
                                      </button>
                                  ) : (
                                      <div className="w-full space-y-4 border-t border-slate-100 pt-4">
                                          {referralReplyMode === ref.id ? (
                                              <div className="bg-purple-50 p-5 rounded-xl border border-purple-200 animate-fade-in shadow-sm">
                                                  <h4 className="font-bold text-purple-900 mb-3 flex items-center gap-2"><Send size={16}/> تقرير المعالجة للوكيل</h4>
                                                  <label className="text-xs text-purple-700 mb-2 block font-bold">المرئيات / الإجراءات المتخذة / التوصيات:</label>
                                                  <textarea 
                                                      className="w-full p-4 border border-purple-200 rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[120px] bg-white" 
                                                      placeholder="اكتب تقريرك هنا ليتم إعادته للوكيل لاتخاذ القرار النهائي..."
                                                      value={referralOutcome}
                                                      onChange={e => setReferralOutcome(e.target.value)}
                                                  ></textarea>
                                                  <div className="flex gap-3 justify-end">
                                                      <button onClick={() => setReferralReplyMode(null)} className="px-5 py-2.5 bg-white text-slate-600 rounded-xl text-sm font-bold border border-slate-200 hover:bg-slate-50">إلغاء</button>
                                                      <button onClick={() => handleReturnReferral(ref.id)} className="px-5 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 flex items-center gap-2 shadow-md"><Check size={16}/> إرسال وإنهاء</button>
                                                  </div>
                                              </div>
                                          ) : (
                                              <div className="flex gap-3">
                                                  <button onClick={() => { const s = students.find(x => x.studentId === ref.studentId); if(s) handleOpenStudent(s); }} className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl text-sm font-bold hover:bg-slate-50 flex items-center justify-center gap-2 shadow-sm"><FileText size={18}/> فتح ملف الطالب</button>
                                                  <button onClick={() => setReferralReplyMode(ref.id)} className="flex-1 bg-purple-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-purple-700 flex items-center justify-center gap-2 shadow-md shadow-purple-200"><ArrowRight size={18}/> إرسال التقرير للوكيل</button>
                                              </div>
                                          )}
                                      </div>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {/* VIEW: DIRECTORY / STUDENTS LIST */}
      {(activeView === 'directory') && (
         <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-3 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="بحث بالاسم، الهوية، أو الهاتف..." className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-sm font-medium focus:ring-2 focus:ring-purple-100" />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <select value={filterGrade} onChange={e => { setFilterGrade(e.target.value); setFilterClass(''); }} className="bg-slate-50 border border-slate-200 py-2.5 px-4 rounded-xl text-sm font-bold text-slate-700 focus:outline-none">
                            <option value="">كل الصفوف</option>
                            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} disabled={!filterGrade} className="bg-slate-50 border border-slate-200 py-2.5 px-4 rounded-xl text-sm font-bold text-slate-700 focus:outline-none disabled:opacity-50">
                            <option value="">{filterGrade ? 'كل الفصول' : '-'}</option>
                            {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
              </div>
              
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[600px] overflow-y-auto custom-scrollbar">
                  {filteredStudents.length > 0 ? (
                      <div className="divide-y divide-slate-50">
                          {filteredStudents.map(student => (
                              <div key={student.id} className="flex items-center px-6 py-4 hover:bg-purple-50/50 transition-colors group">
                                  <div className="flex-1 flex items-center gap-4 min-w-0">
                                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-base shrink-0 border border-slate-200 group-hover:bg-purple-100 group-hover:text-purple-700 group-hover:border-purple-200 transition-colors">
                                          {student.name.charAt(0)}
                                      </div>
                                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleOpenStudent(student)}>
                                          <p className="font-bold text-slate-800 text-base truncate mb-1 group-hover:text-purple-800 transition-colors">{student.name}</p>
                                          <div className="flex flex-wrap items-center gap-3 text-xs">
                                              <span className="flex items-center gap-1 font-mono text-slate-500 dir-ltr bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                                  {student.phone || '---'} <Smartphone size={12} />
                                              </span>
                                              <span className="flex items-center gap-1 text-slate-500">
                                                  <School size={12} /> {student.grade} - {student.className}
                                              </span>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                      {student.phone && (
                                          <>
                                          <button onClick={() => copyToClipboard(student.phone)} className="w-9 h-9 flex items-center justify-center rounded-xl border bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600" title="نسخ">
                                              <Copy size={16}/>
                                          </button>
                                          <a href={`tel:${student.phone}`} className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100" title="اتصال">
                                              <Phone size={16} />
                                          </a>
                                          <button onClick={() => openWhatsApp(student.phone)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100" title="واتساب">
                                              <MessageCircle size={16} />
                                          </button>
                                          </>
                                      )}
                                      
                                      {/* Only show 'Profile' button if Counselor or Admin */}
                                      {!isDirectoryMode && (
                                          <button onClick={() => handleOpenStudent(student)} className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl shadow-md hover:bg-purple-700 transition-colors flex items-center gap-2">
                                              <FileText size={14}/> الملف
                                          </button>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400">
                          <Search size={48} className="opacity-20 mb-4" />
                          <p>لا توجد نتائج مطابقة</p>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* STUDENT SELECTOR MODAL FOR SESSION */}
      {isSelectingStudentForSession && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 text-lg">اختيار الطالب لجلسة جديدة</h3>
                    <button onClick={() => setIsSelectingStudentForSession(false)} className="p-2 rounded-full hover:bg-slate-200"><X size={20}/></button>
                </div>
                
                {/* Filters for Session Selection */}
                <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
                    <div className="flex gap-3">
                        <select value={filterGrade} onChange={e => { setFilterGrade(e.target.value); setFilterClass(''); }} className="w-1/2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none">
                            <option value="">كل الصفوف</option>
                            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} disabled={!filterGrade} className="w-1/2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none disabled:opacity-50">
                            <option value="">{filterGrade ? 'كل الفصول' : '-'}</option>
                            {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="relative">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input 
                            autoFocus
                            placeholder="ابحث بالاسم..." 
                            className="w-full pr-12 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-100 transition-all font-bold text-slate-800"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    {filteredStudents.length > 0 ? (
                        filteredStudents.map(s => (
                            <button key={s.id} onClick={() => {
                                handleOpenStudent(s, 'sessions'); 
                                setShowSessionForm(true); 
                                setIsSelectingStudentForSession(false);
                            }} className="w-full text-right flex items-center gap-4 p-4 hover:bg-purple-50 rounded-2xl transition-colors border-b border-slate-50 last:border-0 group">
                                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm group-hover:bg-white group-hover:text-purple-600 group-hover:shadow-sm transition-all">
                                    {s.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm group-hover:text-purple-900">{s.name}</p>
                                    <p className="text-xs text-slate-500">{s.grade} - {s.className}</p>
                                </div>
                                <ArrowLeft className="mr-auto text-slate-300 group-hover:text-purple-400" size={18}/>
                            </button>
                        ))
                    ) : (
                        <div className="text-center py-12 text-slate-400">
                            <p>لا توجد نتائج</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* STUDENT MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all animate-fade-in">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden relative">
              
              {/* Modal Header */}
              <div className="p-6 bg-slate-900 text-white flex justify-between items-start shrink-0">
                  <div className="flex items-center gap-5">
                      <div className="w-16 h-16 rounded-2xl bg-white/10 text-white flex items-center justify-center text-3xl font-bold border border-white/20 shadow-inner">{selectedStudent.name.charAt(0)}</div>
                      <div>
                          <h2 className="text-2xl font-bold">{selectedStudent.name}</h2>
                          <div className="flex items-center gap-3 text-slate-300 text-sm mt-2">
                              <span className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-lg"><School size={14}/> {selectedStudent.grade} - {selectedStudent.className}</span>
                              <span className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-lg font-mono"><Smartphone size={14}/> {selectedStudent.phone || 'N/A'}</span>
                          </div>
                      </div>
                  </div>
                  <button onClick={() => setSelectedStudent(null)} className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><X size={24} /></button>
              </div>
              
              {/* Tabs */}
              <div className="flex border-b border-slate-100 px-6 pt-4 gap-6 shrink-0 bg-white overflow-x-auto whitespace-nowrap scrollbar-hide">
                  <button onClick={() => setActiveTab('info')} className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'info' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><UserPlus size={16}/> بيانات التواصل</button>
                  
                  {!isDirectoryMode && (
                      <>
                        <button onClick={() => setActiveTab('history')} className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Clock size={16}/> سجل الغياب</button>
                        <button onClick={() => setActiveTab('behavior')} className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'behavior' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><ShieldAlert size={16}/> السلوك والمخالفات</button>
                        <button onClick={() => setActiveTab('tracking')} className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'tracking' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Activity size={16}/> تتبع الحالة</button>
                        <button onClick={() => setActiveTab('sessions')} className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'sessions' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><ClipboardList size={16}/> الجلسات الإرشادية</button>
                        <button onClick={() => setActiveTab('observations')} className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'observations' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Eye size={16}/> الملاحظات</button>
                      </>
                  )}
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
                  
                  {/* CONTACT INFO TAB */}
                  {activeTab === 'info' && (
                      <div className="text-center space-y-8 py-8 animate-fade-in">
                          {selectedStudent.phone ? (
                              <>
                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm inline-block">
                                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=tel:${selectedStudent.phone}`} alt="Phone QR" className="w-40 h-40 object-contain mix-blend-multiply"/>
                                    <p className="text-xs text-slate-400 mt-4 font-bold uppercase tracking-wider">امسح للاتصال السريع</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                                    <button onClick={() => window.location.href=`tel:${selectedStudent.phone}`} className="flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 active:scale-95 transition-all"><Phone size={20}/> اتصال هاتفي</button>
                                    <button onClick={() => openWhatsApp(selectedStudent.phone)} className="flex items-center justify-center gap-2 bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"><MessageCircle size={20}/> واتساب</button>
                                </div>
                              </>
                          ) : (
                              <div className="text-slate-400 py-10">
                                  <Smartphone size={64} className="mx-auto mb-4 opacity-20"/>
                                  <p className="text-lg font-medium">لا يوجد رقم هاتف مسجل لهذا الطالب.</p>
                              </div>
                          )}
                      </div>
                  )}

                  {/* ATTENDANCE HISTORY TAB */}
                  {!isDirectoryMode && activeTab === 'history' && (
                      <div className="space-y-6 animate-fade-in">
                          {!loadingDetails && (
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-white p-5 rounded-2xl border border-red-100 flex items-center justify-between shadow-sm">
                                      <div>
                                          <p className="text-xs font-bold text-red-400 uppercase">أيام الغياب</p>
                                          <p className="text-3xl font-extrabold text-red-700 mt-1">{studentHistory.filter(h => h.status === 'ABSENT').length}</p>
                                      </div>
                                      <div className="bg-red-50 p-3 rounded-xl text-red-500"><TrendingDown size={24}/></div>
                                  </div>
                                  <div className="bg-white p-5 rounded-2xl border border-amber-100 flex items-center justify-between shadow-sm">
                                      <div>
                                          <p className="text-xs font-bold text-amber-400 uppercase">مرات التأخر</p>
                                          <p className="text-3xl font-extrabold text-amber-700 mt-1">{studentHistory.filter(h => h.status === 'LATE').length}</p>
                                      </div>
                                      <div className="bg-amber-50 p-3 rounded-xl text-amber-500"><Clock size={24}/></div>
                                  </div>
                              </div>
                          )}

                          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200"><h3 className="font-bold text-slate-800 text-sm">سجل الحضور التفصيلي</h3></div>
                            {loadingDetails ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-purple-600"/></div> : studentHistory.length === 0 ? (
                                <div className="text-center py-12">
                                    <CheckCircle size={40} className="text-emerald-500 mx-auto mb-3"/>
                                    <p className="text-slate-500 font-medium">سجل الطالب نظيف! لا يوجد غياب.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {studentHistory.map((h, i) => (
                                        <div key={i} className="flex justify-between items-center p-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-lg ${h.status === 'ABSENT' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                                    {h.status === 'ABSENT' ? <AlertCircle size={18}/> : <Clock size={18}/>}
                                                </div>
                                                <span className="font-mono text-slate-600 font-bold text-sm">{h.date}</span>
                                            </div>
                                            <span className={`px-3 py-1 rounded-lg text-xs font-bold ${h.status === 'ABSENT' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {h.status === 'ABSENT' ? 'غائب' : 'متأخر'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                          </div>
                      </div>
                  )}

                  {/* TRACKING TAB (CASE HISTORY) */}
                  {!isDirectoryMode && activeTab === 'tracking' && (
                      <div className="space-y-6 animate-fade-in">
                          {studentReferrals.length === 0 ? (
                              <div className="text-center py-16 bg-white rounded-3xl border border-slate-200">
                                  <UserCheck size={48} className="text-slate-200 mx-auto mb-4"/>
                                  <p className="text-slate-400">لا توجد حالات إحالة مسجلة للطالب.</p>
                              </div>
                          ) : (
                              <div className="space-y-4">
                                  {studentReferrals.map((ref, idx) => (
                                      <div key={ref.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                                          {/* Timeline Line */}
                                          {idx < studentReferrals.length - 1 && (
                                              <div className="absolute top-10 bottom-0 right-[29px] w-0.5 bg-slate-100 -z-10"></div>
                                          )}
                                          
                                          <div className="flex justify-between items-start mb-3">
                                              <div className="flex items-center gap-3">
                                                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                                                      <GitCommit size={18} />
                                                  </div>
                                                  <div>
                                                      <span className="text-xs text-slate-400 font-mono block mb-0.5">{ref.referralDate}</span>
                                                      {getReferralStatusBadge(ref.status)}
                                                  </div>
                                              </div>
                                              <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                                  بواسطة: {ref.referredBy === 'deputy' ? 'الوكيل' : 'الإدارة'}
                                              </span>
                                          </div>
                                          
                                          <div className="mr-12 space-y-3">
                                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">سبب الإحالة</p>
                                                  <p className="text-sm text-slate-800">{ref.reason}</p>
                                              </div>
                                              
                                              {ref.outcome && (
                                                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                                                      <p className="text-xs font-bold text-emerald-600 uppercase mb-1 flex items-center gap-1"><CheckCircle size={10}/> الإجراء المتخذ / النتيجة</p>
                                                      <p className="text-sm text-slate-800">{ref.outcome}</p>
                                                  </div>
                                              )}
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  )}

                  {/* BEHAVIOR TAB (NEW) */}
                  {!isDirectoryMode && activeTab === 'behavior' && (
                      <div className="space-y-6 animate-fade-in">
                          {studentBehaviors.length === 0 ? (
                              <div className="text-center py-16 bg-white rounded-3xl border border-slate-200">
                                  <ShieldAlert size={48} className="text-emerald-200 mx-auto mb-4"/>
                                  <h3 className="text-lg font-bold text-emerald-700">سجل سلوكي ممتاز!</h3>
                                  <p className="text-slate-400 mt-2">لا توجد أي مخالفات مسجلة على الطالب.</p>
                              </div>
                          ) : (
                              studentBehaviors.map(rec => (
                                  <div key={rec.id} className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm relative overflow-hidden">
                                      <div className="absolute top-0 right-0 w-1.5 h-full bg-red-500"></div>
                                      <div className="flex justify-between items-start mb-3 pl-4">
                                          <div>
                                              <span className="text-[10px] bg-red-50 text-red-700 px-2 py-1 rounded font-bold border border-red-100 uppercase tracking-wider">{rec.violationDegree}</span>
                                              <h4 className="font-bold text-slate-800 mt-2 text-lg">{rec.violationName}</h4>
                                          </div>
                                          <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">{rec.date}</span>
                                      </div>
                                      <div className="bg-slate-50 p-3 rounded-xl text-sm border border-slate-100">
                                          <span className="font-bold text-slate-500 block mb-1">الإجراء المتخذ:</span>
                                          <p className="text-slate-800">{rec.actionTaken}</p>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  )}

                  {/* GUIDANCE SESSIONS TAB */}
                  {!isDirectoryMode && activeTab === 'sessions' && (
                      <div className="space-y-6 animate-fade-in">
                          <button onClick={() => setShowSessionForm(!showSessionForm)} className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-purple-600/20 hover:bg-purple-700 transition-all flex items-center justify-center gap-2">
                              {showSessionForm ? <X size={20}/> : <Plus size={20}/>} {showSessionForm ? 'إلغاء' : 'تسجيل جلسة جديدة'}
                          </button>
                          
                          {showSessionForm && (
                              <div className="bg-white p-6 rounded-3xl border-2 border-purple-100 shadow-lg animate-fade-in-up relative">
                                  <button onClick={handleGeneratePlan} disabled={isGeneratingPlan} className="absolute top-6 left-6 text-xs bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-100 flex items-center gap-2 font-bold">
                                      {isGeneratingPlan ? <Loader2 className="animate-spin" size={14}/> : <Sparkles size={14}/>} دراسة حالة آلية
                                  </button>
                                  <h3 className="font-bold text-purple-900 mb-4 flex items-center gap-2"><ClipboardList size={20}/> تفاصيل الجلسة</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                      <div>
                                          <label className="text-xs font-bold text-slate-500 uppercase block mb-2">نوع الجلسة</label>
                                          <select value={sessionType} onChange={e => setSessionType(e.target.value as any)} className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-purple-500 bg-slate-50">
                                              <option value="individual">جلسة فردية</option>
                                              <option value="group">جلسة جماعية</option>
                                              <option value="parent_meeting">لقاء ولي أمر</option>
                                          </select>
                                      </div>
                                      <div>
                                          <label className="text-xs font-bold text-slate-500 uppercase block mb-2">الموضوع</label>
                                          <input value={sessionTopic} onChange={e => setSessionTopic(e.target.value)} placeholder="مثال: تأخر، سلوك، تحسن..." className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-purple-500 bg-slate-50"/>
                                      </div>
                                  </div>
                                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">النتائج والتوصيات</label>
                                  <textarea value={sessionRecs} onChange={e => setSessionRecs(e.target.value)} placeholder="سجل هنا تفاصيل الجلسة والاتفاق مع الطالب..." className="w-full p-4 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-purple-500 bg-slate-50 min-h-[120px] mb-4"></textarea>
                                  <button onClick={handleSaveSession} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 shadow-md transition-all">حفظ في السجل</button>
                              </div>
                          )}

                          <div className="space-y-4">
                              <h3 className="font-bold text-slate-400 text-xs uppercase tracking-wider pl-2">سجل الجلسات السابق</h3>
                              {sessions.filter(s => s.studentId === selectedStudent.studentId).length === 0 ? (
                                  <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-3xl">
                                      <p className="text-slate-400 font-medium">لم يتم تسجيل أي جلسات سابقة.</p>
                                  </div>
                              ) : (
                                  sessions.filter(s => s.studentId === selectedStudent.studentId).map(s => (
                                      <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                                          <div className={`absolute top-0 right-0 w-1.5 h-full ${s.sessionType === 'individual' ? 'bg-blue-500' : s.sessionType === 'group' ? 'bg-purple-500' : 'bg-orange-500'}`}></div>
                                          <div className="flex justify-between items-start mb-3 pl-2 pr-4">
                                              <div>
                                                  <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${s.sessionType === 'individual' ? 'bg-blue-50 text-blue-600' : s.sessionType === 'group' ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'}`}>
                                                      {s.sessionType === 'individual' ? 'فردية' : s.sessionType === 'group' ? 'جماعية' : 'ولي أمر'}
                                                  </span>
                                                  <h4 className="font-bold text-slate-800 mt-2 text-base">{s.topic}</h4>
                                              </div>
                                              <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">{s.date}</span>
                                          </div>
                                          <div className="bg-slate-50 p-3 rounded-xl text-sm border border-slate-100 mr-3">
                                              <p className="text-slate-700 leading-relaxed">{s.recommendations || "لا توجد تفاصيل إضافية."}</p>
                                          </div>
                                      </div>
                                  ))
                              )}
                          </div>
                      </div>
                  )}

                  {/* OBSERVATIONS TAB */}
                  {!isDirectoryMode && activeTab === 'observations' && (
                      <div className="space-y-4 animate-fade-in">
                          {studentObservations.length === 0 ? (
                              <div className="text-center py-16 bg-white rounded-3xl border border-slate-200">
                                  <FileText size={48} className="text-slate-200 mx-auto mb-4"/>
                                  <p className="text-slate-400">لا توجد ملاحظات من المعلمين.</p>
                              </div>
                          ) : (
                              studentObservations.map(obs => (
                                  <div key={obs.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                      <div className="flex justify-between items-center mb-3">
                                          <div className="flex items-center gap-2">
                                               <span className={`text-[10px] font-bold px-2 py-1 rounded ${obs.type === 'positive' ? 'bg-emerald-100 text-emerald-700' : obs.type === 'behavioral' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                                  {obs.type === 'positive' ? 'تعزيز' : obs.type === 'behavioral' ? 'سلوك' : 'عام'}
                                              </span>
                                              <span className="text-xs text-slate-500 font-bold">{obs.staffName}</span>
                                          </div>
                                          <span className="text-xs font-mono text-slate-400">{obs.date}</span>
                                      </div>
                                      <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl">{obs.content}</p>
                                  </div>
                              ))
                          )}
                      </div>
                  )}
              </div>
           </div>
        </div>
      )}
    </div>
    </>
  );
};

export default StaffStudents;
