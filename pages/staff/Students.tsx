
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Users, Search, Phone, User, MapPin, School, CheckCircle, 
  ShieldAlert, Printer, Plus, Inbox, FileText, LayoutGrid, 
  BookOpen, MessageSquare, AlertTriangle, Calendar, Loader2,
  Clock, Activity, ClipboardList, Send, Check, X, Edit, Trash2,
  Archive, HeartHandshake, Filter, ArrowLeft, Copy, MessageCircle, Sparkles, BrainCircuit, FileSignature
} from 'lucide-react';
import { 
  getStudents, getReferrals, getGuidanceSessions, getConsecutiveAbsences,
  getStudentAttendanceHistory, getBehaviorRecords, getStudentObservations,
  addGuidanceSession, updateGuidanceSession, deleteGuidanceSession,
  updateReferralStatus, resolveAbsenceAlert, generateGuidancePlan, generateSmartContent
} from '../../services/storage';
import { Student, StaffUser, Referral, GuidanceSession, AttendanceStatus, BehaviorRecord, StudentObservation } from '../../types';
import { GRADES } from '../../constants';

// Official Print Header
const OfficialCounselorHeader = ({ title, date }: { title: string, date: string }) => (
    <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
        <div className="text-right font-bold text-sm space-y-1">
            <p>المملكة العربية السعودية</p>
            <p>وزارة التعليم</p>
            <p>إدارة التوجيه الطلابي</p>
        </div>
        <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">{title}</h1>
            <p className="text-lg">التاريخ: {date}</p>
        </div>
        <div className="text-left font-bold text-sm">
            <p>Ministry of Education</p>
            <p>Student Counseling</p>
            <p>{new Date().toLocaleDateString('en-GB')}</p>
        </div>
    </div>
);

const StaffStudents: React.FC = () => {
  const location = useLocation();
  const isDirectoryMode = location.pathname.includes('directory');
  
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [sessions, setSessions] = useState<GuidanceSession[]>([]);
  const [activeRiskList, setActiveRiskList] = useState<any[]>([]);
  
  const [activeView, setActiveView] = useState<'dashboard' | 'directory' | 'inbox' | 'sessions'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [loading, setLoading] = useState(true);

  // Student Detail Modal State
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [modalTab, setModalTab] = useState<'info'|'history'|'behavior'|'observations'|'sessions'|'ai_analysis'>('info');
  const [studentDetails, setStudentDetails] = useState<{
      history: { date: string, status: AttendanceStatus }[],
      behavior: BehaviorRecord[],
      observations: StudentObservation[]
  }>({ history: [], behavior: [], observations: [] });
  const [loadingDetails, setLoadingDetails] = useState(false);

  // AI Analysis State
  const [aiOverview, setAiOverview] = useState('');
  const [isGeneratingOverview, setIsGeneratingOverview] = useState(false);

  // Session Form State
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [editingSession, setEditingSession] = useState<GuidanceSession | null>(null);
  const [sessionTopic, setSessionTopic] = useState('');
  const [sessionRecs, setSessionRecs] = useState('');
  const [sessionType, setSessionType] = useState<'individual' | 'group' | 'parent_meeting'>('individual');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  // Printing State
  const [printMode, setPrintMode] = useState<'none' | 'student_overview'>('none');

  // Referral Action State
  const [processingReferralId, setProcessingReferralId] = useState<string | null>(null);
  const [referralOutcome, setReferralOutcome] = useState('');

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

  const handleOpenStudent = async (student: Student) => {
      setSelectedStudent(student);
      setModalTab('info');
      setAiOverview(''); // Reset AI text
      setLoadingDetails(true);
      try {
          const [h, b, o] = await Promise.all([
              getStudentAttendanceHistory(student.studentId, student.grade, student.className),
              getBehaviorRecords(student.studentId),
              getStudentObservations(student.studentId)
          ]);
          setStudentDetails({ history: h, behavior: b, observations: o });
      } catch(e) { console.error(e); }
      finally { setLoadingDetails(false); }
  };

  const handleGenerateOverview = async () => {
      if(!selectedStudent) return;
      setIsGeneratingOverview(true);
      try {
          const absents = studentDetails.history.filter(h=>h.status==='ABSENT').length;
          const lates = studentDetails.history.filter(h=>h.status==='LATE').length;
          const violations = studentDetails.behavior.map(b=>b.violationName).join(' - ');
          
          // Separate Observations
          const positiveObs = studentDetails.observations
              .filter(o => o.type === 'positive')
              .map(o => o.content)
              .join(' - ');
          
          const generalObs = studentDetails.observations
              .filter(o => o.type !== 'positive')
              .map(o => o.content)
              .join(' - ');

          const prompt = `
            بصفتك مستشاراً تربويًا وموجه طلابي خبير، قم بإعداد "تقرير حالة تربوي وتوجيهي" رسمي ومفصل للطالب: ${selectedStudent.name} (${selectedStudent.grade}).
            
            تحليل البيانات المتوفرة في السجل:
            1. الانضباط والحضور: (غياب: ${absents} أيام، تأخر: ${lates} مرات).
            2. نقاط التميز والسلوك الإيجابي: ${positiveObs || 'لا يوجد سجلات تميز مسجلة حالياً'}.
            3. المخالفات السلوكية: ${violations || 'سجل نظيف من المخالفات'}.
            4. ملاحظات المعلمين الأخرى: ${generalObs || 'لا يوجد'}.

            المطلوب في التقرير (موجه لولي الأمر وإدارة المدرسة):
            - مقدمة تربوية مهنية.
            - إبراز "نقاط القوة والتميز" لدى الطالب أولاً بناءً على السلوك الإيجابي (عزز هذا الجانب).
            - توضيح "الجوانب التي تحتاج إلى تحسين" (الغياب أو المخالفات إن وجدت) بأسلوب تربوي ناصح.
            - خطة توجيهية وتوصيات عملية لولي الأمر للمتابعة.
            - خاتمة إيجابية ومشجعة.
            
            الصياغة: رسمية، مهنية، ومتوازنة بين التحفيز والتوجيه.
          `;
          
          const result = await generateSmartContent(prompt);
          setAiOverview(result);
      } catch(e) { alert("حدث خطأ أثناء التوليد"); }
      finally { setIsGeneratingOverview(false); }
  };

  const handlePrintOverview = () => {
      setPrintMode('student_overview');
      setTimeout(() => { window.print(); setPrintMode('none'); }, 300);
  };

  const handleGeneratePlan = async () => {
      if(!selectedStudent) return;
      setIsGeneratingPlan(true);
      try {
          const summary = `غياب: ${studentDetails.history.filter(h=>h.status==='ABSENT').length} أيام. مخالفات: ${studentDetails.behavior.map(b=>b.violationName).join(', ')}.`;
          const plan = await generateGuidancePlan(selectedStudent.name, summary);
          setSessionRecs(plan);
      } catch(e) { alert("فشل التوليد"); }
      finally { setIsGeneratingPlan(false); }
  };

  const handleSaveSession = async () => {
      if (!selectedStudent || !sessionTopic) return;
      try {
          if (editingSession) {
              await updateGuidanceSession({
                  ...editingSession,
                  topic: sessionTopic,
                  recommendations: sessionRecs,
                  sessionType: sessionType
              });
          } else {
              await addGuidanceSession({
                  id: '', studentId: selectedStudent.studentId, studentName: selectedStudent.name,
                  date: new Date().toISOString().split('T')[0], sessionType: sessionType, topic: sessionTopic, recommendations: sessionRecs, status: 'completed'
              });
          }
          setShowSessionForm(false); 
          setEditingSession(null);
          setSessionTopic(''); setSessionRecs('');
          fetchData(); 
          alert("تم حفظ الجلسة.");
      } catch (e) { alert("حدث خطأ."); }
  };

  const handleReturnReferral = async (id: string) => {
      if (!referralOutcome.trim()) return alert("اكتب الإجراء المتخذ.");
      await updateReferralStatus(id, 'returned_to_deputy', referralOutcome);
      setProcessingReferralId(null);
      setReferralOutcome('');
      fetchData();
      alert("تمت الإفادة وإغلاق الإحالة.");
  };

  // Helper to format phone for display and QR
  const formatPhone = (phone: string) => {
      if (!phone) return '';
      // Replace 966, +966, 00966 with 0
      return phone.replace(/^(966|\+966|00966)/, '0');
  };

  // Derived Data
  const dailySessions = useMemo(() => sessions.filter(s => s.date === today), [sessions, today]);
  const pendingReferrals = useMemo(() => referrals.filter(r => r.status === 'pending'), [referrals]);
  const activeReferrals = useMemo(() => referrals.filter(r => ['pending', 'in_progress'].includes(r.status)), [referrals]);
  
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
        const matchesSearch = s.name.includes(searchTerm) || s.studentId.includes(searchTerm) || s.phone.includes(searchTerm);
        const matchesGrade = filterGrade ? s.grade === filterGrade : true;
        return matchesSearch && matchesGrade;
    });
  }, [students, searchTerm, filterGrade]);

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); alert('تم نسخ الرقم'); };
  const openWhatsApp = (phone: string) => {
    let clean = phone.replace(/\D/g, '');
    if(clean.startsWith('05')) clean = '966' + clean.substring(1);
    window.open(`https://wa.me/${clean}`, '_blank');
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-purple-600"/></div>;

  return (
    <div className="space-y-6 pb-20 animate-fade-in relative">
        
        {/* Print Area */}
        <div id="print-area" className="hidden" dir="rtl">
            {printMode === 'student_overview' && selectedStudent && (
                <div className="print-page-a4">
                    <OfficialCounselorHeader title="تقرير تربوي وتوجيهي شامل" date={new Date().toLocaleDateString('ar-SA')} />
                    
                    <div className="mb-6 border-b-2 border-black pb-4">
                        <h2 className="text-xl font-bold mb-4">بيانات الطالب</h2>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <p><strong>الاسم:</strong> {selectedStudent.name}</p>
                            <p><strong>الصف:</strong> {selectedStudent.grade} - {selectedStudent.className}</p>
                            <p><strong>رقم الهوية:</strong> {selectedStudent.studentId}</p>
                            <p><strong>رقم ولي الأمر:</strong> {formatPhone(selectedStudent.phone)}</p>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h2 className="text-xl font-bold mb-4 bg-gray-100 p-2 border border-black">التقرير التحليلي (السلوك والمواظبة والتميز)</h2>
                        <div className="text-justify leading-loose whitespace-pre-line text-sm font-medium">
                            {aiOverview}
                        </div>
                    </div>

                    <div className="mt-16 flex justify-between px-10">
                        <div className="text-center"><p className="font-bold mb-8">الموجه الطلابي</p><p>{currentUser?.name}</p></div>
                        <div className="text-center"><p className="font-bold mb-8">مدير المدرسة</p><p>.............................</p></div>
                    </div>
                </div>
            )}
        </div>

        {/* Header */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 no-print">
            <div className="flex items-center gap-3">
                <div className="bg-purple-50 p-3 rounded-2xl text-purple-600">
                    {isDirectoryMode ? <Users size={28}/> : <HeartHandshake size={28}/>}
                </div>
                <div>
                    <h1 className="text-xl font-bold text-slate-900">{isDirectoryMode ? 'دليل الطلاب' : 'مكتب التوجيه الطلابي'}</h1>
                    <p className="text-xs text-slate-500">{isDirectoryMode ? 'البحث عن بيانات التواصل' : 'رعاية الطلاب | دراسة الحالات'}</p>
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
                        <button key={tab.id} onClick={() => setActiveView(tab.id as any)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeView === tab.id ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            <tab.icon size={16}/> <span className="hidden md:inline">{tab.label}</span>
                            {tab.id === 'inbox' && pendingReferrals.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{pendingReferrals.length}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>

        {/* --- DASHBOARD VIEW --- */}
        {!isDirectoryMode && activeView === 'dashboard' && (
            <div className="space-y-6 animate-fade-in no-print">
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
                        <p className="text-xs font-bold text-slate-400 uppercase">حالات نشطة</p>
                        <h3 className="text-3xl font-extrabold text-amber-600 mt-1">{activeReferrals.length}</h3>
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-red-100 shadow-sm text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase">مؤشر الخطر</p>
                        <h3 className="text-3xl font-extrabold text-red-600 mt-1">{activeRiskList.length}</h3>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Risk List */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-[400px] flex flex-col">
                        <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-center">
                            <h3 className="font-bold text-red-800 flex items-center gap-2"><ShieldAlert size={18}/> مؤشر الخطر (الغياب المتصل)</h3>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-3">
                            {activeRiskList.length === 0 ? <p className="text-center py-10 text-slate-400">لا يوجد طلاب في دائرة الخطر.</p> : activeRiskList.map((risk, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl hover:border-red-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold">{risk.studentName.charAt(0)}</div>
                                        <div><h4 className="font-bold text-sm text-slate-800">{risk.studentName}</h4><p className="text-xs text-slate-500">آخر غياب: {risk.lastDate}</p></div>
                                    </div>
                                    <span className="text-red-600 font-extrabold bg-red-50 px-3 py-1 rounded-lg text-xs">{risk.days} أيام</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="space-y-4">
                        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10"></div>
                            <h3 className="text-xl font-bold mb-2">جلسة إرشادية جديدة</h3>
                            <p className="text-purple-100 text-sm mb-6">توثيق جلسة فورية لطالب.</p>
                            <button onClick={() => { setActiveView('directory'); }} className="bg-white text-purple-700 px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg"><Plus size={18}/> اختيار طالب</button>
                        </div>
                        
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Inbox size={18} className="text-blue-600"/> آخر الإحالات</h3>
                            {pendingReferrals.length === 0 ? <p className="text-slate-400 text-sm text-center py-4">لا توجد إحالات جديدة.</p> : (
                                <div className="space-y-3">
                                    {pendingReferrals.slice(0, 2).map(ref => (
                                        <div key={ref.id} className="flex justify-between items-center p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                                            <div><p className="font-bold text-slate-800 text-sm">{ref.studentName}</p><p className="text-xs text-slate-500 truncate w-40">{ref.reason}</p></div>
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

        {/* --- DIRECTORY VIEW --- */}
        {(isDirectoryMode || activeView === 'directory') && (
            <div className="space-y-6 animate-fade-in no-print">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-4 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="بحث عن طالب..." className="w-full pr-10 pl-4 py-3 bg-slate-50 border-none rounded-xl outline-none font-bold text-slate-700"/>
                    </div>
                    <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="bg-slate-50 border-none px-4 py-3 rounded-xl font-bold text-slate-700 outline-none cursor-pointer">
                        <option value="">كل الصفوف</option>
                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>

                {filteredStudents.length === 0 ? <div className="text-center py-20 text-slate-400"><Search size={48} className="mx-auto mb-2 opacity-30"/><p>لا توجد نتائج</p></div> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredStudents.map(student => (
                            <div key={student.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 group">
                                <div className="flex items-center gap-4 cursor-pointer" onClick={() => handleOpenStudent(student)}>
                                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-lg group-hover:bg-purple-100 group-hover:text-purple-700 transition-colors">
                                        {student.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-900 truncate group-hover:text-purple-700 transition-colors">{student.name}</h3>
                                        <p className="text-xs text-slate-500 font-mono">{student.studentId}</p>
                                    </div>
                                </div>
                                <div className="border-t border-slate-50 pt-3 flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><School size={12}/> {student.grade}</span>
                                    <div className="flex gap-2">
                                        {student.phone && (
                                            <>
                                            <button onClick={() => copyToClipboard(student.phone)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 hover:text-slate-600"><Copy size={16}/></button>
                                            <button onClick={() => openWhatsApp(student.phone)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100"><MessageCircle size={16}/></button>
                                            <a href={`tel:${formatPhone(student.phone)}`} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Phone size={16}/></a>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* --- INBOX VIEW --- */}
        {!isDirectoryMode && activeView === 'inbox' && (
            <div className="space-y-6 animate-fade-in max-w-4xl mx-auto no-print">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Inbox className="text-blue-600"/> الإحالات الواردة</h2>
                {activeReferrals.concat(pendingReferrals).length === 0 ? <p className="text-slate-400 text-center py-10">لا توجد إحالات نشطة.</p> : 
                    activeReferrals.concat(pendingReferrals).map(ref => (
                        <div key={ref.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-start mb-4 border-b border-slate-50 pb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900">{ref.studentName}</h3>
                                    <p className="text-sm text-slate-500">{ref.grade} - {ref.className}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${ref.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{ref.status === 'pending' ? 'جديدة' : 'قيد المعالجة'}</span>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl mb-4 text-sm text-slate-700 border border-slate-100">
                                <p className="font-bold text-xs text-slate-400 uppercase mb-1">سبب الإحالة</p>
                                {ref.reason}
                            </div>
                            
                            {ref.status === 'pending' ? (
                                <button onClick={() => updateReferralStatus(ref.id, 'in_progress').then(fetchData)} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700">استلام الحالة وبدء المعالجة</button>
                            ) : (
                                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                    <h4 className="font-bold text-purple-900 mb-2 flex items-center gap-2"><Send size={16}/> تسجيل النتائج</h4>
                                    {processingReferralId === ref.id ? (
                                        <div className="space-y-3">
                                            <textarea className="w-full p-3 border border-purple-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[100px]" placeholder="الإجراءات المتخذة والتوصيات..." value={referralOutcome} onChange={e => setReferralOutcome(e.target.value)}></textarea>
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={() => setProcessingReferralId(null)} className="px-4 py-2 bg-white text-slate-600 rounded-lg text-sm font-bold border">إلغاء</button>
                                                <button onClick={() => handleReturnReferral(ref.id)} className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700">إرسال وإنهاء</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button onClick={() => {const s = students.find(x=>x.studentId===ref.studentId); if(s) handleOpenStudent(s);}} className="flex-1 bg-white border border-purple-200 text-purple-700 py-2 rounded-lg text-sm font-bold hover:bg-purple-50">فتح الملف</button>
                                            <button onClick={() => setProcessingReferralId(ref.id)} className="flex-1 bg-purple-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-purple-700">إنهاء الإحالة</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                }
            </div>
        )}

        {/* --- STUDENT MODAL --- */}
        {selectedStudent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in no-print">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                    <div className="p-6 bg-slate-900 text-white flex justify-between items-start shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-2xl font-bold">{selectedStudent.name.charAt(0)}</div>
                            <div>
                                <h2 className="text-2xl font-bold">{selectedStudent.name}</h2>
                                <div className="flex gap-3 text-slate-300 text-sm mt-1">
                                    <span>{selectedStudent.grade} - {selectedStudent.className}</span>
                                    <span>|</span>
                                    <span className="font-mono">{selectedStudent.studentId}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setSelectedStudent(null)} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><X size={20}/></button>
                    </div>
                    
                    <div className="flex border-b border-slate-100 bg-slate-50 px-6 gap-6 overflow-x-auto">
                        {[
                            {k:'info', l:'المعلومات', i:User}, 
                            {k:'history', l:'الغياب', i:Clock}, 
                            {k:'behavior', l:'السلوك', i:ShieldAlert}, 
                            {k:'observations', l:'الملاحظات', i:FileText},
                            {k:'sessions', l:'الجلسات', i:ClipboardList},
                            {k:'ai_analysis', l:'التحليل الذكي', i:BrainCircuit}
                        ].map(t => (
                            <button key={t.k} onClick={() => setModalTab(t.k as any)} className={`py-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${modalTab === t.k ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                                <t.i size={16}/> {t.l}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                        {loadingDetails ? <div className="text-center py-20"><Loader2 className="animate-spin mx-auto"/></div> : (
                            <>
                                {modalTab === 'info' && (
                                    <div className="space-y-6 text-center">
                                        <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 inline-block w-full max-w-sm">
                                            <p className="text-slate-400 text-xs font-bold uppercase mb-4">رقم ولي الأمر (مسح للاتصال)</p>
                                            
                                            {/* Phone QR Code */}
                                            {selectedStudent.phone ? (
                                                <div className="flex flex-col items-center">
                                                    <div className="bg-white p-3 rounded-2xl shadow-sm mb-4 border border-slate-200">
                                                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=tel:${formatPhone(selectedStudent.phone)}`} alt="QR" className="w-32 h-32"/>
                                                    </div>
                                                    <p className="text-3xl font-mono font-bold text-slate-800 mb-6">{formatPhone(selectedStudent.phone)}</p>
                                                    <div className="grid grid-cols-2 gap-3 w-full">
                                                        <a href={`tel:${formatPhone(selectedStudent.phone)}`} className="bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700"><Phone size={18}/> اتصال</a>
                                                        <button onClick={() => openWhatsApp(selectedStudent.phone)} className="bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700"><MessageCircle size={18}/> واتساب</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-slate-400 py-6">
                                                    <Phone size={40} className="mx-auto mb-2 opacity-20"/>
                                                    <p>لا يوجد رقم مسجل</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {modalTab === 'history' && (
                                    <div className="space-y-4">
                                        <div className="flex gap-4 mb-4">
                                            <div className="bg-red-50 text-red-700 px-4 py-2 rounded-xl text-sm font-bold border border-red-100">غياب: {studentDetails.history.filter(h=>h.status==='ABSENT').length}</div>
                                            <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl text-sm font-bold border border-amber-100">تأخر: {studentDetails.history.filter(h=>h.status==='LATE').length}</div>
                                        </div>
                                        <table className="w-full text-right text-sm border-collapse">
                                            <thead><tr className="bg-slate-50 text-slate-500"><th className="p-3 rounded-r-xl">التاريخ</th><th className="p-3 rounded-l-xl">الحالة</th></tr></thead>
                                            <tbody>
                                                {studentDetails.history.map((h, i) => (
                                                    <tr key={i} className="border-b border-slate-50"><td className="p-3 font-mono">{h.date}</td><td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${h.status==='ABSENT'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{h.status==='ABSENT'?'غائب':'متأخر'}</span></td></tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {modalTab === 'behavior' && (
                                    <div className="space-y-4">
                                        {studentDetails.behavior.length === 0 ? <p className="text-center text-slate-400 py-10">سجل نظيف.</p> : studentDetails.behavior.map(b => (
                                            <div key={b.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <div className="flex justify-between font-bold text-slate-800 mb-2"><span>{b.violationName}</span><span className="text-xs bg-white border px-2 py-1 rounded">{b.date}</span></div>
                                                <p className="text-sm text-slate-600">{b.actionTaken}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {modalTab === 'observations' && (
                                    <div className="space-y-4">
                                        {studentDetails.observations.length === 0 ? <p className="text-center text-slate-400 py-10">لا يوجد ملاحظات.</p> : studentDetails.observations.map(obs => (
                                            <div key={obs.id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`text-[10px] px-2 py-1 rounded font-bold ${obs.type==='positive' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{obs.type === 'positive' ? 'إيجابي' : 'ملاحظة'}</span>
                                                    <span className="text-xs text-slate-400">{obs.date}</span>
                                                </div>
                                                <p className="text-sm text-slate-700">{obs.content}</p>
                                                <p className="text-xs text-slate-400 mt-2">بواسطة: {obs.staffName}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {modalTab === 'ai_analysis' && (
                                    <div className="space-y-6">
                                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-2xl border border-indigo-100 text-center">
                                            <BrainCircuit className="mx-auto text-purple-600 mb-3" size={32}/>
                                            <h3 className="text-lg font-bold text-slate-800 mb-2">التحليل التربوي الذكي</h3>
                                            <p className="text-sm text-slate-500 mb-6">توليد تقرير شامل للحالة (غياب، سلوك، ملاحظات) وتوصيات عملية.</p>
                                            
                                            {!aiOverview ? (
                                                <button onClick={handleGenerateOverview} disabled={isGeneratingOverview} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-700 transition-all flex items-center justify-center gap-2 mx-auto">
                                                    {isGeneratingOverview ? <Loader2 className="animate-spin"/> : <Sparkles size={18}/>}
                                                    توليد تقرير شامل
                                                </button>
                                            ) : (
                                                <div className="text-left bg-white p-6 rounded-xl shadow-sm border border-slate-100 text-sm leading-loose whitespace-pre-line animate-fade-in relative">
                                                    {aiOverview}
                                                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
                                                        <button onClick={() => setAiOverview('')} className="text-slate-400 hover:text-slate-600 text-xs font-bold">إعادة</button>
                                                        <button onClick={handlePrintOverview} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-900">
                                                            <Printer size={14}/> طباعة رسمي
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {modalTab === 'sessions' && (
                                    <div className="space-y-6">
                                        {!showSessionForm ? (
                                            <button onClick={() => setShowSessionForm(true)} className="w-full py-4 border-2 border-dashed border-purple-200 rounded-2xl text-purple-600 font-bold hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"><Plus size={20}/> تسجيل جلسة جديدة</button>
                                        ) : (
                                            <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100 animate-fade-in relative">
                                                <button onClick={handleGeneratePlan} disabled={isGeneratingPlan} className="absolute top-4 left-4 text-xs bg-white text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-purple-100">{isGeneratingPlan ? <Loader2 className="animate-spin" size={12}/> : <Sparkles size={12}/>} خطة AI</button>
                                                <h3 className="font-bold text-purple-900 mb-4">جلسة جديدة</h3>
                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div><label className="text-xs font-bold text-slate-500 mb-1 block">النوع</label><select value={sessionType} onChange={e=>setSessionType(e.target.value as any)} className="w-full p-2 rounded-lg border text-sm"><option value="individual">فردي</option><option value="group">جماعي</option></select></div>
                                                    <div><label className="text-xs font-bold text-slate-500 mb-1 block">الموضوع</label><input value={sessionTopic} onChange={e=>setSessionTopic(e.target.value)} className="w-full p-2 rounded-lg border text-sm" placeholder="عنوان الجلسة"/></div>
                                                </div>
                                                <label className="text-xs font-bold text-slate-500 mb-1 block">التوصيات / الإجراءات</label>
                                                <textarea value={sessionRecs} onChange={e=>setSessionRecs(e.target.value)} className="w-full p-3 rounded-lg border text-sm min-h-[100px] mb-4"></textarea>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setShowSessionForm(false)} className="flex-1 bg-white border border-slate-200 py-2 rounded-lg text-slate-600 text-sm font-bold">إلغاء</button>
                                                    <button onClick={handleSaveSession} className="flex-1 bg-purple-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-purple-700">حفظ الجلسة</button>
                                                </div>
                                            </div>
                                        )}
                                        {sessions.filter(s => s.studentId === selectedStudent.studentId).map(s => (
                                            <div key={s.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="font-bold text-slate-800">{s.topic}</h4>
                                                    <span className="text-xs font-mono text-slate-400">{s.date}</span>
                                                </div>
                                                <p className="text-sm text-slate-600 leading-relaxed">{s.recommendations}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default StaffStudents;
