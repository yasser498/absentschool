
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Briefcase, AlertTriangle, Plus, Search, Loader2, X, Send, Sparkles, 
  User, FileWarning, Check, BarChart2, Printer, TrendingUp, Filter, 
  Trash2, Edit, ArrowRight, LayoutGrid, FileText, School, Inbox, ChevronLeft,
  Calendar, AlertCircle, PieChart as PieIcon, List, Activity, ShieldAlert, Gavel, Forward, CheckCircle, Phone, Clock,
  Medal, Star, ClipboardList, GitCommit, Eye, ArrowUpRight, CheckSquare, FileBadge, PenTool, Wand2, ChevronRight, Gavel as HammerIcon,
  AlertOctagon, History, Trophy, MessageCircle, MoreHorizontal, UserX, UserCheck, Flame
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
  deleteStudentObservation,
  getAttendanceRecords
} from '../../services/storage';
import { Student, BehaviorRecord, StaffUser, Referral, StudentObservation, AttendanceRecord, AttendanceStatus } from '../../types';
import { BEHAVIOR_VIOLATIONS, GRADES } from '../../constants';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
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
  
  // Data for stats
  const [allObservations, setAllObservations] = useState<StudentObservation[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

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
  const [printMode, setPrintMode] = useState<'none' | 'commitment' | 'summons' | 'certificate' | 'referral_report' | 'positive_log' | 'positive_daily_report' | 'absence_referral' | 'absence_notice' | 'daily_violation_report' | 'full_violation_log'>('none');
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
      const [s, r, refs, risks, obs, att] = await Promise.all([
        getStudents(), 
        getBehaviorRecords(),
        getReferrals(),
        getConsecutiveAbsences(),
        getStudentObservations(),
        getAttendanceRecords()
      ]);
      setStudents(s);
      setRecords(r);
      setReferrals(refs); 
      setRiskList(risks);
      setAllObservations(obs);
      setAttendanceRecords(att);
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

      // --- Chart Data ---
      const typeCounts: Record<string, number> = {};
      const degreeCounts: Record<string, number> = {};
      
      records.forEach(r => {
          typeCounts[r.violationName] = (typeCounts[r.violationName] || 0) + 1;
          degreeCounts[r.violationDegree] = (degreeCounts[r.violationDegree] || 0) + 1;
      });

      const pieData = Object.entries(typeCounts)
          .map(([name, value]) => ({ name, value }))
          .sort((a,b) => b.value - a.value)
          .slice(0, 5); // Top 5 violations

      const barData = Object.entries(degreeCounts)
          .map(([name, value]) => ({ name, value }))
          .sort((a,b) => a.name.localeCompare(b.name));

      // Recent Activity
      const recentActivity = [...records].sort((a,b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()).slice(0, 5);

      // --- DETAILED STATS (TOP 10s) ---
      
      // Init Maps
      const studentMetrics: Record<string, { 
          name: string, grade: string, className: string, 
          absent: number, late: number, violations: number, 
          notes: number, positive: number 
      }> = {};

      const classMetrics: Record<string, { 
          name: string, absent: number, late: number, count: number 
      }> = {};

      // 1. Process Attendance
      attendanceRecords.forEach(r => {
          const classKey = `${r.grade} - ${r.className}`;
          if (!classMetrics[classKey]) classMetrics[classKey] = { name: classKey, absent: 0, late: 0, count: 0 };
          classMetrics[classKey].count++; // Just to know record count

          r.records.forEach(stu => {
              if (!studentMetrics[stu.studentId]) {
                  studentMetrics[stu.studentId] = { 
                      name: stu.studentName, grade: r.grade, className: r.className,
                      absent: 0, late: 0, violations: 0, notes: 0, positive: 0
                  };
              }

              if (stu.status === AttendanceStatus.ABSENT) {
                  studentMetrics[stu.studentId].absent++;
                  classMetrics[classKey].absent++;
              } else if (stu.status === AttendanceStatus.LATE) {
                  studentMetrics[stu.studentId].late++;
                  classMetrics[classKey].late++;
              }
          });
      });

      // 2. Process Violations
      records.forEach(r => {
          if (!studentMetrics[r.studentId]) {
              studentMetrics[r.studentId] = { 
                  name: r.studentName, grade: r.grade, className: r.className,
                  absent: 0, late: 0, violations: 0, notes: 0, positive: 0
              };
          }
          studentMetrics[r.studentId].violations++;
      });

      // 3. Process Observations
      allObservations.forEach(o => {
          if (!studentMetrics[o.studentId]) {
              studentMetrics[o.studentId] = { 
                  name: o.studentName, grade: o.grade, className: o.className,
                  absent: 0, late: 0, violations: 0, notes: 0, positive: 0
              };
          }
          if (o.type === 'positive') studentMetrics[o.studentId].positive++;
          else studentMetrics[o.studentId].notes++;
      });

      // Convert to Sorted Arrays
      const topAbsent = Object.values(studentMetrics).sort((a,b) => b.absent - a.absent).filter(s => s.absent > 0).slice(0, 10);
      const topLate = Object.values(studentMetrics).sort((a,b) => b.late - a.late).filter(s => s.late > 0).slice(0, 10);
      const topViolators = Object.values(studentMetrics).sort((a,b) => b.violations - a.violations).filter(s => s.violations > 0).slice(0, 10);
      const topNoted = Object.values(studentMetrics).sort((a,b) => b.notes - a.notes).filter(s => s.notes > 0).slice(0, 10);
      const topExcellent = Object.values(studentMetrics).sort((a,b) => b.positive - a.positive).filter(s => s.positive > 0).slice(0, 10);
      
      const topAbsentClasses = Object.values(classMetrics).sort((a,b) => b.absent - a.absent).slice(0, 5);
      const topLateClasses = Object.values(classMetrics).sort((a,b) => b.late - a.late).slice(0, 5);

      // New: Students at Risk (> 5 absences)
      const studentsAtRisk = Object.values(studentMetrics)
        .filter(s => s.absent >= 5)
        .sort((a,b) => b.absent - a.absent)
        .slice(0, 10);

      return { 
          totalViolations, 
          todayViolations, 
          atRiskCount, 
          myReferralsCount: myReferrals.length, 
          resolvedReferrals, 
          pieData, 
          barData,
          recentActivity,
          topAbsent,
          topLate,
          topViolators,
          topNoted,
          topExcellent,
          topAbsentClasses,
          topLateClasses,
          studentsAtRisk
      };
  }, [records, riskList, referrals, allObservations, attendanceRecords]);

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

  const handleDeleteViolation = async (id: string) => {
      if(!window.confirm("هل أنت متأكد من حذف هذه المخالفة نهائياً؟")) return;
      try {
          await deleteBehaviorRecord(id);
          fetchData(); // Refresh list
      } catch(e) {
          alert("حدث خطأ أثناء الحذف");
      }
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

  const handlePrintCertificate = (student: Student, reason: string) => {
      setStudentToPrint(student);
      setCertificateData({ reason });
      setPrintMode('certificate');
      setTimeout(() => { window.print(); setPrintMode('none'); }, 500);
  };

  const handlePrintDailyViolations = () => {
      setPrintMode('daily_violation_report');
      setTimeout(() => { window.print(); setPrintMode('none'); }, 300);
  };

  const handlePrintFullLog = () => {
      setPrintMode('full_violation_log');
      setTimeout(() => { window.print(); setPrintMode('none'); }, 300);
  };

  const filteredPositiveObservations = useMemo(() => {
      return allObservations.filter(obs => obs.type === 'positive' && obs.date === reportDate);
  }, [allObservations, reportDate]);

  // Reusable Top List Component (Enhanced)
  const TopListWidget = ({ title, icon: Icon, color, data, valueKey }: any) => (
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
          <div className={`flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 ${color.replace('text', 'text').replace('600', '700')}`}>
              <Icon size={18} />
              <h3 className="font-bold text-sm">{title}</h3>
          </div>
          <div className="flex-1 overflow-y-auto max-h-48 custom-scrollbar space-y-2 pr-1">
              {data.length === 0 ? <p className="text-center text-slate-400 text-xs py-4">لا يوجد بيانات.</p> : 
               data.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex flex-col">
                          <span className="font-bold text-slate-800 truncate max-w-[140px]">{item.name}</span>
                          {item.grade && <span className="text-slate-400 text-[10px]">{item.grade} - {item.className}</span>}
                      </div>
                      <span className={`font-extrabold px-2 py-0.5 rounded bg-white border ${color.replace('text-', 'border-').replace('600', '200')} ${color}`}>
                          {item[valueKey]}
                      </span>
                  </div>
              ))}
          </div>
      </div>
  );

  return (
    <>
      <div id="print-container" className="hidden print:block text-[14px] leading-relaxed" dir="rtl">
        {/* ... Print Logic Remains the same ... */}
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
            
            {/* ... Other Print Modes ... */}
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

                {/* --- DETAILED STATS (TOP 10 LISTS) --- */}
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><BarChart2 className="text-blue-600"/> التقارير والإحصائيات التفصيلية (الأكثر تسجيلاً)</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {/* Row 1: Student Lists */}
                    <TopListWidget title="أكثر 10 طلاب غياباً" icon={UserX} color="text-red-600" data={stats.topAbsent} valueKey="absent" />
                    <TopListWidget title="أكثر 10 طلاب تأخراً" icon={Clock} color="text-amber-600" data={stats.topLate} valueKey="late" />
                    <TopListWidget title="أكثر 10 طلاب مخالفات" icon={ShieldAlert} color="text-purple-600" data={stats.topViolators} valueKey="violations" />
                    
                    {/* NEW: Most Common Violations */}
                    <TopListWidget title="أكثر المخالفات شيوعاً" icon={List} color="text-pink-600" data={stats.pieData} valueKey="value" />
                    
                    {/* Row 2: Class Lists & Risk */}
                    <TopListWidget title="الفصول الأكثر غياباً" icon={School} color="text-red-700" data={stats.topAbsentClasses} valueKey="absent" />
                    <TopListWidget title="الفصول الأكثر تأخراً" icon={School} color="text-amber-700" data={stats.topLateClasses} valueKey="late" />
                    
                    {/* NEW: Students At Risk (Based on absence count > 5) */}
                    <TopListWidget title="مؤشر الخطر (غياب > 5)" icon={Flame} color="text-orange-600" data={stats.topAbsent.filter(s => s.absent >= 5)} valueKey="absent" />
                    
                    {/* Positive Behavior */}
                    <TopListWidget title="أفضل 10 طلاب تميزاً" icon={Medal} color="text-emerald-600" data={stats.topExcellent} valueKey="positive" />
                </div>

                {/* 2. Visual Analytics Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Pie Chart: Violation Types */}
                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm col-span-1 md:col-span-1 flex flex-col">
                        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><PieIcon size={16} className="text-blue-500"/> نسب توزيع المخالفات</h3>
                        <div className="flex-1 min-h-[250px]">
                            {stats.pieData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                            {stats.pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={['#ef4444', '#f97316', '#f59e0b', '#8b5cf6', '#3b82f6'][index % 5]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-center text-slate-400 mt-10">لا توجد بيانات كافية</p>
                            )}
                        </div>
                    </div>

                    {/* Bar Chart: Violation Degrees */}
                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm col-span-1 md:col-span-2 flex flex-col">
                        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><BarChart2 size={16} className="text-purple-500"/> تصنيف المخالفات (حسب الدرجة)</h3>
                        <div className="flex-1 min-h-[250px]">
                            {stats.barData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.barData} layout="vertical">
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                                        <Tooltip cursor={{fill: 'transparent'}} />
                                        <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-center text-slate-400 mt-10">لا توجد بيانات كافية</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. Recent Activity & Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Recent Activity Feed */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Activity size={18} className="text-emerald-500"/> آخر المستجدات (الآن)</h3>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                            {stats.recentActivity.length === 0 ? <p className="text-slate-400 text-sm">لا يوجد نشاط حديث.</p> : stats.recentActivity.map((act, idx) => (
                                <div key={idx} className="flex items-center justify-between pb-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 p-2 rounded-lg transition-colors group">
                                    <div className="flex items-start gap-3">
                                        <div className="bg-slate-100 p-2 rounded-full mt-1">
                                            <ShieldAlert size={14} className="text-slate-500"/>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{act.studentName} <span className="text-xs font-normal text-slate-400">({act.grade})</span></p>
                                            <p className="text-xs text-slate-600 mt-0.5">{act.violationName}</p>
                                            <span className="text-[10px] text-slate-400 block mt-1">{new Date(act.createdAt || '').toLocaleTimeString('ar-SA')}</span>
                                        </div>
                                    </div>
                                    {/* Delete Button for Recent Activity */}
                                    <button 
                                        onClick={() => handleDeleteViolation(act.id)} 
                                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                        title="حذف المخالفة"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Actions Grid */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Sparkles size={18} className="text-amber-500"/> الوصول السريع</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setShowViolationModal(true)} className="p-4 rounded-xl bg-red-50 text-red-700 font-bold text-sm flex flex-col items-center gap-2 hover:bg-red-100 transition-colors">
                                <Plus size={24}/> تسجيل مخالفة
                            </button>
                            <button onClick={() => setActiveView('attendance')} className="p-4 rounded-xl bg-orange-50 text-orange-700 font-bold text-sm flex flex-col items-center gap-2 hover:bg-orange-100 transition-colors">
                                <Clock size={24}/> متابعة الغياب
                            </button>
                            <button onClick={() => setActiveView('referrals')} className="p-4 rounded-xl bg-blue-50 text-blue-700 font-bold text-sm flex flex-col items-center gap-2 hover:bg-blue-100 transition-colors">
                                <GitCommit size={24}/> الإحالات
                            </button>
                            <button onClick={() => setActiveView('positive')} className="p-4 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-sm flex flex-col items-center gap-2 hover:bg-emerald-100 transition-colors">
                                <Star size={24}/> تكريم طالب
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* ... (Rest of views: attendance, log, positive, referrals - NO CHANGES) ... */}
        {activeView === 'attendance' && <AttendanceMonitor onPrintAction={handlePrintAttendanceAction} />}

        {activeView === 'log' && (
            <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-800">سجل المخالفات السلوكية</h2>
                    <div className="flex gap-2">
                        <button onClick={handlePrintDailyViolations} className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-xl font-bold flex items-center gap-2 text-xs hover:bg-slate-50"><Printer size={14}/> تقرير اليوم</button>
                        <button onClick={handlePrintFullLog} className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-xl font-bold flex items-center gap-2 text-xs hover:bg-slate-50"><Printer size={14}/> السجل الشامل</button>
                        <button onClick={() => setShowViolationModal(true)} className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm hover:bg-red-700"><Plus size={18}/> تسجيل مخالفة</button>
                    </div>
                </div>
                {records.length === 0 ? <p className="text-center py-10 text-slate-400">لا يوجد مخالفات مسجلة.</p> : (
                    <div className="space-y-4">
                        {records.map(rec => (
                            <div key={rec.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 relative group">
                                <div className="flex-1">
                                    <div className="flex justify-between mb-2">
                                        <h3 className="font-bold text-slate-900">{rec.studentName}</h3>
                                        <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 font-bold">{rec.violationDegree}</span>
                                    </div>
                                    <p className="text-sm font-bold text-red-700 mb-1">{rec.violationName}</p>
                                    <p className="text-xs text-slate-500">{rec.actionTaken}</p>
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg inline-block border border-slate-100">الإجراء: {rec.actionTaken}</p>
                                        
                                        {/* Updated: Parent Feedback Section */}
                                        {rec.parentFeedback && (
                                            <div className="flex items-start gap-2 bg-purple-50 p-2.5 rounded-xl border border-purple-100 mt-2 animate-fade-in">
                                                <MessageCircle size={16} className="text-purple-600 mt-0.5 shrink-0"/>
                                                <div className="flex-1">
                                                    <span className="text-[10px] font-bold text-purple-700 block mb-0.5">رد ولي الأمر (عبر البوابة):</span>
                                                    <p className="text-xs text-slate-700 leading-relaxed font-medium">{rec.parentFeedback}</p>
                                                    {rec.parentViewedAt && (
                                                        <span className="text-[9px] text-purple-400 mt-1 block">
                                                            تم الرد في: {new Date(rec.parentViewedAt).toLocaleDateString('ar-SA')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <button onClick={() => handlePrintViolationAction(rec, 'summons')} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200" title="استدعاء"><FileWarning size={16}/></button>
                                    <button onClick={() => handlePrintViolationAction(rec, 'commitment')} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200" title="تعهد"><FileText size={16}/></button>
                                    <button onClick={() => handleCreateReferralFromRecord(rec)} className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100" title="إحالة"><Forward size={16}/></button>
                                    {/* Delete Button in Log */}
                                    <button onClick={() => handleDeleteViolation(rec.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100" title="حذف المخالفة"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {activeView === 'positive' && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Star size={20} className="text-yellow-500"/> سجل التميز والسلوك الإيجابي</h2>
                    <button onClick={() => setShowPositiveModal(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all"><Plus size={18}/> تسجيل تميز</button>
                </div>

                {filteredPositiveObservations.length === 0 ? <p className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">لا يوجد سجلات تميز لهذا اليوم.</p> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredPositiveObservations.map(obs => (
                            <div key={obs.id} className="bg-white p-5 rounded-2xl border-l-4 border-emerald-500 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-emerald-50 p-2 rounded-full text-emerald-600"><Medal size={20}/></div>
                                        <div>
                                            <h3 className="font-bold text-slate-800">{obs.studentName}</h3>
                                            <p className="text-xs text-slate-500">{obs.grade} - {obs.className}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">{obs.date}</span>
                                </div>
                                <p className="text-sm text-slate-700 my-3 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">{obs.content.replace('تعزيز سلوكي: ', '').split('(')[0]}</p>
                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
                                    <button onClick={() => { const student = students.find(s => s.studentId === obs.studentId); if(student) handlePrintCertificate(student, obs.content.replace('تعزيز سلوكي: ', '').split('(')[0]); }} className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-900"><Printer size={12}/> شهادة شكر</button>
                                    <button onClick={() => handleDeletePositive(obs.id)} className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* REFERRALS TAB */}
        {activeView === 'referrals' && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><GitCommit size={20} className="text-blue-600"/> متابعة الإحالات للموجه الطلابي</h2>
                </div>
                
                {referrals.length === 0 ? <p className="text-center py-10 text-slate-400">لا يوجد إحالات مسجلة.</p> : (
                    <div className="space-y-3">
                        {referrals.map(ref => (
                            <div key={ref.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-3 border-b border-slate-50 pb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${ref.status === 'pending' ? 'bg-amber-100 text-amber-700' : ref.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {ref.studentName.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900">{ref.studentName}</h3>
                                            <p className="text-xs text-slate-500">{ref.grade} - {ref.className}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${ref.status === 'pending' ? 'bg-amber-100 text-amber-700' : ref.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {ref.status === 'pending' ? 'جديدة' : ref.status === 'in_progress' ? 'قيد المعالجة' : 'مغلقة'}
                                        </span>
                                        <p className="text-[10px] text-slate-400 mt-1 font-mono">{ref.referralDate}</p>
                                    </div>
                                </div>
                                <div className="text-sm text-slate-600 mb-3">
                                    <span className="font-bold text-slate-400 text-xs uppercase block mb-1">سبب الإحالة:</span>
                                    {ref.reason}
                                </div>
                                {ref.outcome && (
                                    <div className="bg-slate-50 p-3 rounded-xl text-sm border border-slate-100">
                                        <span className="font-bold text-blue-600 text-xs block mb-1">رد الموجه / الإجراء:</span>
                                        {ref.outcome}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* MODAL: POSITIVE BEHAVIOR */}
        {showPositiveModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Star className="text-emerald-500"/> تسجيل تميز سلوكي</h2>
                        <button onClick={() => { setShowPositiveModal(false); resetForm(); }} className="bg-slate-50 p-2 rounded-full text-slate-400 hover:text-red-500"><X size={20}/></button>
                    </div>
                    
                    <form onSubmit={handlePositiveSubmit} className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4">
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">بيانات الطالب</label>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <select value={formGrade} onChange={e => {setFormGrade(e.target.value); setFormClass('');}} className="w-full p-2 border rounded-lg text-sm font-bold bg-white"><option value="">الصف</option>{GRADES.map(g=><option key={g} value={g}>{g}</option>)}</select>
                                <select value={formClass} disabled={!formGrade} onChange={e => setFormClass(e.target.value)} className="w-full p-2 border rounded-lg text-sm font-bold bg-white"><option value="">الفصل</option>{availableClasses.map(c=><option key={c} value={c}>{c}</option>)}</select>
                            </div>
                            <select required value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} className="w-full p-2 border rounded-lg text-sm font-bold bg-white"><option value="">اختر الطالب...</option>{availableStudents.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">سبب التميز / السلوك الإيجابي</label>
                            <textarea 
                                value={positiveReason} 
                                onChange={e => setPositiveReason(e.target.value)} 
                                className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none" 
                                placeholder="مثال: المشاركة الفعالة، مساعدة الزملاء، الأمانة..."
                                rows={3}
                            ></textarea>
                        </div>

                        <div className="flex items-center justify-between bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                            <label className="text-sm font-bold text-emerald-800">نقاط التميز المضافة:</label>
                            <input type="number" min="1" max="50" value={positivePoints} onChange={e => setPositivePoints(parseInt(e.target.value))} className="w-16 text-center p-2 rounded-lg font-bold border border-emerald-200 outline-none focus:border-emerald-500"/>
                        </div>

                        <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2">
                            <CheckCircle size={18}/> حفظ التميز
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* MODAL: VIOLATION RECORDING (ENHANCED GRID LAYOUT) */}
        {showViolationModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl p-0 animate-fade-in-up flex flex-col max-h-[90vh] overflow-hidden">
                    {/* Modal Header */}
                    <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center">
                        <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2"><HammerIcon className="text-red-600"/> رصد مخالفة سلوكية</h2>
                        <button onClick={() => { setShowViolationModal(false); resetForm(); }} className="bg-white p-2 rounded-full text-slate-400 hover:text-red-500 shadow-sm"><X size={20}/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50">
                    {violationStep === 'form' ? (
                        <div className="flex flex-col gap-6">
                            
                            {/* 1. Student Selection */}
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><User size={14}/> بيانات الطالب</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <select value={formGrade} onChange={e => {setFormGrade(e.target.value); setFormClass('');}} className="p-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-100"><option value="">اختر الصف</option>{GRADES.map(g=><option key={g} value={g}>{g}</option>)}</select>
                                    <select value={formClass} disabled={!formGrade} onChange={e => setFormClass(e.target.value)} className="p-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-100 disabled:bg-slate-50"><option value="">اختر الفصل</option>{availableClasses.map(c=><option key={c} value={c}>{c}</option>)}</select>
                                    <select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} className="p-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-100 disabled:bg-slate-50" disabled={!formClass}><option value="">اختر الطالب...</option>{availableStudents.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
                                </div>
                            </div>

                            {/* 2. Degree Selection (Grid) */}
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><AlertOctagon size={14}/> درجة المخالفة</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                    {BEHAVIOR_VIOLATIONS.map((v) => {
                                        const isSelected = selectedDegree === v.degree;
                                        return (
                                            <button 
                                                key={v.degree} 
                                                onClick={() => { setSelectedDegree(v.degree); setSelectedViolation(''); setActionTaken(''); }} 
                                                className={`p-3 rounded-xl text-xs font-bold border-2 transition-all h-full flex items-center justify-center text-center ${isSelected ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-offset-2 ring-slate-200' : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-300'}`}
                                            >
                                                {v.degree}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 3. Violation Type & Action (Dynamic) */}
                            {selectedDegree && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><List size={14}/> نوع المخالفة</h3>
                                        <div className="flex-1 overflow-y-auto max-h-60 custom-scrollbar space-y-2 pr-1">
                                            {BEHAVIOR_VIOLATIONS.find(v => v.degree === selectedDegree)?.violations.map((v) => (
                                                <button 
                                                    key={v} 
                                                    onClick={() => setSelectedViolation(v)}
                                                    className={`w-full text-right p-3 rounded-xl text-xs font-bold border transition-all ${selectedViolation === v ? 'bg-red-50 text-red-800 border-red-200 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-white hover:border-red-200'}`}
                                                >
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><Gavel size={14}/> الإجراء النظامي</h3>
                                        <div className="flex-1 overflow-y-auto max-h-60 custom-scrollbar space-y-2 pr-1 mb-2">
                                            {BEHAVIOR_VIOLATIONS.find(v => v.degree === selectedDegree)?.actions.map((action, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setActionTaken(action)}
                                                    className={`w-full text-right p-3 rounded-xl text-[11px] font-bold border transition-all ${actionTaken === action ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-white hover:border-blue-200'}`}
                                                >
                                                    {action}
                                                </button>
                                            ))}
                                        </div>
                                        <textarea 
                                            value={actionTaken} 
                                            onChange={e => setActionTaken(e.target.value)} 
                                            className="w-full p-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-red-400 bg-slate-50" 
                                            placeholder="تخصيص الإجراء..."
                                            rows={2}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12 animate-fade-in flex flex-col items-center justify-center h-full">
                            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-inner animate-bounce-slow">
                                <CheckCircle size={48} />
                            </div>
                            <h3 className="text-3xl font-extrabold text-slate-900 mb-2">تم رصد المخالفة بنجاح</h3>
                            <p className="text-slate-500 mb-8 max-w-sm mx-auto">تم تحديث سجل الطالب. يمكنك الآن طباعة المستندات المطلوبة للإجراء.</p>
                            
                            <div className="flex flex-wrap gap-4 justify-center">
                                {/* Smart Print Buttons */}
                                {lastSavedRecord && (lastSavedRecord.actionTaken.includes('استدعاء') || lastSavedRecord.actionTaken.includes('ولي أمر')) && (
                                    <button onClick={() => handlePrintViolationAction(lastSavedRecord!, 'summons')} className="px-6 py-4 bg-white border-2 border-red-100 text-red-700 rounded-2xl font-bold flex items-center gap-2 hover:bg-red-50 transition-colors shadow-sm hover:shadow-md">
                                        <FileWarning size={20}/> طباعة استدعاء ولي أمر
                                    </button>
                                )}
                                {lastSavedRecord && (lastSavedRecord.actionTaken.includes('تعهد') || lastSavedRecord.actionTaken.includes('عقد')) && (
                                    <button onClick={() => handlePrintViolationAction(lastSavedRecord!, 'commitment')} className="px-6 py-4 bg-white border-2 border-blue-100 text-blue-700 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-50 transition-colors shadow-sm hover:shadow-md">
                                        <FileText size={20}/> طباعة تعهد خطي
                                    </button>
                                )}
                                <button onClick={() => { resetForm(); setShowViolationModal(false); }} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-colors shadow-lg">
                                    إنهاء وإغلاق
                                </button>
                            </div>
                        </div>
                    )}
                    </div>

                    {/* Modal Footer */}
                    {violationStep === 'form' && (
                        <div className="p-6 bg-white border-t border-slate-100 sticky bottom-0 z-10">
                            <button 
                                onClick={handleViolationSubmit} 
                                disabled={!actionTaken || !selectedStudentId} 
                                className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-red-700 shadow-xl shadow-red-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <HammerIcon size={20}/> حفظ المخالفة
                            </button>
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