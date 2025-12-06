import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, AlertTriangle, Phone, FileText, CheckCircle, Search, 
  Filter, Forward, CalendarDays, List, ShieldCheck, Loader2, Printer, FileWarning, Eye, CheckSquare, XCircle
} from 'lucide-react';
import { getStudents, getAttendanceRecords, addReferral, getRequests, resolveAbsenceAlert, getRiskHistory } from '../../services/storage';
import { Student, AttendanceRecord, Referral, ExcuseRequest } from '../../types';

interface AttendanceMonitorProps {
  onPrintAction?: (student: Student, type: 'pledge' | 'summons' | 'referral_print' | 'absence_notice', dates?: string[]) => void;
}

const AttendanceMonitor: React.FC<AttendanceMonitorProps> = ({ onPrintAction }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [requests, setRequests] = useState<ExcuseRequest[]>([]);
  const [riskHistory, setRiskHistory] = useState<any[]>([]); // New state for history
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'general' | 'consecutive' | 'followup'>('general');
  const [filterRisk, setFilterRisk] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Helper for Android Phone Calls
  const formatPhone = (phone: string) => {
      if (!phone) return '';
      // Replace +966 or 966 or 00966 with 0
      return phone.replace(/^(00966|\+966|966)/, '0');
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, r, reqs, hist] = await Promise.all([
          getStudents().catch(() => []), 
          getAttendanceRecords().catch(() => []), 
          getRequests().catch(() => []),
          getRiskHistory().catch(() => [])
      ]);
      setStudents(s || []);
      setRecords(r || []);
      setRequests(reqs || []);
      setRiskHistory(hist || []);
    } catch (e) { 
      console.error("Failed to load attendance monitor data", e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Map of Approved Excuses: Key = "studentId_date", Value = true
  const approvedExcusesMap = useMemo(() => {
      const map: Record<string, boolean> = {};
      if (!requests || !Array.isArray(requests)) return map;
      
      requests.forEach(req => {
          if (!req) return;
          // Use string literal 'APPROVED' to avoid Enum runtime issues
          if (req.status === 'APPROVED') {
              if (req.studentId && req.date) {
                  map[`${req.studentId}_${req.date}`] = true;
              }
          }
      });
      return map;
  }, [requests]);

  // --- GENERAL STATS LOGIC ---
  const studentStats = useMemo(() => {
    if (!students || !records) return [];

    const stats: Record<string, { student: Student, absent: number, excusedAbsent: number, late: number, riskLevel: 'high'|'medium'|'low' }> = {};
    
    // Initialize using studentId (Civil ID) as key
    students.forEach(s => {
      if (s && s.studentId) {
        stats[s.studentId] = { student: s, absent: 0, excusedAbsent: 0, late: 0, riskLevel: 'low' };
      }
    });

    // Calculate Stats
    records.forEach(r => {
      if (r && r.records && Array.isArray(r.records)) {
        r.records.forEach(rec => {
          // Check if student exists in our map (stats)
          if (rec.studentId && stats[rec.studentId]) {
              const statusStr = String(rec.status);
              
              if (statusStr === 'ABSENT') {
                  // Check if this specific absence date has an APPROVED excuse
                  const isExcused = approvedExcusesMap[`${rec.studentId}_${r.date}`];
                  
                  if (isExcused) {
                      stats[rec.studentId].excusedAbsent++;
                  } else {
                      stats[rec.studentId].absent++; // Count risk only if NOT excused
                  }
              } else if (statusStr === 'LATE') {
                  stats[rec.studentId].late++;
              }
          }
        });
      }
    });

    // Determine Risk Level
    Object.values(stats).forEach(stat => {
      if (stat.absent >= 10) stat.riskLevel = 'high';
      else if (stat.absent >= 3) stat.riskLevel = 'medium';
      else stat.riskLevel = 'low';
    });

    return Object.values(stats).sort((a, b) => b.absent - a.absent);
  }, [students, records, approvedExcusesMap]);

  const filteredStats = useMemo(() => {
      return studentStats.filter(s => {
        const matchesSearch = (s.student.name || '').includes(searchTerm) || (s.student.studentId || '').includes(searchTerm);
        const matchesRisk = filterRisk === 'all' ? true : s.riskLevel === filterRisk;
        return matchesSearch && matchesRisk;
      });
  }, [studentStats, searchTerm, filterRisk]);

  // --- CONSECUTIVE ABSENCE LOGIC ---
  const consecutiveStats = useMemo(() => {
      if (!students || !records) return [];
      
      const result: { student: Student, streak: number, dates: string[] }[] = [];
      
      // Group records by student
      const studentDates: Record<string, { date: string, status: string }[]> = {};
      
      records.forEach(r => {
          if (r && r.records && Array.isArray(r.records)) {
            r.records.forEach(rec => {
                if (rec.studentId) {
                    if (!studentDates[rec.studentId]) studentDates[rec.studentId] = [];
                    studentDates[rec.studentId].push({ date: r.date, status: String(rec.status) });
                }
            });
          }
      });

      // Filter out students who have recent risk actions (resolved within last 7 days)
      const recentResolutions = new Set();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      riskHistory.forEach(action => {
          if (new Date(action.resolved_at) >= sevenDaysAgo) {
              recentResolutions.add(action.student_id);
          }
      });

      students.forEach(student => {
          if (!student.studentId) return;
          if (recentResolutions.has(student.studentId)) return; // Skip recently resolved

          const history = studentDates[student.studentId] || [];
          
          // Sort by date descending (newest first)
          history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          let currentStreak = 0;
          const streakDates: string[] = [];

          for (const record of history) {
              if (record.status === 'ABSENT') {
                  // Check excused status
                  const isExcused = approvedExcusesMap[`${student.studentId}_${record.date}`];
                  
                  if (!isExcused) {
                      currentStreak++;
                      streakDates.push(record.date);
                  } else {
                      // Excused absence breaks the "unexcused" streak
                      break; 
                  }
              } else {
                  // Present/Late breaks the streak
                  break; 
              }
          }

          if (currentStreak >= 3) {
              result.push({
                  student,
                  streak: currentStreak,
                  dates: streakDates
              });
          }
      });

      return result.sort((a, b) => b.streak - a.streak);
  }, [students, records, approvedExcusesMap, riskHistory]);


  // --- ACTIONS ---
  const handleAction = (studentId: string, action: string) => {
      alert(`تم تسجيل الإجراء: ${action}`);
  };

  const handleCloseCase = async (student: Student, note: string) => {
      if(!confirm(`هل أنت متأكد من إغلاق حالة الطالب ${student.name}؟ لن يظهر في القائمة حتى يتغيب مجدداً.`)) return;
      try {
          await resolveAbsenceAlert(student.studentId, 'closed', note);
          alert("تم إغلاق الحالة ونقلها للمتابعة.");
          fetchData();
      } catch (error: any) {
          console.error(error);
          alert(`حدث خطأ أثناء إغلاق الحالة: ${error.message}`);
      }
  };

  const handleReferToCounselor = async (student: Student, dates?: string[]) => {
      if(!confirm(`هل أنت متأكد من تحويل الطالب ${student.name} للموجه الطلابي بسبب الغياب؟\n(سيتم إزالة الطالب من قائمة الغياب المتصل)`)) return;
      
      const reasonText = dates && dates.length > 0 
        ? `غياب متصل (بدون عذر) لمدة ${dates.length} أيام (${dates.join(', ')})`
        : `تكرار الغياب بدون عذر مقبول`;

      const newReferral: Referral = {
          id: '',
          studentId: student.studentId,
          studentName: student.name,
          grade: student.grade,
          className: student.className,
          referralDate: new Date().toISOString().split('T')[0],
          reason: reasonText,
          status: 'pending',
          referredBy: 'deputy',
          notes: 'نأمل دراسة الحالة ومتابعة الطالب.'
      };

      try {
          // 1. Create Referral
          await addReferral(newReferral);
          // 2. Mark as Resolved/Referred in Risk Actions so it disappears from the list
          await resolveAbsenceAlert(student.studentId, 'referral', 'تم تحويله للموجه الطلابي');
          
          alert("تم إنشاء الإحالة وإرسالها للموجه بنجاح.");
          
          if (onPrintAction && confirm("هل ترغب بطباعة نموذج الإحالة ورقياً؟")) {
              onPrintAction(student, 'referral_print', dates);
          }
          fetchData();
      } catch (error: any) {
          console.error(error);
          alert(`حدث خطأ أثناء التحويل: ${error.message}`);
      }
  };

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Loader2 className="animate-spin mb-2" size={32}/>
              <p>جاري تحميل البيانات...</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
         <div className="relative flex-1 w-full">
            <Search className="absolute right-3 top-2.5 text-slate-400" size={20} />
            <input 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="بحث سريع..." 
              className="w-full pr-10 pl-4 py-2 bg-slate-50 border-none rounded-xl outline-none font-bold text-slate-800"
            />
         </div>
         
         <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto w-full md:w-auto">
             <button 
                onClick={() => setActiveTab('general')} 
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'general' ? 'bg-white shadow text-blue-900' : 'text-slate-500'}`}
             >
                 <List size={16}/> المتابعة العامة
             </button>
             <button 
                onClick={() => setActiveTab('consecutive')} 
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'consecutive' ? 'bg-white shadow text-red-600' : 'text-slate-500'}`}
             >
                 <CalendarDays size={16}/> الغياب المتصل (خطر)
             </button>
             <button 
                onClick={() => setActiveTab('followup')} 
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'followup' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}
             >
                 <CheckSquare size={16}/> المتابعة والسجل
             </button>
         </div>
      </div>

      {/* --- TAB: GENERAL MONITOR --- */}
      {activeTab === 'general' && (
        <>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {(['all', 'high', 'medium', 'low'] as const).map(risk => (
                <button 
                    key={risk}
                    onClick={() => setFilterRisk(risk)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize whitespace-nowrap ${filterRisk === risk ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                    {risk === 'all' ? 'الكل' : risk === 'high' ? 'حرج (+10)' : risk === 'medium' ? 'متوسط (3-9)' : 'طبيعي'}
                </button>
                ))}
            </div>

            {/* Mobile Card View (Visible on small screens) */}
            <div className="md:hidden space-y-4">
                {filteredStats.map((stat, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h4 className="font-bold text-slate-900">{stat.student.name}</h4>
                                <p className="text-xs text-slate-500">{stat.student.grade} - {stat.student.className}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                stat.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                                stat.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                                'bg-emerald-100 text-emerald-700'
                            }`}>
                                {stat.riskLevel === 'high' ? 'مرتفع' : stat.riskLevel === 'medium' ? 'متوسط' : 'طبيعي'}
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4 bg-slate-50 p-2 rounded-lg">
                            <div>
                                <span className="block font-bold text-red-600 text-lg">{stat.absent}</span>
                                <span className="text-slate-400">بدون عذر</span>
                            </div>
                            <div>
                                <span className="block font-bold text-blue-600 text-lg">{stat.excusedAbsent}</span>
                                <span className="text-slate-400">بعذر</span>
                            </div>
                            <div>
                                <span className="block font-bold text-amber-600 text-lg">{stat.late}</span>
                                <span className="text-slate-400">تأخر</span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <a href={`tel:${formatPhone(stat.student.phone)}`} className="flex-1 bg-blue-50 text-blue-600 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 hover:bg-blue-100">
                                <Phone size={14}/> اتصال
                            </a>
                            <button onClick={() => handleReferToCounselor(stat.student)} className="flex-1 bg-purple-50 text-purple-600 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 hover:bg-purple-100">
                                <Forward size={14}/> تحويل
                            </button>
                            {onPrintAction && (
                                <button onClick={() => onPrintAction(stat.student, 'summons')} className="flex-1 bg-red-50 text-red-600 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 hover:bg-red-100">
                                    <FileWarning size={14}/> استدعاء
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {filteredStats.length === 0 && <p className="text-center py-10 text-slate-400">لا توجد بيانات</p>}
            </div>

            {/* Desktop Table View (Hidden on mobile) */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b border-slate-100">
                    <tr>
                        <th className="p-4">الطالب</th>
                        <th className="p-4 text-center">غياب (بدون عذر)</th>
                        <th className="p-4 text-center text-blue-700">غياب (بعذر مقبول)</th>
                        <th className="p-4 text-center">أيام التأخر</th>
                        <th className="p-4">حالة الخطر</th>
                        <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                    {filteredStats.map((stat, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 group">
                            <td className="p-4">
                                <p className="font-bold text-slate-800">{stat.student.name}</p>
                                <p className="text-xs text-slate-500">{stat.student.grade} - {stat.student.className}</p>
                            </td>
                            <td className="p-4 text-center">
                                <span className="font-bold text-red-600 bg-red-50 px-3 py-1 rounded-lg border border-red-100">{stat.absent}</span>
                            </td>
                            <td className="p-4 text-center">
                                <span className="font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 flex items-center justify-center gap-1">
                                    {stat.excusedAbsent > 0 && <ShieldCheck size={14}/>}
                                    {stat.excusedAbsent}
                                </span>
                            </td>
                            <td className="p-4 text-center font-bold text-amber-600">{stat.late}</td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                stat.riskLevel === 'high' ? 'bg-red-100 text-red-700 border border-red-200' :
                                stat.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                }`}>
                                {stat.riskLevel === 'high' ? 'مرتفع جداً' : stat.riskLevel === 'medium' ? 'متوسط' : 'طبيعي'}
                                </span>
                            </td>
                            <td className="p-4 text-center">
                                <div className="flex justify-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <a href={`tel:${formatPhone(stat.student.phone)}`} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="اتصال"><Phone size={16}/></a>
                                <button onClick={() => handleReferToCounselor(stat.student)} className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100" title="تحويل للموجه"><Forward size={16}/></button>
                                {onPrintAction && (
                                    <>
                                    <button onClick={() => onPrintAction(stat.student, 'pledge')} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100" title="طباعة تعهد"><FileText size={16}/></button>
                                    <button onClick={() => onPrintAction(stat.student, 'summons')} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100" title="طباعة استدعاء"><FileWarning size={16}/></button>
                                    </>
                                )}
                                </div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                {filteredStats.length === 0 && <p className="text-center py-10 text-slate-400">لا توجد بيانات</p>}
            </div>
        </>
      )}

      {/* --- TAB: CONSECUTIVE ABSENCE --- */}
      {activeTab === 'consecutive' && (
          <div className="space-y-4 animate-fade-in">
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-3">
                  <AlertTriangle className="text-red-600" size={24}/>
                  <div>
                      <h3 className="font-bold text-red-900">حالات الغياب المتصل (3 أيام فأكثر - بدون عذر)</h3>
                      <p className="text-sm text-red-700">هذه القائمة تستثني أيام الغياب التي لها أعذار مقبولة، وكذلك الحالات التي تم إحالتها أو إغلاقها مؤخراً.</p>
                  </div>
              </div>

              {/* Mobile Cards for Consecutive */}
              <div className="md:hidden space-y-4">
                  {consecutiveStats.map((item, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-xl border border-red-100 shadow-sm">
                          <div className="flex justify-between items-center mb-2">
                              <div>
                                  <h4 className="font-bold text-slate-900">{item.student.name}</h4>
                                  <p className="text-xs text-slate-500">{item.student.grade} - {item.student.className}</p>
                              </div>
                              <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                                  {item.streak} أيام
                              </span>
                          </div>
                          
                          <div className="bg-slate-50 p-2 rounded-lg text-xs font-mono text-slate-600 mb-3 flex flex-wrap gap-1">
                              {item.dates.map(date => <span key={date} className="bg-white border px-1 rounded">{date}</span>)}
                          </div>

                          <div className="flex gap-2 mb-2">
                              <button onClick={() => handleReferToCounselor(item.student, item.dates)} className="flex-1 bg-purple-600 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-purple-700">
                                  <Forward size={14}/> تحويل
                              </button>
                              <button onClick={() => handleCloseCase(item.student, 'تم التواصل والاكتفاء بالتنبيه')} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-emerald-700">
                                  <CheckCircle size={14}/> إغلاق
                              </button>
                          </div>
                          {onPrintAction && (
                              <div className="flex gap-2">
                                <button onClick={() => onPrintAction(item.student, 'referral_print', item.dates)} className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-slate-200">
                                    <Printer size={14}/> إحالة
                                </button>
                                <button onClick={() => onPrintAction(item.student, 'absence_notice', item.dates)} className="flex-1 bg-red-50 text-red-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-red-100">
                                    <FileWarning size={14}/> إشعار
                                </button>
                              </div>
                          )}
                      </div>
                  ))}
                  {consecutiveStats.length === 0 && <p className="text-center py-10 text-slate-400">ممتاز! لا يوجد حالات.</p>}
              </div>

              {/* Desktop Table for Consecutive */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-right text-sm">
                      <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b border-slate-100">
                          <tr>
                              <th className="p-4">الطالب</th>
                              <th className="p-4">مدة الانقطاع (بدون عذر)</th>
                              <th className="p-4">تواريخ الغياب</th>
                              <th className="p-4 text-center">الإجراءات الفورية</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {consecutiveStats.map((item, idx) => (
                              <tr key={idx} className="hover:bg-red-50/10 group">
                                  <td className="p-4 align-top">
                                      <p className="font-bold text-slate-800 text-base">{item.student.name}</p>
                                      <p className="text-xs text-slate-500">{item.student.grade} - {item.student.className}</p>
                                  </td>
                                  <td className="p-4 align-top">
                                      <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold text-sm">
                                          {item.streak} أيام متصلة
                                      </span>
                                  </td>
                                  <td className="p-4 align-top">
                                      <div className="flex flex-wrap gap-1">
                                          {item.dates.map(date => (
                                              <span key={date} className="text-xs font-mono bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                                  {date}
                                              </span>
                                          ))}
                                      </div>
                                  </td>
                                  <td className="p-4 align-top text-center">
                                      <div className="flex justify-center gap-2 flex-wrap">
                                          <button 
                                            onClick={() => handleReferToCounselor(item.student, item.dates)}
                                            className="flex items-center gap-1 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-700 shadow-sm"
                                          >
                                              <Forward size={14}/> تحويل
                                          </button>
                                          <button 
                                            onClick={() => handleCloseCase(item.student, 'تم اتخاذ اللازم')}
                                            className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-sm"
                                          >
                                              <CheckCircle size={14}/> إغلاق
                                          </button>
                                          {onPrintAction && (
                                              <>
                                                <button 
                                                    onClick={() => onPrintAction(item.student, 'referral_print', item.dates)}
                                                    className="flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50"
                                                >
                                                    <Printer size={14}/> إحالة
                                                </button>
                                                <button 
                                                    onClick={() => onPrintAction(item.student, 'absence_notice', item.dates)}
                                                    className="flex items-center gap-1 bg-white border border-red-200 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50"
                                                >
                                                    <FileWarning size={14}/> إشعار
                                                </button>
                                              </>
                                          )}
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  {consecutiveStats.length === 0 && (
                      <div className="text-center py-16 text-slate-400">
                          <CheckCircle className="mx-auto mb-2 text-emerald-200" size={48}/>
                          <p>ممتاز! لا يوجد حالات انقطاع متصل (بدون عذر) حالياً.</p>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* --- TAB: FOLLOW-UP (HISTORY) --- */}
      {activeTab === 'followup' && (
          <div className="space-y-4 animate-fade-in">
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-3">
                  <CheckSquare className="text-emerald-600" size={24}/>
                  <div>
                      <h3 className="font-bold text-emerald-900">سجل المتابعة والإجراءات</h3>
                      <p className="text-sm text-emerald-700">هنا تظهر الحالات التي تم إغلاقها أو تحويلها للمرشد.</p>
                  </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {riskHistory.length === 0 ? <p className="text-center py-10 text-slate-400">السجل فارغ.</p> : (
                      <table className="w-full text-right text-sm">
                          <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b border-slate-100">
                              <tr>
                                  <th className="p-4">الطالب</th>
                                  <th className="p-4">نوع الإجراء</th>
                                  <th className="p-4">الملاحظات</th>
                                  <th className="p-4">التاريخ</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {riskHistory.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50">
                                      <td className="p-4 font-bold text-slate-800">
                                          {item.studentName}
                                          <div className="text-xs text-slate-400 font-normal">{item.grade}</div>
                                      </td>
                                      <td className="p-4">
                                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                              item.action_type === 'referral' ? 'bg-purple-100 text-purple-700' : 
                                              item.action_type === 'closed' ? 'bg-emerald-100 text-emerald-700' : 
                                              'bg-slate-100 text-slate-700'
                                          }`}>
                                              {item.action_type === 'referral' ? 'تحويل للموجه' : item.action_type === 'closed' ? 'إغلاق الحالة' : item.action_type}
                                          </span>
                                      </td>
                                      <td className="p-4 text-slate-600 text-xs">{item.notes || '-'}</td>
                                      <td className="p-4 text-slate-400 text-xs font-mono">{new Date(item.resolved_at).toLocaleDateString('ar-SA')}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default AttendanceMonitor;