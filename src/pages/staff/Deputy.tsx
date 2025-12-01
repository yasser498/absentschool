
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Briefcase, AlertTriangle, Plus, Search, Loader2, X, Send, Sparkles, 
  User, FileWarning, Check, BarChart2, Printer, TrendingUp, Filter, 
  Trash2, Edit, ArrowRight, LayoutGrid, FileText, School, Inbox, ChevronLeft,
  Calendar, AlertCircle, PieChart as PieIcon, List, Activity, ShieldAlert, Gavel, Forward, CheckCircle, Phone, Clock,
  Medal, Star, ClipboardList, GitCommit, Eye, ArrowUpRight, CheckSquare, FileBadge, PenTool, Wand2, ChevronRight, Gavel as HammerIcon
} from 'lucide-react';
import { 
  getStudents, 
  getBehaviorRecords, 
  addBehaviorRecord, 
  updateBehaviorRecord,
  deleteBehaviorRecord,
  addReferral,
  getReferrals,
  getConsecutiveAbsences,
  resolveAbsenceAlert,
  sendAdminInsight,
  suggestBehaviorAction,
  addStudentObservation,
  addStudentPoints,
  getStudentPoints,
  updateReferralStatus,
  generateSmartContent,
  getStudentObservations,
  updateStudentObservation,
  deleteStudentObservation
} from '../../services/storage';
import { Student, BehaviorRecord, StaffUser, Referral, StudentObservation } from '../../types';
import { BEHAVIOR_VIOLATIONS, GRADES } from '../../constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import AttendanceMonitor from './AttendanceMonitor';

// --- Official Header Component (Print Only) ---
const OfficialHeader = ({ schoolName, subTitle }: { schoolName: string, subTitle: string }) => (
  <div className="print-header">
    <div className="print-header-right">
        <p>المملكة العربية السعودية</p>
        <p>وزارة التعليم</p>
        <p>إدارة التعليم ....................</p>
        <p>{schoolName}</p>
        <p>{subTitle}</p>
    </div>
    <div className="print-header-center">
        <img
          src="https://www.raed.net/img?id=1474173"
          alt="شعار وزارة التعليم"
          className="print-logo"
        />
    </div>
    <div className="print-header-left">
         <p>Kingdom of Saudi Arabia</p>
         <p>Ministry of Education</p>
         <p>Student Affairs</p>
         <div className="mt-2 text-center text-xs font-bold border-2 border-black p-1 inline-block">
            {new Date().toLocaleDateString('en-GB')}
         </div>
    </div>
  </div>
);

const StaffDeputy: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const SCHOOL_NAME = localStorage.getItem('school_name') || "مدرسة عماد الدين زنكي المتوسطة";
  
  // Navigation View State
  const [activeView, setActiveView] = useState<'dashboard' | 'attendance' | 'referrals' | 'log' | 'positive'>('dashboard');
  
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<BehaviorRecord[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]); 
  const [riskList, setRiskList] = useState<any[]>([]); 
  // Positive behavior data
  const [positiveObservations, setPositiveObservations] = useState<StudentObservation[]>([]);

  const [loading, setLoading] = useState(true);
  
  // --- Modals State ---
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [showPositiveModal, setShowPositiveModal] = useState(false);
  const [violationStep, setViolationStep] = useState<'form' | 'success'>('form'); 

  // --- Close Referral Modal State ---
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [referralToClose, setReferralToClose] = useState<Referral | null>(null);
  const [closeDecision, setCloseDecision] = useState('');
  const [isImprovingDecision, setIsImprovingDecision] = useState(false);

  // --- Form State (Violation) ---
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formGrade, setFormGrade] = useState('');
  const [formClass, setFormClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedDegree, setSelectedDegree] = useState(BEHAVIOR_VIOLATIONS[0].degree);
  const [selectedViolation, setSelectedViolation] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [notes, setNotes] = useState('');
  const [lastSavedRecord, setLastSavedRecord] = useState<BehaviorRecord | null>(null);

  // --- Form State (Positive) ---
  const [isEditingPositive, setIsEditingPositive] = useState(false);
  const [editingPositiveId, setEditingPositiveId] = useState<string | null>(null);
  const [positiveReason, setPositiveReason] = useState('');
  const [positivePoints, setPositivePoints] = useState(5);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Printing State
  const [printMode, setPrintMode] = useState<'none' | 'commitment' | 'summons' | 'certificate' | 'referral_report' | 'positive_log' | 'positive_daily_report' | 'absence_referral' | 'absence_notice'>('none');
  const [recordToPrint, setRecordToPrint] = useState<BehaviorRecord | null>(null);
  const [studentToPrint, setStudentToPrint] = useState<Student | null>(null); 
  const [absenceDatesToPrint, setAbsenceDatesToPrint] = useState<string[]>([]);
  const [certificateData, setCertificateData] = useState<{reason: string} | null>(null);
  const [referralToPrint, setReferralToPrint] = useState<Referral | null>(null);

  // Search
  const [search, setSearch] = useState('');

  useEffect(() => {
    const session = localStorage.getItem('ozr_staff_session');
    if (session) setCurrentUser(JSON.parse(session));
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, r, refs, risks, pObs] = await Promise.all([
        getStudents(), 
        getBehaviorRecords(),
        getReferrals(),
        getConsecutiveAbsences(),
        getStudentObservations(undefined, 'positive')
      ]);
      setStudents(s);
      setRecords(r);
      setReferrals(refs); 
      setRiskList(risks);
      setPositiveObservations(pObs);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  const stats = useMemo(() => {
      const totalViolations = records.length;
      const todayViolations = records.filter(r => r.date === new Date().toISOString().split('T')[0]).length;
      const atRiskCount = riskList.length;
      const myReferrals = referrals.filter(r => r.referredBy === 'deputy');
      const resolvedReferrals = myReferrals.filter(r => r.status === 'resolved').length;

      const typeCounts: Record<string, number> = {};
      records.forEach(r => typeCounts[r.violationName] = (typeCounts[r.violationName] || 0) + 1);
      const chartData = Object.entries(typeCounts)
          .map(([name, value]) => ({ name, value }))
          .sort((a,b) => b.value - a.value)
          .slice(0, 5);

      return { totalViolations, todayViolations, atRiskCount, myReferralsCount: myReferrals.length, resolvedReferrals, chartData };
  }, [records, riskList, referrals]);

  const availableClasses = useMemo(() => {
    if (!formGrade) return [];
    const classes = new Set(students.filter(s => s.grade === formGrade).map(s => s.className));
    return Array.from(classes).sort();
  }, [students, formGrade]);

  const availableStudents = useMemo(() => {
    return students.filter(s => s.grade === formGrade && s.className === formClass);
  }, [students, formGrade, formClass]);

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setIsEditingPositive(false);
    setEditingPositiveId(null);
    setFormGrade('');
    setFormClass('');
    setSelectedStudentId('');
    setViolationStep('form');
    setSelectedDegree(BEHAVIOR_VIOLATIONS[0].degree);
    setSelectedViolation('');
    setActionTaken('');
    setNotes('');
    setPositiveReason('');
    setPositivePoints(5);
    setLastSavedRecord(null);
  };

  const handleViolationSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedStudentId || !selectedViolation || !actionTaken) {
          alert("يرجى إكمال جميع الحقول");
          return;
      }
      
      const student = students.find(s => s.id === selectedStudentId);
      if (!student) return;

      const violationObj = BEHAVIOR_VIOLATIONS.find(v => v.degree === selectedDegree);
      const todayISO = new Date().toISOString();

      const recordData: BehaviorRecord = {
          id: editingId || '', 
          studentId: student.studentId,
          studentName: student.name,
          grade: student.grade,
          className: student.className,
          date: todayISO.split('T')[0],
          violationDegree: selectedDegree,
          violationName: selectedViolation,
          articleNumber: violationObj?.article || '',
          actionTaken: actionTaken,
          notes: notes,
          staffId: currentUser?.id,
          createdAt: isEditing ? (records.find(r => r.id === editingId)?.createdAt || todayISO) : todayISO
      };

      if (isEditing) {
          await updateBehaviorRecord(recordData);
          alert("تم التعديل بنجاح");
          resetForm();
          setShowViolationModal(false);
      } else {
          await addBehaviorRecord(recordData);
          setLastSavedRecord(recordData); 
          setViolationStep('success'); 
      }
      fetchData();
  };

  const handlePositiveSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedStudentId || !positiveReason) return;
      
      const student = students.find(s => s.id === selectedStudentId);
      if (!student) return;

      const contentWithPoints = `تعزيز سلوكي: ${positiveReason} (${positivePoints} درجات)`;

      if (isEditingPositive && editingPositiveId) {
          await updateStudentObservation(editingPositiveId, contentWithPoints, 'positive');
          alert("تم تعديل السلوك الإيجابي.");
      } else {
          await addStudentPoints(student.studentId, positivePoints, positiveReason, 'behavior');
          await addStudentObservation({
              id: '',
              studentId: student.studentId,
              studentName: student.name,
              grade: student.grade,
              className: student.className,
              date: new Date().toISOString().split('T')[0],
              type: 'positive',
              content: contentWithPoints,
              staffId: currentUser?.id || '',
              staffName: currentUser?.name || 'وكيل شؤون الطلاب',
              sentiment: 'positive'
          });
          alert("تم حفظ السلوك الإيجابي بنجاح.");
      }

      resetForm();
      setShowPositiveModal(false);
      fetchData();
  };

  const handleEditPositive = (obs: StudentObservation) => {
      setIsEditingPositive(true);
      setEditingPositiveId(obs.id);
      
      let reason = obs.content.replace('تعزيز سلوكي: ', '');
      let points = 5;
      
      const pointsMatch = reason.match(/\((\d+) درجات\)/);
      if (pointsMatch) {
          points = parseInt(pointsMatch[1]);
          reason = reason.replace(pointsMatch[0], '').trim();
      }

      setPositiveReason(reason);
      setPositivePoints(points);
      
      const student = students.find(s => s.studentId === obs.studentId);
      if (student) {
          setFormGrade(student.grade);
          setFormClass(student.className);
          setSelectedStudentId(student.id);
      }
      
      setShowPositiveModal(true);
  };

  const handleDeletePositive = async (id: string) => {
      if(!window.confirm("هل أنت متأكد من حذف هذا السجل؟")) return;
      try {
          await deleteStudentObservation(id);
          fetchData();
      } catch (e) {
          alert("حدث خطأ أثناء الحذف");
      }
  };

  const handlePrintViolationAction = (record: BehaviorRecord, type: 'commitment' | 'summons') => {
      setRecordToPrint(record);
      setPrintMode(type);
      setTimeout(() => { window.print(); setPrintMode('none'); }, 300);
  };

  const handlePrintReferral = (referral: Referral) => {
      setReferralToPrint(referral);
      setPrintMode('referral_report');
      setTimeout(() => { window.print(); setPrintMode('none'); }, 500);
  };

  const handlePrintPositiveDailyReport = () => {
      setPrintMode('positive_daily_report');
      setTimeout(() => { window.print(); setPrintMode('none'); }, 300);
  };

  const handlePrintAttendanceAction = (student: Student, type: 'pledge' | 'summons' | 'referral_print' | 'absence_notice', dates?: string[]) => {
      setStudentToPrint(student);
      setAbsenceDatesToPrint(dates || []);

      if (type === 'referral_print') {
          setPrintMode('absence_referral');
      } else if (type === 'absence_notice') {
          setPrintMode('absence_notice');
      } else {
          setRecordToPrint({
              id: 'temp',
              studentId: student.studentId,
              studentName: student.name,
              grade: student.grade,
              className: student.className,
              violationName: type === 'pledge' ? 'تجاوز حد الغياب المسموح' : 'الغياب المتكرر بدون عذر',
              actionTaken: type === 'pledge' ? 'تعهد خطي' : 'استدعاء ولي أمر',
              date: new Date().toISOString().split('T')[0],
              violationDegree: 'مواظبة',
              articleNumber: ''
          });
          setPrintMode(type === 'pledge' ? 'commitment' : 'summons');
      }
      setTimeout(() => { window.print(); setPrintMode('none'); }, 300);
  };

  const handleCreateReferralFromRecord = async (record: BehaviorRecord) => {
      if(!window.confirm(`هل أنت متأكد من إحالة الطالب ${record.studentName} للموجه الطلابي؟`)) return;
      
      const newReferral: Referral = {
          id: '',
          studentId: record.studentId,
          studentName: record.studentName,
          grade: record.grade,
          className: record.className,
          referralDate: new Date().toISOString().split('T')[0],
          reason: `إحالة بسبب مخالفة: ${record.violationName} (${record.violationDegree})`,
          status: 'pending',
          referredBy: 'deputy',
          notes: record.notes
      };
      
      await addReferral(newReferral);
      alert("تم إرسال الإحالة للموجه بنجاح.");
      if (showViolationModal) setShowViolationModal(false);
      resetForm();
      fetchData();
  };

  const handleOpenCloseModal = (referral: Referral) => {
      setReferralToClose(referral);
      setCloseDecision("بناءً على ما ورد من الموجه الطلابي، وتوصيات لجنة التوجيه، تقرر...");
      setShowCloseModal(true);
  };

  const handleImproveDecision = async () => {
      if (!closeDecision || !referralToClose) return;
      setIsImprovingDecision(true);
      try {
          const prompt = `بصفتك وكيل شؤون طلاب، صغ قراراً إدارياً نهائياً بناءً على: سبب الإحالة: ${referralToClose.reason}، توصية الموجه: ${referralToClose.outcome}، مسودة القرار: ${closeDecision}. اكتب القرار فقط بصيغة رسمية.`;
          const res = await generateSmartContent(prompt);
          setCloseDecision(res.trim());
      } catch (e) { alert("تعذر الاتصال بالمساعد الذكي"); } finally { setIsImprovingDecision(false); }
  };

  const handleFinalizeReferral = async () => {
      if (!referralToClose || !closeDecision.trim()) return;
      await updateReferralStatus(referralToClose.id, 'resolved', undefined); 
      setShowCloseModal(false);
      fetchData();
      alert("تم اعتماد القرار وإغلاق الحالة.");
  };

  const filteredPositiveObservations = useMemo(() => {
      return positiveObservations.filter(obs => obs.date === reportDate);
  }, [positiveObservations, reportDate]);

  return (
    <>
      <div id="print-container" className="hidden print:block text-[14px] leading-relaxed" dir="rtl">
        <div className="print-page-a4">
            <img src="https://www.raed.net/img?id=1474173" className="print-watermark" alt="Watermark" />
            
            {(printMode === 'commitment' || printMode === 'summons') && recordToPrint && (
            <div>
                <OfficialHeader schoolName={SCHOOL_NAME} subTitle="وكالة شؤون الطلاب" />
                <div className="mt-8 px-4 relative z-10">
                    <h1 className="official-title">{printMode === 'commitment' ? 'تعهد خطي (انضباطي)' : 'خطاب استدعاء ولي أمر'}</h1>
                    {printMode === 'commitment' ? (
                        <div className="text-right space-y-6 text-lg font-medium mt-6">
                            <p>أقر أنا الطالب/ة: <strong>{recordToPrint.studentName}</strong> بالصف: <strong>{recordToPrint.grade} - {recordToPrint.className}</strong></p>
                            <p>بأنني قمت بالمخالفة التالية:</p>
                            <div className="bg-gray-50 border-2 border-black p-4 text-center font-bold text-xl my-4">{recordToPrint.violationName}</div>
                            <p className="leading-loose text-justify">وأتعهد بعدم تكرار هذا السلوك مستقبلاً، والالتزام بالأنظمة والتعليمات المدرسية.</p>
                        </div>
                    ) : (
                        <div className="text-lg leading-loose space-y-6 font-medium mt-6 text-justify">
                            <p>المكرم ولي أمر الطالب.. وفقه الله</p>
                            <p>نفيدكم بأنه تم رصد ملاحظات انضباطية/سلوكية على ابنكم <strong>({recordToPrint.studentName})</strong>، والمتمثلة في: <strong>{recordToPrint.violationName}</strong>.</p>
                            <p>نأمل حضوركم للمدرسة يوم ..................... الموافق ..................... لمناقشة وضع الطالب.</p>
                        </div>
                    )}
                    <div className="mt-16 flex justify-between px-8">
                        <div className="text-center"><p className="font-bold mb-8">ولي الأمر</p><p>.............................</p></div>
                        <div className="text-center"><p className="font-bold mb-8">وكيل شؤون الطلاب</p><p>{currentUser?.name}</p></div>
                    </div>
                </div>
            </div>
            )}
        </div>
      </div>

      <div className="space-y-6 pb-20 animate-fade-in no-print">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
                <div className="bg-red-50 p-2 rounded-xl text-red-600"><Briefcase size={24} /></div>
                <div><h1 className="text-xl font-bold text-slate-900">وكالة شؤون الطلاب</h1><p className="text-xs text-slate-500">إدارة السلوك والمواظبة</p></div>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto">
                {[{id: 'dashboard', label: 'الرئيسية', icon: LayoutGrid}, {id: 'attendance', label: 'الغياب', icon: Clock}, {id: 'log', label: 'المخالفات', icon: ShieldAlert}, {id: 'positive', label: 'التميز', icon: Star}, {id: 'referrals', label: 'الإحالات', icon: GitCommit}].map(tab => (
                    <button key={tab.id} onClick={() => setActiveView(tab.id as any)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeView === tab.id ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <tab.icon size={16}/><span className="hidden md:inline">{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>

        {activeView === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-5 rounded-3xl border border-red-100 shadow-sm text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase">مخالفات اليوم</p>
                        <h3 className="text-3xl font-extrabold text-red-700 mt-1">{stats.todayViolations}</h3>
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-orange-100 shadow-sm text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase">خطر الغياب</p>
                        <h3 className="text-3xl font-extrabold text-orange-600 mt-1">{stats.atRiskCount}</h3>
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-blue-100 shadow-sm text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase">إحالات قيد المعالجة</p>
                        <h3 className="text-3xl font-extrabold text-blue-700 mt-1">{stats.myReferralsCount - stats.resolvedReferrals}</h3>
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-sm text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase">قضايا مغلقة</p>
                        <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">{stats.resolvedReferrals}</h3>
                    </div>
                </div>
            </div>
        )}

        {activeView === 'attendance' && <AttendanceMonitor onPrintAction={handlePrintAttendanceAction} />}

        {activeView === 'log' && (
            <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-800">سجل المخالفات السلوكية</h2>
                    <button onClick={() => setShowViolationModal(true)} className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2"><Plus size={18}/> تسجيل مخالفة</button>
                </div>
                {records.length === 0 ? <p className="text-center py-10 text-slate-400">لا يوجد مخالفات مسجلة.</p> : (
                    <div className="space-y-4">
                        {records.map(rec => (
                            <div key={rec.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                                <div className="flex-1">
                                    <div className="flex justify-between mb-2">
                                        <h3 className="font-bold text-slate-900">{rec.studentName}</h3>
                                        <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 font-bold">{rec.violationDegree}</span>
                                    </div>
                                    <p className="text-sm font-bold text-red-700 mb-1">{rec.violationName}</p>
                                    <p className="text-xs text-slate-500">{rec.actionTaken}</p>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <button onClick={() => handlePrintViolationAction(rec, 'summons')} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200" title="استدعاء"><FileWarning size={16}/></button>
                                    <button onClick={() => handlePrintViolationAction(rec, 'commitment')} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200" title="تعهد"><FileText size={16}/></button>
                                    <button onClick={() => handleCreateReferralFromRecord(rec)} className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100" title="إحالة"><Forward size={16}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* MODAL FOR VIOLATION */}
        {showViolationModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800">تسجيل مخالفة جديدة</h2>
                        <button onClick={() => setShowViolationModal(false)}><X size={20} className="text-slate-400"/></button>
                    </div>
                    {violationStep === 'form' ? (
                        <form onSubmit={handleViolationSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <select value={formGrade} onChange={e => {setFormGrade(e.target.value); setFormClass('');}} className="w-full p-2 border rounded-lg bg-slate-50"><option value="">الصف</option>{GRADES.map(g=><option key={g} value={g}>{g}</option>)}</select>
                                <select value={formClass} disabled={!formGrade} onChange={e => setFormClass(e.target.value)} className="w-full p-2 border rounded-lg bg-slate-50"><option value="">الفصل</option>{availableClasses.map(c=><option key={c} value={c}>{c}</option>)}</select>
                            </div>
                            <select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} className="w-full p-2 border rounded-lg bg-slate-50"><option value="">الطالب</option>{availableStudents.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
                            <select value={selectedDegree} onChange={e => {setSelectedDegree(e.target.value); setSelectedViolation('');}} className="w-full p-2 border rounded-lg bg-slate-50">{BEHAVIOR_VIOLATIONS.map(v=><option key={v.degree} value={v.degree}>{v.degree}</option>)}</select>
                            <select value={selectedViolation} onChange={e => setSelectedViolation(e.target.value)} className="w-full p-2 border rounded-lg bg-slate-50"><option value="">المخالفة</option>{BEHAVIOR_VIOLATIONS.find(v=>v.degree===selectedDegree)?.violations.map(v=><option key={v} value={v}>{v}</option>)}</select>
                            <input value={actionTaken} onChange={e => setActionTaken(e.target.value)} className="w-full p-2 border rounded-lg bg-slate-50" placeholder="الإجراء المتخذ..."/>
                            <button type="submit" className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700">حفظ المخالفة</button>
                        </form>
                    ) : (
                        <div className="text-center">
                            <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4"/>
                            <h3 className="text-xl font-bold mb-4">تم الحفظ بنجاح</h3>
                            <div className="flex gap-2 justify-center">
                                <button onClick={() => { if(lastSavedRecord) handlePrintViolationAction(lastSavedRecord, 'summons'); }} className="px-4 py-2 bg-slate-100 rounded-lg font-bold">طباعة استدعاء</button>
                                <button onClick={() => { if(lastSavedRecord) handlePrintViolationAction(lastSavedRecord, 'commitment'); }} className="px-4 py-2 bg-slate-100 rounded-lg font-bold">طباعة تعهد</button>
                                <button onClick={() => { resetForm(); setShowViolationModal(false); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">إغلاق</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </>
  );
};

export default StaffDeputy;
