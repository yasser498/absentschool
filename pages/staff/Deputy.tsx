
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Briefcase, AlertTriangle, Plus, Search, Loader2, X, Send, Sparkles, 
  User, FileWarning, Check, BarChart2, Printer, TrendingUp, Filter, 
  Trash2, Edit, ArrowRight, LayoutGrid, FileText, School, Inbox, ChevronLeft,
  Calendar, AlertCircle, PieChart as PieIcon, List, Activity, ShieldAlert, Gavel, Forward, CheckCircle, Phone, Clock
} from 'lucide-react';
import { 
  getStudents, 
  getBehaviorRecords, 
  addBehaviorRecord, 
  updateBehaviorRecord,
  deleteBehaviorRecord,
  getAdminInsights,
  addReferral,
  getReferrals,
  updateReferralStatus,
  getConsecutiveAbsences,
  resolveAbsenceAlert,
  sendAdminInsight,
  suggestBehaviorAction
} from '../../services/storage';
import { Student, BehaviorRecord, StaffUser, AdminInsight, Referral } from '../../types';
import { BEHAVIOR_VIOLATIONS, GRADES } from '../../constants';

// --- Components defined outside to prevent re-render issues ---

const ReferralStepper = ({ status }: { status: string }) => {
  const steps = [
      { key: 'pending', label: 'إرسال', active: true },
      { key: 'in_progress', label: 'معالجة', active: ['in_progress', 'returned_to_deputy', 'resolved'].includes(status) },
      { key: 'returned_to_deputy', label: 'التقرير', active: ['returned_to_deputy', 'resolved'].includes(status) },
      { key: 'resolved', label: 'إغلاق', active: status === 'resolved' },
  ];

  return (
      <div className="flex items-center justify-between w-full mt-4 relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -z-10 -translate-y-1/2 mx-4"></div>
          {steps.map((step, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1 bg-white px-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border-2 transition-colors ${step.active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-300'}`}>
                      {step.active ? <Check size={12}/> : idx + 1}
                  </div>
                  <span className={`text-[10px] font-bold ${step.active ? 'text-blue-700' : 'text-slate-400'}`}>{step.label}</span>
              </div>
          ))}
      </div>
  );
};

const OfficialHeader = ({ schoolName }: { schoolName: string }) => (
  <div className="mb-6 w-full">
    <div className="flex items-center justify-between px-4">
      <div className="text-right font-bold text-sm space-y-1">
        <p>المملكة العربية السعودية</p>
        <p>وزارة التعليم</p>
        <p>إدارة التعليم ....................</p>
        <p>{schoolName}</p>
      </div>
      <div className="flex justify-center">
        <img
          src="https://www.raed.net/img?id=1474173"
          alt="شعار وزارة التعليم"
          className="h-28 w-auto object-contain"
        />
      </div>
      <div className="text-left font-bold text-sm space-y-1">
         <p>Ministry of Education</p>
         <p>Student Affairs</p>
      </div>
    </div>
    <hr className="border-t-2 border-black mt-4" />
  </div>
);

// --- Main Component ---

const StaffDeputy: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const SCHOOL_NAME = localStorage.getItem('school_name') || "متوسطة عماد الدين زنكي";
  
  // Navigation View State
  const [activeView, setActiveView] = useState<'menu' | 'add' | 'log' | 'daily' | 'analytics' | 'inbox' | 'returned' | 'tracking'>('menu');
  
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<BehaviorRecord[]>([]);
  const [allReferrals, setAllReferrals] = useState<Referral[]>([]); 
  const [returnedReferrals, setReturnedReferrals] = useState<Referral[]>([]); 
  const [riskList, setRiskList] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  
  // --- Form State ---
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStudentName, setEditingStudentName] = useState<string>('');
  
  const [formGrade, setFormGrade] = useState('');
  const [formClass, setFormClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedDegree, setSelectedDegree] = useState(BEHAVIOR_VIOLATIONS[0].degree);
  const [selectedViolation, setSelectedViolation] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [notes, setNotes] = useState('');
  const [isGettingSuggestion, setIsGettingSuggestion] = useState(false); // NEW
  
  // Printing State
  const [printMode, setPrintMode] = useState<'none' | 'commitment' | 'daily' | 'summons' | 'monthly'>('none');
  const [recordToPrint, setRecordToPrint] = useState<BehaviorRecord | null>(null);

  // Search & Date State
  const [search, setSearch] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  // Tracking Filter
  const [trackingFilter, setTrackingFilter] = useState<'ALL' | 'pending' | 'in_progress' | 'resolved'>('ALL');

  useEffect(() => {
    const session = localStorage.getItem('ozr_staff_session');
    if (session) setCurrentUser(JSON.parse(session));
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, r, refs, risks] = await Promise.all([
        getStudents(), 
        getBehaviorRecords(),
        getReferrals(),
        getConsecutiveAbsences()
      ]);
      setStudents(s);
      setRecords(r);
      setAllReferrals(refs); 
      setReturnedReferrals(refs.filter(ref => ref.status === 'returned_to_deputy'));
      setRiskList(risks);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- RISK RESOLUTION LOGIC ---
  const handleResolveRisk = async (studentId: string, action: 'call' | 'counselor') => {
      await resolveAbsenceAlert(studentId, action);
      setRiskList(prev => prev.filter(r => r.studentId !== studentId));
      if (action === 'call') alert("تم تسجيل الاتصال وإخفاء التنبيه لليوم.");
      else alert("تم تحويل الطالب للموجه وإخفاء التنبيه.");
  };

  // --- Form Logic ---
  const availableClasses = useMemo(() => {
    if (!formGrade) return [];
    const classes = new Set(students.filter(s => s.grade === formGrade).map(s => s.className));
    return Array.from(classes).sort();
  }, [students, formGrade]);

  const availableStudents = useMemo(() => {
    return students.filter(s => s.grade === formGrade && s.className === formClass);
  }, [students, formGrade, formClass]);

  const showCommitmentPrint = useMemo(() => {
    return actionTaken.includes('تعهد');
  }, [actionTaken]);

  const showSummonsPrint = useMemo(() => {
    return actionTaken.includes('استدعاء');
  }, [actionTaken]);

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setEditingStudentName('');
    setFormGrade('');
    setFormClass('');
    setSelectedStudentId('');
    setSelectedDegree(BEHAVIOR_VIOLATIONS[0].degree);
    setSelectedViolation('');
    setActionTaken('');
    setNotes('');
  };

  const handleEdit = (rec: BehaviorRecord) => {
      setIsEditing(true);
      setEditingId(rec.id);
      setFormGrade(rec.grade);
      setFormClass(rec.className);
      setEditingStudentName(rec.studentName); 
      
      const studentObj = students.find(s => s.studentId === rec.studentId);
      if (studentObj) setSelectedStudentId(studentObj.id);
      else setSelectedStudentId(''); 

      setSelectedDegree(rec.violationDegree);
      setSelectedViolation(rec.violationName);
      setActionTaken(rec.actionTaken);
      setNotes(rec.notes || '');
      setActiveView('add');
  };

  const getActionSuggestion = async () => {
      if (!selectedViolation) { alert("يرجى اختيار نوع المخالفة أولاً"); return; }
      
      const student = students.find(s => s.id === selectedStudentId);
      const previousViolations = records.filter(r => r.studentId === student?.studentId).length;
      
      setIsGettingSuggestion(true);
      try {
          const suggestion = await suggestBehaviorAction(selectedViolation, previousViolations);
          setNotes(suggestion);
      } catch (e) { alert("تعذر الحصول على اقتراح"); }
      finally { setIsGettingSuggestion(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isEditing && !selectedStudentId) return;
      if (!selectedViolation) return;
      
      let student = students.find(s => s.id === selectedStudentId);
      if (!student && isEditing && editingId) {
          const originalRec = records.find(r => r.id === editingId);
          if(originalRec) {
             student = { id: 'unknown', name: originalRec.studentName, studentId: originalRec.studentId, grade: originalRec.grade, className: originalRec.className, phone: '' };
          }
      }

      if (!student) return;

      const violationObj = BEHAVIOR_VIOLATIONS.find(v => v.degree === selectedDegree);
      const article = violationObj?.article || '';
      const now = new Date();
      const todayISO = now.toISOString();

      const recordData: BehaviorRecord = {
          id: editingId || '',
          studentId: student.studentId,
          studentName: student.name,
          grade: formGrade || student.grade,
          className: formClass || student.className,
          date: todayISO.split('T')[0],
          violationDegree: selectedDegree,
          violationName: selectedViolation,
          articleNumber: article,
          actionTaken: actionTaken,
          notes: notes,
          staffId: currentUser?.id,
          createdAt: isEditing ? (records.find(r => r.id === editingId)?.createdAt || todayISO) : todayISO
      };

      if (isEditing) {
          await updateBehaviorRecord(recordData);
          alert("تم تعديل المخالفة بنجاح");
      } else {
          await addBehaviorRecord(recordData);
          alert("تم تسجيل المخالفة بنجاح");
      }
      resetForm();
      fetchData();
      setActiveView('log');
  };

  // --- REFERRAL LOGIC ---
  const handleReferToCounselor = async (rec: BehaviorRecord) => {
      const reason = prompt("ما هو سبب التحويل للموجه الطلابي؟ (مثلاً: تكرار السلوك، عدوانية، دراسة حالة)");
      if (!reason) return;

      try {
          const referral: Referral = {
              id: '',
              studentId: rec.studentId,
              studentName: rec.studentName,
              grade: rec.grade,
              className: rec.className,
              referralDate: new Date().toISOString().split('T')[0],
              reason: `مخالفة سلوكية: ${rec.violationName} - ${reason}`,
              status: 'pending',
              referredBy: 'deputy',
              notes: `تم التحويل بناءً على المخالفة المسجلة بتاريخ ${rec.date}`
          };
          await addReferral(referral);
          await sendAdminInsight('counselor', `إحالة جديدة من الوكيل: الطالب ${rec.studentName} - ${rec.violationName}`);
          
          alert("تم إرسال الطالب للموجه الطلابي بنجاح.");
          fetchData(); 
      } catch (error) {
          alert("حدث خطأ أثناء الإرسال.");
      }
  };

  const handleCloseReferral = async (id: string) => {
      if (!window.confirm("هل تريد إغلاق هذه الحالة نهائياً (تم الاطلاع)؟")) return;

      setReturnedReferrals(prev => prev.filter(ref => ref.id !== id));
      setAllReferrals(prev => prev.map(r => r.id === id ? { ...r, status: 'resolved' } : r));

      try {
          await updateReferralStatus(id, 'resolved');
      } catch (error: any) {
          console.error("Failed to close referral:", error);
          alert("حدث خطأ أثناء إغلاق الحالة. سيتم إعادة تحميل البيانات.");
          fetchData();
      }
  };

  const handlePrintFromLog = (rec: BehaviorRecord, mode: 'commitment' | 'summons') => {
    setRecordToPrint(rec);
    setPrintMode(mode);
    setTimeout(() => { window.print(); setPrintMode('none'); setRecordToPrint(null); }, 200);
  };

  const buildTempRecordFromForm = (): BehaviorRecord | null => {
    let student = students.find(s => s.id === selectedStudentId);
    if (!student && isEditing) {
        student = { id: 'temp', name: editingStudentName, studentId: 'Unknown', grade: formGrade, className: formClass, phone: '' };
    }
    if (!student) return null;
    const todayISO = new Date().toISOString();
    return {
      id: 'temp',
      studentId: student.studentId,
      studentName: student.name,
      grade: formGrade,
      className: formClass,
      date: todayISO.split('T')[0],
      violationDegree: selectedDegree,
      violationName: selectedViolation,
      articleNumber: '',
      actionTaken: actionTaken,
      notes: notes,
      staffId: currentUser?.id,
      createdAt: todayISO
    };
  };

  const handlePrintCommitment = () => {
    const temp = buildTempRecordFromForm();
    if (!temp) return;
    setRecordToPrint(temp);
    setPrintMode('commitment');
    setTimeout(() => { window.print(); setPrintMode('none'); setRecordToPrint(null); }, 200);
  };

  const handlePrintSummons = () => {
    const temp = buildTempRecordFromForm();
    if (!temp) return;
    setRecordToPrint(temp);
    setPrintMode('summons');
    setTimeout(() => { window.print(); setPrintMode('none'); setRecordToPrint(null); }, 200);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا السجل؟')) {
      await deleteBehaviorRecord(id);
      fetchData();
    }
  };

  const filteredRecords = records.filter(r => r.studentName.includes(search) || r.violationName.includes(search));
  const dailyRecords = records.filter(r => r.date === reportDate);
  
  const filteredTrackingReferrals = useMemo(() => {
      if (trackingFilter === 'ALL') return allReferrals;
      return allReferrals.filter(r => r.status === trackingFilter || (trackingFilter === 'pending' && r.status === 'returned_to_deputy'));
  }, [allReferrals, trackingFilter]);

  return (
    <>
      <style>
        {`
          @page { size: A4; margin: 15mm; }
          @media print {
            body * { visibility: hidden; }
            #print-container, #print-container * { visibility: visible; }
            #print-container { position: absolute; left: 0; top: 0; width: 100%; background: white; padding: 0; z-index: 9999; }
            .no-print { display: none !important; }
            .print-border { border: 2px solid #000; padding: 20px; min-height: 260mm; }
          }
        `}
      </style>

      {/* --- PRINT CONTAINER --- */}
      <div id="print-container" className="hidden print:block text-[14px] leading-relaxed" dir="rtl">
        {printMode === 'commitment' && recordToPrint && (
          <div className="print-border">
            <OfficialHeader schoolName={SCHOOL_NAME} />
            <h1 className="text-3xl font-extrabold text-center mb-10 underline underline-offset-8">تعهد خطي (مخالفة سلوكية)</h1>
             <div className="text-right space-y-8 text-xl font-medium px-4">
              <p>أقر أنا الطالب/ة: <strong>{recordToPrint.studentName}</strong> بالصف: <strong>{recordToPrint.grade} - {recordToPrint.className}</strong></p>
              <p>بأنني قمت بالمخالفة التالية:</p>
              <div className="bg-gray-50 p-4 border border-gray-400 rounded-lg text-center font-bold text-2xl">{recordToPrint.violationName}</div>
              <p>وأتعهد بعدم تكرار هذا السلوك مستقبلاً، والالتزام بالأنظمة والتعليمات المدرسية. وفي حال التكرار، أتحمل كافة الإجراءات النظامية.</p>
            </div>
             <div className="flex justify-between mt-32 px-12 text-lg">
              <div className="text-center"><p className="font-bold mb-8">الطالب/ة</p><p>.............................</p></div>
              <div className="text-center"><p className="font-bold mb-8">وكيل شؤون الطلاب</p><p>{currentUser?.name}</p><p className="mt-4">التوقيع: .............................</p></div>
            </div>
            <div className="mt-16 text-center text-sm">حرر بتاريخ: {new Date().toLocaleDateString('ar-SA')}</div>
          </div>
        )}
        
        {printMode === 'summons' && recordToPrint && (
          <div className="print-border">
            <OfficialHeader schoolName={SCHOOL_NAME} />
            <h2 className="text-2xl font-extrabold text-center underline mb-10">خطاب استدعاء ولي أمر</h2>
            <div className="text-xl leading-loose space-y-6 px-4 font-medium">
              <p>المكرم ولي أمر الطالب.. وفقه الله</p>
              <p>السلام عليكم ورحمة الله وبركاته،،،</p>
              <p>نفيدكم بأنه تم رصد مخالفة سلوكية على ابنكم <strong>({recordToPrint.studentName})</strong> وهي: <br/><strong className="text-red-900 underline">{recordToPrint.violationName}</strong>.</p>
              <p>لذا نأمل منكم التكرم بالحضور للمدرسة يوم ................................ الموافق ...../...../.....هـ لمناقشة وضع الطالب.</p>
            </div>
            <div className="flex justify-between mt-32 px-12 text-lg">
              <div className="text-center"><p className="font-bold mb-8">وكيل شؤون الطلاب</p><p>{currentUser?.name}</p></div>
              <div className="text-center"><p className="font-bold mb-8">قائد المدرسة</p><p>.............................</p></div>
            </div>
          </div>
        )}

        {printMode === 'daily' && (
          <div className="print-border">
            <OfficialHeader schoolName={SCHOOL_NAME} />
            <h1 className="text-2xl font-bold text-center mb-6">تقرير المخالفات السلوكية اليومي</h1>
            <p className="text-center mb-6 text-lg">التاريخ: <strong>{reportDate}</strong></p>
            <table className="w-full text-right border-collapse border border-black text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black p-3">الطالب</th>
                  <th className="border border-black p-3">الصف</th>
                  <th className="border border-black p-3">المخالفة</th>
                  <th className="border border-black p-3">الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {dailyRecords.map((rec, idx) => (
                    <tr key={idx}><td className="border border-black p-3">{rec.studentName}</td><td className="border border-black p-3">{rec.grade}</td><td className="border border-black p-3">{rec.violationName}</td><td className="border border-black p-3">{rec.actionTaken}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- APP UI --- */}
      <div className="space-y-6 animate-fade-in pb-12 no-print">
        {/* Header */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-red-50 p-2 rounded-xl text-red-600"><Briefcase size={24} /></div>
            <div><h1 className="text-xl font-bold text-slate-900">مكتب وكيل الشؤون</h1><p className="text-xs text-slate-500">ضبط السلوك والمواظبة</p></div>
          </div>
          {activeView !== 'menu' && (
            <button onClick={() => setActiveView('menu')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-900 bg-slate-50 px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors">
              <LayoutGrid size={16} /> القائمة الرئيسية
            </button>
          )}
        </div>

        {/* MENU */}
        {activeView === 'menu' && (
            <div className="space-y-6">
                
                {/* 1. RISK ALERTS SECTION */}
                {riskList.length > 0 && (
                    <div className="bg-red-50 border-2 border-red-100 rounded-3xl p-6 shadow-sm relative overflow-hidden animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-red-800 flex items-center gap-2">
                                <AlertTriangle className="animate-pulse" /> مؤشرات الخطر (غياب متصل)
                            </h2>
                            <span className="bg-red-200 text-red-800 px-3 py-1 rounded-full text-xs font-bold">{riskList.length} حالات جديدة</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {riskList.map((alert, idx) => (
                                <div key={idx} className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-slate-800">{alert.studentName}</h3>
                                            <p className="text-xs text-slate-500 mt-1">آخر غياب: {alert.lastDate}</p>
                                        </div>
                                        <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-lg">{alert.days} أيام</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-4">
                                        <button onClick={() => handleResolveRisk(alert.studentId, 'counselor')} className="bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs py-2 rounded-lg font-bold transition-colors flex items-center justify-center gap-1 border border-amber-200"><ShieldAlert size={14} /> تحويل للموجه</button>
                                        <button onClick={() => handleResolveRisk(alert.studentId, 'call')} className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs py-2 rounded-lg font-bold transition-colors flex items-center justify-center gap-1 border border-blue-200"><Phone size={14} /> تم الاتصال</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    <button onClick={() => { resetForm(); setActiveView('add'); }} className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-red-300 transition-all text-right relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                        <div className="relative z-10"><div className="w-12 h-12 bg-red-600 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg"><Plus size={24} /></div><h3 className="text-lg font-bold text-slate-800 mb-1">رصد مخالفة</h3></div>
                    </button>
                    <button onClick={() => setActiveView('log')} className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all text-right relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                        <div className="relative z-10"><div className="w-12 h-12 bg-blue-900 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg"><FileWarning size={24} /></div><h3 className="text-lg font-bold text-slate-800 mb-1">سجل المخالفات</h3></div>
                    </button>
                    <button onClick={() => setActiveView('tracking')} className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-300 transition-all text-right relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                        <div className="relative z-10">
                            <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg"><Activity size={24} /></div>
                            <h3 className="text-lg font-bold text-slate-800 mb-1">تتبع الحالات</h3>
                            <p className="text-xs text-slate-500">متابعة تسلسل الإحالات</p>
                        </div>
                    </button>
                    <button onClick={() => setActiveView('returned')} className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all text-right relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                        <div className="relative z-10">
                            <div className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg relative">
                                <Check size={24} />
                                {returnedReferrals.length > 0 && <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-[10px] flex items-center justify-center border-2 border-white animate-pulse">{returnedReferrals.length}</span>}
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-1">الوارد من التوجيه</h3>
                            <p className="text-slate-500 text-xs">قرارات الوكيل والحالات المعادة.</p>
                        </div>
                    </button>
                    <button onClick={() => setActiveView('daily')} className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-gray-300 transition-all text-right relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                        <div className="relative z-10"><div className="w-12 h-12 bg-gray-600 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg"><Printer size={24} /></div><h3 className="text-lg font-bold text-slate-800 mb-1">طباعة التقارير</h3></div>
                    </button>
                </div>
            </div>
        )}

        {/* View 1: ADD */}
        {activeView === 'add' && (
          <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden animate-fade-in-up">
            <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">{isEditing ? <Edit size={20}/> : <Plus size={20}/>} {isEditing ? 'تعديل مخالفة' : 'تسجيل مخالفة جديدة'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              {!isEditing && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">1. الصف</label><select value={formGrade} onChange={e => { setFormGrade(e.target.value); setFormClass(''); setSelectedStudentId(''); }} className="w-full p-3 bg-white border border-slate-300 rounded-xl font-bold text-sm"><option value="">اختر...</option>{GRADES.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                   <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">2. الفصل</label><select value={formClass} disabled={!formGrade} onChange={e => { setFormClass(e.target.value); setSelectedStudentId(''); }} className="w-full p-3 bg-white border border-slate-300 rounded-xl font-bold text-sm"><option value="">اختر...</option>{availableClasses.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                   <div><label className="block text-xs font-bold text-slate-500 uppercase mb-2">3. الطالب</label><select required disabled={!formClass} value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} className="w-full p-3 bg-white border border-slate-300 rounded-xl font-bold text-sm"><option value="">-- اختر الطالب --</option>{availableStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-3">درجة المخالفة</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {BEHAVIOR_VIOLATIONS.map(v => (
                    <button key={v.degree} type="button" onClick={() => { setSelectedDegree(v.degree); setSelectedViolation(''); setActionTaken(''); }} className={`p-4 rounded-xl border-2 text-sm font-bold transition-all ${selectedDegree === v.degree ? 'border-blue-900 bg-blue-900 text-white' : 'border-slate-100 bg-white text-slate-600'}`}>{v.degree}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">نوع المخالفة</label><select required value={selectedViolation} onChange={e => setSelectedViolation(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm"><option value="">-- حدد المخالفة --</option>{BEHAVIOR_VIOLATIONS.find(v => v.degree === selectedDegree)?.violations.map(vio => <option key={vio} value={vio}>{vio}</option>)}</select></div>
                
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">الإجراء المتخذ</label><select required value={actionTaken} onChange={e => setActionTaken(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm"><option value="">-- حدد الإجراء --</option>{BEHAVIOR_VIOLATIONS.find(v => v.degree === selectedDegree)?.actions.map(act => <option key={act} value={act}>{act}</option>)}</select></div>
                
                <div className="flex gap-2">
                  {showCommitmentPrint && <button type="button" onClick={handlePrintCommitment} className="flex-1 bg-amber-50 text-amber-700 px-4 py-2.5 rounded-xl border border-amber-200 font-bold flex items-center justify-center gap-2"><Printer size={16} /> طباعة التعهد</button>}
                  {showSummonsPrint && <button type="button" onClick={handlePrintSummons} className="flex-1 bg-orange-50 text-orange-700 px-4 py-2.5 rounded-xl border border-orange-200 font-bold flex items-center justify-center gap-2"><Printer size={16} /> طباعة الاستدعاء</button>}
                </div>
                
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">ملاحظات إضافية</label>
                    <div className="relative">
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm min-h-[80px]" placeholder="اختياري..."/>
                        <button type="button" onClick={getActionSuggestion} disabled={isGettingSuggestion} className="absolute bottom-3 left-3 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 flex items-center gap-1">
                            {isGettingSuggestion ? <Loader2 className="animate-spin" size={12}/> : <Sparkles size={12}/>} اقتراح ذكي
                        </button>
                    </div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex gap-4">
                <button type="button" onClick={() => { resetForm(); setActiveView('menu'); }} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl">إلغاء</button>
                <button type="submit" className="flex-[2] py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20">{isEditing ? 'حفظ التعديلات' : 'حفظ المخالفة'}</button>
              </div>
            </form>
          </div>
        )}

        {/* View 2: LOG */}
        {activeView === 'log' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-4 rounded-xl border border-slate-200"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="w-full p-2 outline-none" /></div>
            <div className="grid grid-cols-1 gap-4">
              {filteredRecords.map(rec => (
                  <div key={rec.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-2">
                        <div><h3 className="font-bold text-lg text-slate-900">{rec.studentName}</h3><span className="text-xs text-slate-500">{rec.grade} - {rec.className}</span></div>
                        <span className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-bold">{rec.violationDegree}</span>
                    </div>
                    <p className="font-bold text-sm text-red-800 mb-2">{rec.violationName}</p>
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded mb-3"><strong>الإجراء:</strong> {rec.actionTaken}</p>
                    <div className="flex justify-end gap-2 border-t pt-2">
                      <button onClick={() => handleReferToCounselor(rec)} className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100 font-bold flex items-center gap-1 hover:bg-blue-100"><Forward size={14}/> تحويل للموجه</button>
                      {rec.actionTaken.includes('تعهد') && <button onClick={() => handlePrintFromLog(rec, 'commitment')} className="p-1.5 bg-amber-50 text-amber-600 rounded"><Printer size={16}/></button>}
                      <button onClick={() => handleEdit(rec)} className="p-1.5 text-slate-400 hover:text-blue-600"><Edit size={16}/></button>
                      <button onClick={() => handleDelete(rec.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        )}

        {/* View 3: TRACKING (NEW) */}
        {activeView === 'tracking' && (
            <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-800"><Activity className="text-indigo-600"/> سجل تتبع الحالات</h2>
                    <div className="flex gap-2">
                        <button onClick={() => setTrackingFilter('ALL')} className={`px-3 py-1 text-xs font-bold rounded-lg ${trackingFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>الكل</button>
                        <button onClick={() => setTrackingFilter('pending')} className={`px-3 py-1 text-xs font-bold rounded-lg ${trackingFilter === 'pending' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>قيد الانتظار</button>
                        <button onClick={() => setTrackingFilter('resolved')} className={`px-3 py-1 text-xs font-bold rounded-lg ${trackingFilter === 'resolved' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>تم الإغلاق</button>
                    </div>
                </div>

                <div className="space-y-4">
                    {filteredTrackingReferrals.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">لا يوجد حالات</div>
                    ) : (
                        filteredTrackingReferrals.map(ref => (
                            <div key={ref.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 ${
                                            ref.status === 'resolved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            ref.status === 'returned_to_deputy' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                            'bg-slate-50 text-slate-600 border-slate-200'
                                        }`}>
                                            {ref.studentName.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-900">{ref.studentName}</h3>
                                            <p className="text-xs text-slate-500">{ref.grade} - {ref.className}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs text-slate-400 block mb-1 font-mono">{ref.referralDate}</span>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                                            ref.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            ref.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                            ref.status === 'returned_to_deputy' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                            'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        }`}>
                                            {ref.status === 'pending' ? 'بانتظار الموجه' : 
                                             ref.status === 'in_progress' ? 'قيد المعالجة' :
                                             ref.status === 'returned_to_deputy' ? 'وصل التقرير' : 'مغلق'}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-4 bg-slate-50 p-3 rounded-xl text-sm border border-slate-100">
                                    <p className="font-bold text-slate-500 text-xs mb-1">سبب الإحالة:</p>
                                    <p className="text-slate-800">{ref.reason}</p>
                                </div>

                                <ReferralStepper status={ref.status} />

                                {ref.outcome && (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <p className="text-xs font-bold text-purple-700 mb-1 flex items-center gap-1"><Sparkles size={12}/> تقرير الموجه:</p>
                                        <p className="text-sm text-slate-700 font-medium">{ref.outcome}</p>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        )}

        {/* View 4: RETURNED CASES */}
        {activeView === 'returned' && (
            <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
                <h2 className="text-lg font-bold flex items-center gap-2 text-emerald-800"><CheckCircle className="text-emerald-600"/> الردود والحالات المعادة من التوجيه الطلابي</h2>
                {returnedReferrals.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                        <Check size={48} className="mx-auto mb-4 opacity-50"/>
                        <p>لا توجد حالات معادة من المرشد حالياً.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {returnedReferrals.map(ref => (
                            <div key={ref.id} className="bg-white border-2 border-emerald-100 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 bg-emerald-100 text-emerald-800 text-xs font-bold px-4 py-1 rounded-br-xl">تمت المعالجة</div>
                                
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-xl text-slate-900 mb-1">{ref.studentName}</h3>
                                        <p className="text-xs text-slate-500"><School size={12} className="inline mr-1"/> {ref.grade} - {ref.className}</p>
                                    </div>
                                    <div className="text-left bg-slate-50 px-3 py-2 rounded-lg">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">تاريخ الإحالة</p>
                                        <p className="font-mono font-bold text-slate-700">{ref.referralDate}</p>
                                    </div>
                                </div>
                                
                                <div className="grid md:grid-cols-2 gap-4 mb-6">
                                    <div className="bg-slate-50 p-4 rounded-xl text-sm border border-slate-100">
                                        <p className="font-bold text-slate-400 text-xs uppercase mb-2">سبب الإحالة (المرسل من قبلكم)</p>
                                        <p className="text-slate-700 font-medium">{ref.reason}</p>
                                    </div>
                                    <div className="bg-emerald-50 p-4 rounded-xl text-sm border-2 border-emerald-100 shadow-sm">
                                        <p className="font-bold text-emerald-700 text-xs uppercase mb-2 flex items-center gap-1"><Sparkles size={12}/> مرئيات وتوصيات الموجه الطلابي</p>
                                        <p className="text-slate-800 font-bold leading-relaxed">{ref.outcome}</p>
                                    </div>
                                </div>
                                <div className="text-left pt-4 border-t border-slate-50 flex justify-end gap-3">
                                    <button onClick={() => handleCloseReferral(ref.id)} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow hover:bg-slate-900 flex items-center gap-2">
                                        <CheckCircle size={16}/> إغلاق الحالة (تم الاطلاع)
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* View 5: DAILY REPORT */}
        {activeView === 'daily' && (
            <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
                <h3 className="font-bold text-lg mb-4">طباعة التقرير اليومي</h3>
                <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="border p-2 rounded-lg mb-4" />
                <br/>
                <button onClick={() => { setPrintMode('daily'); setTimeout(() => window.print(), 200); }} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700">طباعة التقرير</button>
            </div>
        )}
      </div>
    </>
  );
};

export default StaffDeputy;
