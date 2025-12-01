
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
        {/* Ministry Logo is sufficient for official documents, School Logo hidden */}
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
  const SCHOOL_NAME = localStorage.getItem('school_name') || "متوسطة عماد الدين زنكي";
  
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
        getStudentObservations(undefined, 'positive') // Fetch only positive type
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

  // --- STATS LOGIC ---
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

  // --- Actions ---

  const handleViolationSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedStudentId || !selectedViolation || !actionTaken) {
          alert("يرجى إكمال جميع الحقول (الطالب، المخالفة، والإجراء)");
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

      // Include points in content for display purposes since Observation schema doesn't have points column
      const contentWithPoints = `تعزيز سلوكي: ${positiveReason} (${positivePoints} درجات)`;

      if (isEditingPositive && editingPositiveId) {
          await updateStudentObservation(editingPositiveId, contentWithPoints, 'positive');
          alert("تم تعديل السلوك الإيجابي.");
      } else {
          // Add points to ledger
          await addStudentPoints(student.studentId, positivePoints, positiveReason, 'behavior');
          // Add observation for log
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
      
      // Parse content to extract reason and points
      // Format: "تعزيز سلوكي: Reason (5 درجات)"
      let reason = obs.content.replace('تعزيز سلوكي: ', '');
      let points = 5;
      
      const pointsMatch = reason.match(/\((\d+) درجات\)/);
      if (pointsMatch) {
          points = parseInt(pointsMatch[1]);
          reason = reason.replace(pointsMatch[0], '').trim();
      }

      setPositiveReason(reason);
      setPositivePoints(points);
      
      // Pre-select student
      const student = students.find(s => s.studentId === obs.studentId);
      if (student) {
          setFormGrade(student.grade);
          setFormClass(student.className);
          setSelectedStudentId(student.id);
      }
      
      setShowPositiveModal(true);
  };

  const handleDeletePositive = async (id: string) => {
      if(!window.confirm("هل أنت متأكد من حذف هذا السجل؟ لن يتم حذف النقاط المكتسبة سابقاً من رصيد الطالب التراكمي، فقط السجل اليومي.")) return;
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
          // Reuse existing dummy record logic for general pledge/summons
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

  // --- Close Referral Workflow ---
  const handleOpenCloseModal = (referral: Referral) => {
      setReferralToClose(referral);
      setCloseDecision("بناءً على ما ورد من الموجه الطلابي، وتوصيات لجنة التوجيه، تقرر...");
      setShowCloseModal(true);
  };

  const handleImproveDecision = async () => {
      if (!closeDecision || !referralToClose) return;
      setIsImprovingDecision(true);
      try {
          const prompt = `
            بصفتك خبير صياغة قرارات إدارية مدرسية (وكيل شؤون طلاب)، قم بصياغة "نص القرار النهائي" لاعتماده.
            
            البيانات الأساسية:
            1. سبب الإحالة: "${referralToClose.reason}"
            2. تاريخ الإحالة: "${referralToClose.referralDate}"
            3. رد الموجه الطلابي والنتائج: "${referralToClose.outcome || 'تمت التوصية باتخاذ الإجراء النظامي'}"
            4. مسودة القرار المبدئية: "${closeDecision}"

            التعليمات الهامة جداً:
            - تجنب تماماً استخدام صيغة المتكلم مثل "بصفتي" أو "أنا" أو "قررت".
            - استخدم الصيغة الرسمية المبنية للمجهول أو الجمع، مثل: "بناءً على ما سبق... فقد تقرر:" أو "تم اعتماد ما يلي:".
            - ادمج سياق الإحالة (السبب والرد) كمبررات للقرار ليكون النص متماسكاً وقانونياً.
            - اكتب النص النهائي مباشرة بدون مقدمات أو شرح.
          `;
          const res = await generateSmartContent(prompt);
          setCloseDecision(res.trim());
      } catch (e) {
          alert("تعذر الاتصال بالمساعد الذكي");
      } finally {
          setIsImprovingDecision(false);
      }
  };

  const handleFinalizeReferral = async () => {
      if (!referralToClose || !closeDecision.trim()) return;
      
      const finalNotes = referralToClose.notes 
          ? `${referralToClose.notes}\n\n[قرار الوكيل]: ${closeDecision}` 
          : `[قرار الوكيل]: ${closeDecision}`;

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
      {/* --- PRINT CONTAINER --- */}
      <div id="print-container" className="hidden print:block text-[14px] leading-relaxed" dir="rtl">
        <div className="print-page-a4">
            <img src="https://www.raed.net/img?id=1474173" className="print-watermark" alt="Watermark" />
            
            {/* 1. COMMITMENT / SUMMONS */}
            {(printMode === 'commitment' || printMode === 'summons') && recordToPrint && (
            <div>
                <OfficialHeader schoolName={SCHOOL_NAME} subTitle="وكالة شؤون الطلاب" />
                
                <div className="mt-8 px-4 relative z-10">
                    <h1 className="official-title">
                        {printMode === 'commitment' ? 'تعهد خطي (انضباطي)' : 'خطاب استدعاء ولي أمر'}
                    </h1>
                    
                    {printMode === 'commitment' ? (
                        <div className="text-right space-y-6 text-lg font-medium mt-6">
                            <p>أقر أنا الطالب/ة: <strong>{recordToPrint.studentName}</strong> بالصف: <strong>{recordToPrint.grade} - {recordToPrint.className}</strong></p>
                            <p>بأنني قمت بالمخالفة التالية:</p>
                            <div className="bg-gray-50 border-2 border-black p-4 text-center font-bold text-xl my-4">{recordToPrint.violationName}</div>
                            <p className="leading-loose text-justify">وأتعهد بعدم تكرار هذا السلوك مستقبلاً، والالتزام بالأنظمة والتعليمات المدرسية. وفي حال التكرار، أتحمل كافة الإجراءات النظامية المترتبة على ذلك وفق لائحة السلوك والمواظبة.</p>
                        </div>
                    ) : (
                        <div className="text-lg leading-loose space-y-6 font-medium mt-6 text-justify">
                            <p>المكرم ولي أمر الطالب.. وفقه الله</p>
                            <p>السلام عليكم ورحمة الله وبركاته،،،</p>
                            <p>نفيدكم بأنه تم رصد ملاحظات انضباطية/سلوكية على ابنكم <strong>({recordToPrint.studentName})</strong> بالصف <strong>({recordToPrint.grade})</strong>.</p>
                            <p>الموضوع: <strong className="underline">{recordToPrint.violationName}</strong>.</p>
                            <p>لذا نأمل منكم التكرم بالحضور للمدرسة يوم ................................ الموافق ...../...../.....هـ لمناقشة وضع الطالب والتعاون معنا في تقويمه.</p>
                            <p className="text-center mt-8 font-bold">شاكرين ومقدرين حسن تعاونكم،،،</p>
                        </div>
                    )}
                    
                    <div className="footer-signatures">
                        {printMode === 'commitment' && <div className="signature-box"><p className="signature-title">الطالب/ة</p><p>.............................</p></div>}
                        <div className="signature-box"><p className="signature-title">وكيل شؤون الطلاب</p><p>{currentUser?.name}</p></div>
                        {printMode === 'summons' && <div className="signature-box"><p className="signature-title">مدير المدرسة</p><p>.............................</p></div>}
                    </div>
                </div>
            </div>
            )}

            {/* 2. REFERRAL REPORT */}
            {printMode === 'referral_report' && referralToPrint && (
                <div>
                    <OfficialHeader schoolName={SCHOOL_NAME} subTitle="نموذج إحالة طالب (توجيه طلابي)" />
                    <div className="mt-6 px-4 relative z-10">
                        <h1 className="official-title">تقرير حالة طالب</h1>
                        
                        <div className="referral-box">
                            <span className="referral-box-title">بيانات الطالب</span>
                            <div className="referral-grid">
                                <div className="referral-row"><span className="referral-label">الاسم:</span> {referralToPrint.studentName}</div>
                                <div className="referral-row"><span className="referral-label">الصف:</span> {referralToPrint.grade} - {referralToPrint.className}</div>
                                <div className="referral-row"><span className="referral-label">تاريخ الإحالة:</span> {referralToPrint.referralDate}</div>
                                <div className="referral-row"><span className="referral-label">جهة الإحالة:</span> {referralToPrint.referredBy === 'deputy' ? 'وكيل شؤون الطلاب' : 'معلم/إداري'}</div>
                            </div>
                        </div>

                        <div className="referral-box">
                            <span className="referral-box-title">أسباب الإحالة</span>
                            <p className="leading-relaxed p-2">{referralToPrint.reason}</p>
                            {referralToPrint.notes && <p className="mt-2 text-sm text-gray-600 p-2 border-t border-gray-300">ملاحظات: {referralToPrint.notes}</p>}
                        </div>

                        <div className="referral-box">
                            <span className="referral-box-title">مرئيات الموجه الطلابي</span>
                            <div className="min-h-[100px] p-2">
                                {referralToPrint.outcome ? (
                                    <p className="leading-relaxed">{referralToPrint.outcome}</p>
                                ) : (
                                    <p className="text-gray-400 italic text-center mt-8">لا يوجد رد مسجل في النظام حتى الآن.</p>
                                )}
                            </div>
                        </div>

                        <div className="referral-box">
                            <span className="referral-box-title">الإجراء الإداري / القرار</span>
                            <div className="min-h-[60px] p-2 font-bold">
                                {referralToPrint.status === 'resolved' ? (
                                    <p>تم إنهاء الحالة واعتماد الإجراءات.</p>
                                ) : '...........................................................................................'}
                            </div>
                        </div>

                        <div className="footer-signatures">
                            <div className="signature-box"><p className="signature-title">الموجه الطلابي</p><p>.............................</p></div>
                            <div className="signature-box"><p className="signature-title">وكيل شؤون الطلاب</p><p>{currentUser?.name}</p></div>
                            <div className="signature-box"><p className="signature-title">مدير المدرسة</p><p>.............................</p></div>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. ABSENCE REFERRAL FORM (NEW) */}
            {printMode === 'absence_referral' && studentToPrint && (
                <div>
                    <OfficialHeader schoolName={SCHOOL_NAME} subTitle="وكالة شؤون الطلاب" />
                    <div className="mt-6 px-4 relative z-10">
                        <h1 className="official-title">إحالة طالب للموجه (بسبب الغياب)</h1>
                        
                        <div className="mt-4 text-lg font-medium leading-loose text-justify">
                            <p>المكرم الموجه الطلابي.. وفقه الله</p>
                            <p>السلام عليكم ورحمة الله وبركاته،،،</p>
                            <p>نحيل إليكم الطالب: <strong>{studentToPrint.name}</strong> بالصف: <strong>{studentToPrint.grade} - {studentToPrint.className}</strong></p>
                            <p>وذلك نظراً لتكرار غيابه في الأيام التالية:</p>
                            
                            <div className="my-4 border border-black p-2">
                                <ul className="list-disc list-inside grid grid-cols-3 gap-2 text-sm">
                                    {absenceDatesToPrint.map(d => <li key={d} className="font-mono">{d}</li>)}
                                </ul>
                            </div>

                            <p>آملين منكم دراسة حالة الطالب، ومعرفة أسباب الغياب، واتخاذ الإجراءات التربوية والإرشادية المناسبة للحد من هذه الظاهرة.</p>
                        </div>

                        <div className="mt-8 border border-black p-4 min-h-[150px]">
                            <p className="font-bold border-b border-gray-300 pb-2 mb-2">مرئيات الموجه الطلابي:</p>
                            <p className="text-gray-400">...................................................................................................................</p>
                            <p className="text-gray-400 mt-4">...................................................................................................................</p>
                        </div>

                        <div className="footer-signatures">
                            <div className="signature-box"><p className="signature-title">وكيل شؤون الطلاب</p><p>{currentUser?.name}</p></div>
                            <div className="signature-box"><p className="signature-title">مدير المدرسة</p><p>.............................</p></div>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. PARENT ABSENCE NOTICE (NEW) */}
            {printMode === 'absence_notice' && studentToPrint && (
                <div>
                    <OfficialHeader schoolName={SCHOOL_NAME} subTitle="وكالة شؤون الطلاب - شؤون الطلاب" />
                    <div className="mt-6 px-4 relative z-10">
                        <h1 className="official-title">إشعار غياب طالب</h1>
                        
                        <div className="mt-6 text-lg leading-loose font-medium text-justify">
                            <p>المكرم ولي أمر الطالب: <strong>{studentToPrint.name}</strong></p>
                            <p>الصف: <strong>{studentToPrint.grade}</strong> الفصل: <strong>{studentToPrint.className}</strong></p>
                            <p className="mt-4">السلام عليكم ورحمة الله وبركاته،،،</p>
                            <p>نفيدكم بأن ابنكم قد تغيب عن المدرسة في الأيام الموضحة أدناه دون عذر مقبول:</p>
                            
                            <div className="my-6">
                                <table className="w-full border-collapse border border-black text-center text-sm">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border border-black p-2">م</th>
                                            <th className="border border-black p-2">تاريخ الغياب</th>
                                            <th className="border border-black p-2">اليوم</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {absenceDatesToPrint.map((d, i) => (
                                            <tr key={i}>
                                                <td className="border border-black p-2">{i + 1}</td>
                                                <td className="border border-black p-2 font-mono">{d}</td>
                                                <td className="border border-black p-2">{new Date(d).toLocaleDateString('ar-SA', {weekday: 'long'})}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <p>وحيث أن هذا الغياب يؤثر سلباً على مستواه الدراسي وسلوكه، نأمل منكم التكرم بإيضاح مبررات الغياب أو الحضور للمدرسة لمناقشة وضع الطالب.</p>
                            <p className="text-center mt-8 font-bold">شاكرين اهتمامكم وتعاونكم،،،</p>
                        </div>

                        <div className="footer-signatures">
                            <div className="signature-box"><p className="signature-title">استلمت الإشعار (ولي الأمر)</p><p>.............................</p></div>
                            <div className="signature-box"><p className="signature-title">وكيل شؤون الطلاب</p><p>{currentUser?.name}</p></div>
                            <div className="signature-box"><p className="signature-title">مدير المدرسة</p><p>.............................</p></div>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. OFFICIAL DAILY POSITIVE REPORT (New) */}
            {printMode === 'positive_daily_report' && (
                <div>
                    <OfficialHeader schoolName={SCHOOL_NAME} subTitle="لجنة التوجيه الطلابي" />
                    <h1 className="official-title">تقرير التميز السلوكي اليومي</h1>
                    <p className="text-center font-bold text-lg mb-4">التاريخ: {reportDate}</p>
                    
                    <table className="w-full text-right border-collapse border border-black text-sm mt-4">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black p-2 w-10">م</th>
                                <th className="border border-black p-2">اسم الطالب</th>
                                <th className="border border-black p-2">الصف / الفصل</th>
                                <th className="border border-black p-2">مجال التميز / السلوك</th>
                                <th className="border border-black p-2 w-20">الدرجة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPositiveObservations.length > 0 ? filteredPositiveObservations.map((obs, idx) => {
                                // Extract reason and points
                                const text = obs.content.replace('تعزيز سلوكي: ', '');
                                const pointsMatch = text.match(/\((\d+) درجات\)/);
                                const points = pointsMatch ? pointsMatch[1] : '-';
                                const cleanReason = text.replace(/\(\d+ درجات\)/, '').trim();

                                return (
                                <tr key={idx}>
                                    <td className="border border-black p-2 text-center">{idx + 1}</td>
                                    <td className="border border-black p-2 font-bold">{obs.studentName}</td>
                                    <td className="border border-black p-2">{obs.grade} - {obs.className}</td>
                                    <td className="border border-black p-2">{cleanReason}</td>
                                    <td className="border border-black p-2 text-center font-bold">{points}</td>
                                </tr>
                            )}) : <tr><td colSpan={5} className="border p-4 text-center">لا يوجد طلاب مسجلين اليوم</td></tr>}
                        </tbody>
                    </table>
                    <div className="footer-signatures">
                        <div className="signature-box"><p className="signature-title">وكيل شؤون الطلاب</p><p>{currentUser?.name}</p></div>
                        <div className="signature-box"><p className="signature-title">مدير المدرسة</p><p>.............................</p></div>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* --- APP UI --- */}
      {/* ... (Existing APP UI code remains unchanged) ... */}
      <div className="space-y-6 animate-fade-in pb-24 no-print relative min-h-screen">
        {/* ... (Existing code) ... */}
        {/* Just re-rendering the same UI as before, but the print section above is updated */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-red-50 to-transparent"></div>
            <div className="relative z-10">
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                    <div className="bg-red-100 p-2 rounded-xl text-red-600"><Briefcase size={28} /></div>
                    مكتب وكيل الشؤون الطلابية
                </h1>
                <p className="text-slate-500 mt-1 mr-14">المنصة المركزية لإدارة السلوك، الغياب، والإحالات.</p>
            </div>
            <div className="text-left hidden md:block">
                <p className="text-xs font-bold text-slate-400 uppercase">مستخدم حالياً</p>
                <p className="font-bold text-slate-800">{currentUser?.name}</p>
            </div>
        </div>

        {/* VIEW SWITCHER */}
        {activeView === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
                {/* Stats Cards */}
                <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-bold text-slate-400 uppercase">مخالفات اليوم</span>
                    <span className="text-3xl font-extrabold text-red-600 mt-1">{stats.todayViolations}</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-bold text-slate-400 uppercase">إحالاتي</span>
                    <span className="text-3xl font-extrabold text-blue-900 mt-1">{stats.myReferralsCount}</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-bold text-slate-400 uppercase">مؤشر الخطر</span>
                    <span className="text-3xl font-extrabold text-amber-600 mt-1">{stats.atRiskCount}</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-bold text-slate-400 uppercase">حالات عولجت</span>
                    <span className="text-3xl font-extrabold text-emerald-600 mt-1">{stats.resolvedReferrals}</span>
                </div>

                {/* Quick Chart */}
                <div className="md:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-blue-500"/> أكثر السلوكيات تكراراً</h3>
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.chartData} barSize={40}>
                                <XAxis dataKey="name" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{fill: '#f8fafc'}} />
                                <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        )}

        {/* VIEW: ATTENDANCE MONITOR */}
        {activeView === 'attendance' && (
            <AttendanceMonitor onPrintAction={handlePrintAttendanceAction} />
        )}

        {/* VIEW: REFERRALS TRACKING (UPDATED) */}
        {activeView === 'referrals' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><GitCommit size={18}/> تتبع الإحالات المرسلة للموجه</h3>
                </div>
                {referrals.filter(r => r.referredBy === 'deputy').length === 0 ? (
                    <p className="text-center py-10 text-slate-400">لا يوجد إحالات مرسلة.</p>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {referrals.filter(r => r.referredBy === 'deputy').map(ref => {
                            const isResolved = ref.status === 'resolved';
                            const hasReply = ref.outcome || ref.status === 'returned_to_deputy';
                            
                            return (
                            <div key={ref.id} className="p-6 hover:bg-slate-50 transition-colors group">
                                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h4 className="font-bold text-lg text-slate-900">{ref.studentName}</h4>
                                            <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">{ref.grade}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                                            <AlertCircle size={14} className="text-slate-400" />
                                            {ref.reason}
                                        </div>
                                        
                                        {/* Visual Workflow Status */}
                                        <div className="flex items-center w-full max-w-md relative">
                                            {/* Line */}
                                            <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-10"></div>
                                            <div className={`absolute top-1/2 left-0 h-1 bg-emerald-500 -z-10 transition-all duration-500`} style={{width: isResolved ? '100%' : hasReply ? '50%' : '0%'}}></div>

                                            {/* Steps */}
                                            <div className="flex justify-between w-full">
                                                {/* Step 1: Sent */}
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm z-10"><Check size={14} /></div>
                                                    <span className="text-[10px] font-bold text-emerald-600">تم الإرسال</span>
                                                </div>
                                                
                                                {/* Step 2: Counselor Reply */}
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm z-10 border-2 ${hasReply ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-300 border-slate-200'}`}>
                                                        {hasReply ? <Check size={14} /> : <span className="text-xs">2</span>}
                                                    </div>
                                                    <span className={`text-[10px] font-bold ${hasReply ? 'text-emerald-600' : 'text-slate-400'}`}>رد الموجه</span>
                                                </div>

                                                {/* Step 3: Decision */}
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm z-10 border-2 ${isResolved ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-300 border-slate-200'}`}>
                                                        {isResolved ? <Check size={14} /> : <span className="text-xs">3</span>}
                                                    </div>
                                                    <span className={`text-[10px] font-bold ${isResolved ? 'text-emerald-600' : 'text-slate-400'}`}>القرار (إغلاق)</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-col gap-2 w-full md:w-auto mt-4 md:mt-0">
                                        <button onClick={() => handlePrintReferral(ref)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center justify-center gap-2 w-full">
                                            <Printer size={14}/> طباعة التقرير
                                        </button>
                                        
                                        {!isResolved && hasReply && (
                                            <button onClick={() => handleOpenCloseModal(ref)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-sm animate-pulse w-full">
                                                <Gavel size={14}/> قرار الوكيل وإغلاق
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Counselor Outcome Box */}
                                {ref.outcome && (
                                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-sm mt-5 relative">
                                        <div className="absolute top-0 right-4 -mt-2 bg-white px-2 text-xs font-bold text-purple-700 border border-purple-100 rounded">رد الموجه الطلابي</div>
                                        <p className="text-slate-700 leading-relaxed mt-1">{ref.outcome}</p>
                                    </div>
                                )}
                            </div>
                        )})}
                    </div>
                )}
            </div>
        )}

        {/* VIEW: POSITIVE BEHAVIOR (Updated) */}
        {activeView === 'positive' && (
            <div className="animate-fade-in space-y-6">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-8 text-white relative overflow-hidden shadow-lg">
                    <div className="relative z-10 flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2"><Medal size={28} className="text-amber-300"/> سجل السلوك الإيجابي</h2>
                            <p className="text-emerald-100 opacity-90">رصد التميز وطباعة تقارير رسمية يومية.</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handlePrintPositiveDailyReport} className="bg-white/20 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/30 transition-all flex items-center gap-2">
                                <Printer size={20}/> طباعة تقرير يومي
                            </button>
                            <button onClick={() => { resetForm(); setShowPositiveModal(true); }} className="bg-white text-emerald-700 px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-50 transition-all flex items-center gap-2">
                                <Plus size={20}/> تسجيل تميز جديد
                            </button>
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-10 -mt-10"></div>
                </div>
                
                {/* List of recent positive observations */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800 text-sm uppercase">قائمة الطلاب المكرمين</h3>
                            <input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)} className="bg-white border px-2 py-1 rounded text-sm"/>
                        </div>
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold">{filteredPositiveObservations.length}</span>
                    </div>
                    
                    {filteredPositiveObservations.length === 0 ? (
                        <div className="text-center text-slate-400 py-10">
                            <Star size={40} className="mx-auto mb-2 opacity-30"/>
                            <p>لم يتم تسجيل أي سلوك إيجابي في هذا التاريخ.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {filteredPositiveObservations.map(obs => (
                                <div key={obs.id} className="p-4 hover:bg-emerald-50/30 transition-colors flex justify-between items-center group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-sm">
                                            {obs.studentName.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800">{obs.studentName}</h4>
                                            <p className="text-xs text-slate-500">{obs.grade} - {obs.className}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-4">
                                        <div>
                                            <div className="text-sm text-emerald-700 font-bold mb-1">{obs.content.replace('تعزيز سلوكي: ', '')}</div>
                                            <div className="text-xs text-slate-400 font-mono">{obs.date}</div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEditPositive(obs)} className="p-2 text-blue-400 hover:bg-blue-50 rounded"><Edit size={16}/></button>
                                            <button onClick={() => handleDeletePositive(obs.id)} className="p-2 text-red-400 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* VIEW: VIOLATIONS LOG */}
        {activeView === 'log' && (
            <div className="space-y-4 animate-fade-in">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                        <input value={search} onChange={e=>setSearch(e.target.value)} className="w-full p-3 pr-10 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-red-100" placeholder="بحث باسم الطالب..."/>
                    </div>
                </div>
                <div className="grid gap-3">
                    {records.filter(r => r.studentName.includes(search)).map(rec => (
                        <div key={rec.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h4 className="font-bold text-slate-800 text-lg">{rec.studentName}</h4>
                                        <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded font-bold border border-red-100">{rec.violationName}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-1"><span className="font-bold">الإجراء:</span> {rec.actionTaken}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">{rec.date}</p>
                                </div>
                                
                                <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handlePrintViolationAction(rec, 'commitment')} className="bg-slate-50 text-slate-600 p-2 rounded-lg hover:bg-slate-100 border border-slate-200" title="طباعة تعهد">
                                        <FileText size={16}/>
                                    </button>
                                    <button onClick={() => handlePrintViolationAction(rec, 'summons')} className="bg-slate-50 text-slate-600 p-2 rounded-lg hover:bg-slate-100 border border-slate-200" title="طباعة استدعاء">
                                        <Phone size={16}/>
                                    </button>
                                    <button onClick={() => handleCreateReferralFromRecord(rec)} className="bg-purple-50 text-purple-600 p-2 rounded-lg hover:bg-purple-100 border border-purple-200" title="إحالة للموجه">
                                        <Forward size={16}/>
                                    </button>
                                    <div className="w-px h-6 bg-slate-200 mx-1"></div>
                                    <button onClick={()=>deleteBehaviorRecord(rec.id).then(fetchData)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* FLOATING DOCK */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md p-2 rounded-2xl shadow-2xl border border-slate-700 flex gap-2 z-40 transition-all hover:scale-105 floating-dock">
            {([
                { id: 'dashboard', icon: LayoutGrid, label: 'الرئيسية', color: 'text-blue-400' },
                { id: 'attendance', icon: Activity, label: 'متابعة الغياب', color: 'text-orange-400' },
                { id: 'add', icon: FileWarning, label: 'رصد مخالفة', color: 'text-red-400' },
                { id: 'positive', icon: Star, label: 'سلوك إيجابي', color: 'text-yellow-400' },
                { id: 'referrals', icon: GitCommit, label: 'الإحالات', color: 'text-purple-400' },
                { id: 'log', icon: List, label: 'السجل', color: 'text-slate-400' },
            ] as const).map(btn => (
                <button
                    key={btn.id}
                    onClick={() => {
                        if ((btn.id as string) === 'add') {
                            setViolationStep('form');
                            setShowViolationModal(true);
                        }
                        else setActiveView(btn.id as any);
                    }}
                    className={`p-3 rounded-xl transition-all relative group ${(activeView as string) === btn.id && (btn.id as string) !== 'add' ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    title={btn.label}
                >
                    <btn.icon size={24} className={btn.color} />
                    <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        {btn.label}
                    </span>
                    {(activeView as string) === btn.id && (btn.id as string) !== 'add' && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full"></div>}
                </button>
            ))}
        </div>

        {/* ... (Modals remain unchanged) ... */}
        {showCloseModal && referralToClose && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                    <div className="p-6 bg-emerald-600 text-white flex justify-between items-center">
                        <h2 className="text-xl font-bold flex items-center gap-2"><Gavel size={24}/> اتخاذ القرار وإغلاق الحالة</h2>
                        <button onClick={() => setShowCloseModal(false)} className="bg-white/20 p-2 rounded-full hover:bg-white/30"><X size={20}/></button>
                    </div>
                    
                    <div className="p-6 space-y-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
                            <p className="font-bold text-slate-500 mb-1">توصية الموجه الطلابي:</p>
                            <p className="text-slate-800">{referralToClose.outcome || 'لا يوجد توصية مكتوبة.'}</p>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-emerald-800 uppercase block mb-2">قرار الوكيل النهائي</label>
                            <textarea 
                                value={closeDecision} 
                                onChange={e => setCloseDecision(e.target.value)}
                                className="w-full p-4 border border-emerald-200 rounded-xl min-h-[150px] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="اكتب القرار الإداري هنا..."
                            ></textarea>
                            
                            <div className="flex justify-between mt-2">
                                <button 
                                    onClick={handleImproveDecision} 
                                    disabled={isImprovingDecision}
                                    className="text-xs flex items-center gap-1 text-purple-600 font-bold bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors"
                                >
                                    {isImprovingDecision ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12}/>} 
                                    إنشاء صيغة رسمية (AI)
                                </button>
                            </div>
                        </div>

                        <button 
                            onClick={handleFinalizeReferral}
                            className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 shadow-lg flex items-center justify-center gap-2 mt-4"
                        >
                            <CheckCircle size={20}/> اعتماد القرار وإغلاق
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: ADD VIOLATION (With Improved UI & Smart Actions & GRIDS) */}
        {showViolationModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
                    {/* ... (Same Form Content as before) ... */}
                    {/* Re-implementing just the critical parts to match structure */}
                    <div className="bg-white border-b border-slate-100 p-5 flex justify-between items-center shrink-0">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <span className="bg-red-50 text-red-600 p-2 rounded-xl"><FileWarning size={20}/></span>
                                رصد مخالفة سلوكية
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">تسجيل واقعة واتخاذ الإجراء النظامي</p>
                        </div>
                        <button onClick={() => setShowViolationModal(false)} className="bg-slate-50 p-2 rounded-full text-slate-400 hover:bg-slate-100"><X size={20}/></button>
                    </div>
                    
                    {violationStep === 'form' && (
                        <form onSubmit={handleViolationSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-8 bg-slate-50/50">
                            {/* ... Student Selection ... */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block flex items-center gap-2"><User size={14}/> بيانات الطالب</label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="relative">
                                        <select required className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-100 outline-none" value={formGrade} onChange={e=>{setFormGrade(e.target.value); setFormClass(''); setSelectedStudentId('');}}>
                                            <option value="">الصف</option>{GRADES.map(g=><option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                    <div className="relative">
                                        <select required disabled={!formGrade} className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-100 outline-none disabled:opacity-50" value={formClass} onChange={e=>{setFormClass(e.target.value); setSelectedStudentId('');}}>
                                            <option value="">الفصل</option>{availableClasses.map(c=><option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="relative">
                                        <select required disabled={!formClass} className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-sm focus:ring-2 focus:ring-blue-100 outline-none disabled:opacity-50" value={selectedStudentId} onChange={e=>setSelectedStudentId(e.target.value)}>
                                            <option value="">اختر الطالب</option>{availableStudents.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* ... Violation Grids (UPDATED TO SQUARE GRID ON MOBILE) ... */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block flex items-center gap-2"><ShieldAlert size={14}/> تصنيف المخالفة</label>
                                {/* Degree Selection: Grid for Mobile, Row for Desktop */}
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:flex gap-2 mb-4">
                                    {BEHAVIOR_VIOLATIONS.map((v, idx) => {
                                        const isActive = selectedDegree === v.degree;
                                        let activeClass = 'bg-slate-800 text-white';
                                        if (idx === 0) activeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                                        if (idx === 1) activeClass = 'bg-blue-100 text-blue-800 border-blue-200';
                                        if (idx === 2) activeClass = 'bg-amber-100 text-amber-800 border-amber-200';
                                        if (idx >= 3) activeClass = 'bg-red-100 text-red-800 border-red-200';
                                        
                                        return (
                                            <button 
                                                type="button" 
                                                key={v.degree} 
                                                onClick={()=>{setSelectedDegree(v.degree); setSelectedViolation(''); setActionTaken('');}} 
                                                className={`px-4 py-3 md:py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center text-center ${isActive ? `${activeClass} shadow-sm transform scale-105 ring-2 ring-offset-1` : 'bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100'}`}
                                            >
                                                {v.degree}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-bold mb-2 block uppercase">نوع المخالفة</label>
                                        {/* Violation Items Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-1">
                                            {BEHAVIOR_VIOLATIONS.find(v => v.degree === selectedDegree)?.violations.map((violation) => {
                                                const isSelected = selectedViolation === violation;
                                                const degreeIdx = BEHAVIOR_VIOLATIONS.findIndex(v => v.degree === selectedDegree);
                                                let activeBg = 'bg-slate-800';
                                                if (degreeIdx === 0) activeBg = 'bg-emerald-600';
                                                else if (degreeIdx === 1) activeBg = 'bg-blue-600';
                                                else if (degreeIdx === 2) activeBg = 'bg-amber-600';
                                                else activeBg = 'bg-red-600';

                                                return (
                                                    <button
                                                        key={violation}
                                                        type="button"
                                                        onClick={() => setSelectedViolation(violation)}
                                                        className={`p-3 rounded-xl text-xs font-bold text-right transition-all border shadow-sm flex items-center justify-between group
                                                            ${isSelected 
                                                                ? `${activeBg} text-white border-transparent ring-2 ring-offset-1 ring-slate-200` 
                                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                            }
                                                        `}
                                                    >
                                                        <span className="leading-relaxed">{violation}</span>
                                                        {isSelected && <CheckCircle size={16} className="text-white shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    
                                    <div className="pt-4 border-t border-slate-100">
                                        <label className="text-[10px] text-slate-400 font-bold mb-2 block uppercase flex items-center gap-1"><HammerIcon size={12}/> الإجراء المتخذ (نظاماً)</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {BEHAVIOR_VIOLATIONS.find(v => v.degree === selectedDegree)?.actions.map((action, idx) => {
                                                const isSelected = actionTaken === action;
                                                return (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => setActionTaken(action)}
                                                        className={`p-3 rounded-xl text-xs font-bold text-right transition-all border flex items-center justify-between
                                                            ${isSelected 
                                                                ? 'bg-slate-800 text-white border-slate-800 ring-2 ring-slate-200' 
                                                                : 'bg-slate-50 text-slate-600 border-transparent hover:bg-slate-100'
                                                            }
                                                        `}
                                                    >
                                                        <span className="leading-relaxed">{action}</span>
                                                        {isSelected && <CheckSquare size={16} className="text-white shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 shadow-lg shadow-slate-900/10 active:scale-95 transition-all">
                                {isEditing ? 'تحديث السجل' : 'حفظ المخالفة'}
                            </button>
                        </form>
                    )}

                    {violationStep === 'success' && lastSavedRecord && (
                        <div className="p-8 text-center space-y-8 animate-fade-in-up bg-white h-full flex flex-col justify-center">
                            <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-100 shadow-sm animate-pulse">
                                <CheckCircle size={48} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900">تم الحفظ بنجاح</h3>
                                <p className="text-slate-500 mt-2 text-sm">بناءً على الإجراء المختار "{lastSavedRecord.actionTaken}"، يمكنك:</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(() => {
                                    const actionText = lastSavedRecord.actionTaken || '';
                                    const showPledge = actionText.includes('تعهد');
                                    const showSummons = actionText.includes('استدعاء') || actionText.includes('ولي أمر') || actionText.includes('ولي الامر');
                                    return (
                                        <>
                                            {(showPledge || (!showPledge && !showSummons)) && (
                                                <button onClick={() => handlePrintViolationAction(lastSavedRecord, 'commitment')} className="flex flex-col items-center justify-center p-5 bg-blue-50 border-2 border-blue-100 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all group">
                                                    <div className="bg-white p-3 rounded-full text-blue-600 mb-2 shadow-sm group-hover:scale-110 transition-transform"><FileText size={24}/></div>
                                                    <span className="font-bold text-blue-900 text-sm">طباعة تعهد خطي</span>
                                                </button>
                                            )}
                                            {(showSummons || (!showPledge && !showSummons)) && (
                                                <button onClick={() => handlePrintViolationAction(lastSavedRecord, 'summons')} className="flex flex-col items-center justify-center p-5 bg-red-50 border-2 border-red-100 rounded-2xl hover:border-red-500 hover:shadow-md transition-all group">
                                                    <div className="bg-white p-3 rounded-full text-red-600 mb-2 shadow-sm group-hover:scale-110 transition-transform"><Phone size={24}/></div>
                                                    <span className="font-bold text-red-900 text-sm">طباعة استدعاء ولي أمر</span>
                                                </button>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>

                            <button onClick={() => handleCreateReferralFromRecord(lastSavedRecord)} className="w-full py-4 bg-purple-50 text-purple-700 border border-purple-100 rounded-2xl font-bold hover:bg-purple-100 hover:border-purple-200 flex items-center justify-center gap-3 transition-all">
                                <Forward size={20}/> تحويل للموجه الطلابي (إجراء إضافي)
                            </button>

                            <div className="pt-4">
                                <button onClick={() => { setShowViolationModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600 text-sm font-bold flex items-center justify-center gap-2 mx-auto">
                                    إغلاق النافذة <ChevronRight size={14}/>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* MODAL: POSITIVE BEHAVIOR */}
        {showPositiveModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-900/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white flex justify-between items-center shrink-0">
                        <h2 className="text-xl font-bold flex items-center gap-2"><Star size={24} className="text-yellow-300"/> {isEditingPositive ? 'تعديل السلوك الإيجابي' : 'تسجيل سلوك إيجابي'}</h2>
                        <button onClick={() => setShowPositiveModal(false)} className="bg-white/20 p-2 rounded-full hover:bg-white/30"><X size={20}/></button>
                    </div>
                    <form onSubmit={handlePositiveSubmit} className="p-6 space-y-6">
                        {!isEditingPositive && (
                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                <label className="text-xs font-bold text-emerald-800 uppercase block mb-2">اختر الطالب</label>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <select className="p-2 rounded-lg text-sm" value={formGrade} onChange={e=>{setFormGrade(e.target.value); setFormClass('');}}><option value="">الصف</option>{GRADES.map(g=><option key={g} value={g}>{g}</option>)}</select>
                                    <select disabled={!formGrade} className="p-2 rounded-lg text-sm" value={formClass} onChange={e=>{setFormClass(e.target.value);}}><option value="">الفصل</option>{availableClasses.map(c=><option key={c} value={c}>{c}</option>)}</select>
                                </div>
                                <select required disabled={!formClass} className="w-full p-3 bg-white border border-emerald-200 rounded-xl font-bold text-sm" value={selectedStudentId} onChange={e=>setSelectedStudentId(e.target.value)}>
                                    <option value="">-- الطالب --</option>{availableStudents.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">سبب التكريم</label><input required value={positiveReason} onChange={e=>setPositiveReason(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" placeholder="مثال: تحسن دراسي، أمانة..."/></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">الدرجة المستحقة (نقاط)</label><input type="number" required value={positivePoints} onChange={e=>setPositivePoints(Number(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"/></div>
                        <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 shadow-lg flex items-center justify-center gap-2">
                            <CheckCircle size={20}/> {isEditingPositive ? 'حفظ التعديلات' : 'حفظ السجل'}
                        </button>
                    </form>
                </div>
            </div>
        )}

      </div>
    </>
  );
};

export default StaffDeputy;
