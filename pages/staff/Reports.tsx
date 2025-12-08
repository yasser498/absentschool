import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Calendar, BarChart2, Users, AlertCircle, Clock, CheckCircle, School, ChevronDown, Loader2, Printer, PieChart as PieIcon, TrendingUp, ArrowUpRight, Grid } from 'lucide-react';
import { getDailyAttendanceReport, getStudents, getAttendanceRecords, getRequests } from '../../services/storage';
import { AttendanceStatus, StaffUser, ClassAssignment, AttendanceRecord, RequestStatus, ExcuseRequest } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const { useNavigate } = ReactRouterDOM as any;

const StaffReports: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [activeTab, setActiveTab] = useState<'daily' | 'stats'>('daily');
  
  // Daily Report State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<{
    totalPresent: number;
    totalAbsent: number;
    totalLate: number;
    details: any[];
  } | null>(null);
  const [dailyClassSummary, setDailyClassSummary] = useState<any[]>([]);
  const [dateRequests, setDateRequests] = useState<ExcuseRequest[]>([]);
  
  // Stats State
  const [statsData, setStatsData] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  
  // School Identity
  const SCHOOL_NAME = localStorage.getItem('school_name') || "مدرسة عماد الدين زنكي المتوسطة";
  const SCHOOL_LOGO = localStorage.getItem('school_logo') || "";

  useEffect(() => {
    const session = localStorage.getItem('ozr_staff_session');
    if (!session) {
      navigate('/staff/login');
      return;
    }
    setCurrentUser(JSON.parse(session));
  }, [navigate]);

  // Fetch Daily Report
  useEffect(() => {
    const fetchReport = async () => {
      if (!currentUser || activeTab !== 'daily') return;
      setLoading(true);
      try {
        const [data, allStudents, allRequests] = await Promise.all([
            getDailyAttendanceReport(selectedDate),
            getStudents(),
            getRequests()
        ]);
        
        // Filter requests for the selected date
        const reqs = allRequests.filter(r => r.date === selectedDate);
        setDateRequests(reqs);
        
        const assignedClasses = currentUser.assignments || [];
        const filteredDetails = data.details.filter(d => 
            assignedClasses.some(a => a.grade === d.grade && a.className === d.className)
        );

        // Calculate Totals per teacher
        const assignedStudents = allStudents.filter(s => 
            assignedClasses.some(a => a.grade === s.grade && a.className === s.className)
        );
        const assignedStudentsCount = assignedStudents.length;

        let totalAbsent = 0;
        let totalLate = 0;
        
        filteredDetails.forEach(d => {
            if (d.status === AttendanceStatus.ABSENT) totalAbsent++;
            if (d.status === AttendanceStatus.LATE) totalLate++;
        });

        const totalPresent = Math.max(0, assignedStudentsCount - totalAbsent - totalLate);

        setReportData({
            totalPresent,
            totalAbsent,
            totalLate,
            details: filteredDetails
        });

        // Calculate Daily Summary PER CLASS
        const summary = assignedClasses.map(cls => {
             const classStudentsCount = assignedStudents.filter(s => s.grade === cls.grade && s.className === cls.className).length;
             const absents = filteredDetails.filter(d => d.grade === cls.grade && d.className === cls.className && d.status === AttendanceStatus.ABSENT).length;
             const lates = filteredDetails.filter(d => d.grade === cls.grade && d.className === cls.className && d.status === AttendanceStatus.LATE).length;
             const present = Math.max(0, classStudentsCount - absents - lates); // Simplified logic
             
             // Attendance Rate (Usually includes Late)
             const rate = classStudentsCount > 0 ? Math.round(((classStudentsCount - absents) / classStudentsCount) * 100) : 0;
             const absentRate = classStudentsCount > 0 ? Math.round((absents / classStudentsCount) * 100) : 0;
             const lateRate = classStudentsCount > 0 ? Math.round((lates / classStudentsCount) * 100) : 0;

             return {
                 grade: cls.grade,
                 className: cls.className,
                 total: classStudentsCount,
                 present,
                 absent: absents,
                 late: lates,
                 rate,
                 absentRate,
                 lateRate
             };
        });
        setDailyClassSummary(summary);

      } catch (error) {
        console.error("Error fetching report:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [selectedDate, currentUser, activeTab]);

  // Fetch General Stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!currentUser || activeTab !== 'stats') return;
      setLoading(true);
      try {
        const allRecords = await getAttendanceRecords();
        const assignedClasses = currentUser.assignments || [];

        // Filter records relevant to this teacher's classes
        const myRecords = allRecords.filter(r => 
            assignedClasses.some(a => a.grade === r.grade && a.className === r.className)
        );

        let totalRecords = 0;
        let totalPresent = 0;
        let totalAbsent = 0;
        let totalLate = 0;

        // Enhanced Class Stats Object
        const classStats: Record<string, { 
            name: string, grade: string, className: string, 
            absent: number, late: number, total: number, present: number 
        }> = {};

        // Initialize class stats for all assigned classes (even if no records yet)
        assignedClasses.forEach(a => {
            const key = `${a.grade} - ${a.className}`;
            classStats[key] = { 
                name: key, grade: a.grade, className: a.className,
                absent: 0, late: 0, total: 0, present: 0
            };
        });

        const studentStats: Record<string, { name: string, grade: string, className: string, absent: number, late: number }> = {};
        const dayStats: Record<string, number> = {};

        myRecords.forEach(record => {
            const classKey = `${record.grade} - ${record.className}`;
            // If class assignment changed, key might not exist in init, so safe check
            if (!classStats[classKey]) classStats[classKey] = { name: classKey, grade: record.grade, className: record.className, absent: 0, late: 0, total: 0, present: 0 };

            const dayName = new Date(record.date).toLocaleDateString('ar-SA', { weekday: 'long' });

            record.records.forEach(student => {
                totalRecords++;
                classStats[classKey].total++;

                // Track student
                if (!studentStats[student.studentId]) {
                    studentStats[student.studentId] = {
                        name: student.studentName,
                        grade: record.grade,
                        className: record.className,
                        absent: 0,
                        late: 0
                    };
                }

                if (student.status === AttendanceStatus.PRESENT) {
                    totalPresent++;
                    classStats[classKey].present++;
                } else if (student.status === AttendanceStatus.ABSENT) {
                    totalAbsent++;
                    classStats[classKey].absent++;
                    studentStats[student.studentId].absent++;
                    dayStats[dayName] = (dayStats[dayName] || 0) + 1;
                } else if (student.status === AttendanceStatus.LATE) {
                    totalLate++;
                    classStats[classKey].late++;
                    studentStats[student.studentId].late++;
                }
            });
        });

        const attendanceRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;
        const absenceRate = totalRecords > 0 ? Math.round((totalAbsent / totalRecords) * 100) : 0;
        const latenessRate = totalRecords > 0 ? Math.round((totalLate / totalRecords) * 100) : 0;

        const topAbsentStudents = Object.values(studentStats)
            .sort((a, b) => b.absent - a.absent)
            .filter(s => s.absent > 0)
            .slice(0, 5);

        const topLateStudents = Object.values(studentStats)
            .sort((a, b) => b.late - a.late)
            .filter(s => s.late > 0)
            .slice(0, 5);

        const busiestDay = Object.entries(dayStats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'لا يوجد';

        const classChartData = Object.values(classStats).map(c => ({
            name: c.name,
            grade: c.grade,
            className: c.className,
            absent: c.absent,
            late: c.late,
            present: c.present,
            total: c.total,
            rate: c.total > 0 ? Math.round((c.present / c.total) * 100) : 0
        }));

        setStatsData({
            attendanceRate,
            absenceRate,
            latenessRate,
            topAbsentStudents,
            topLateStudents,
            busiestDay,
            classChartData,
            totalRecords
        });

      } catch (error) {
        console.error("Error calculating stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [currentUser, activeTab]);

  const handlePrint = () => {
    window.print();
  };

  const getExcuseStatus = (studentId: string, studentName: string) => {
      const req = dateRequests.find(r => r.studentId === studentId) || dateRequests.find(r => r.studentName === studentName);
      return req ? req.status : null;
  };

  if (!currentUser) return null;

  const pieData = statsData ? [
    { name: 'حضور', value: statsData.attendanceRate, color: '#10b981' },
    { name: 'غياب', value: statsData.absenceRate, color: '#ef4444' },
    { name: 'تأخر', value: statsData.latenessRate, color: '#f59e0b' },
  ] : [];

  return (
    <>
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            #staff-report-print, #staff-report-print * { visibility: visible; }
            #staff-report-print { position: absolute; left: 0; top: 0; width: 100%; background: white; z-index: 9999; padding: 20px; }
            .no-print { display: none !important; }
          }
        `}
      </style>

      {/* Print View (Daily Only) */}
      <div id="staff-report-print" className="hidden">
         <div className="text-center mb-8 border-b-2 border-slate-800 pb-4">
            {SCHOOL_LOGO && <img src={SCHOOL_LOGO} alt="Logo" className="w-16 h-16 object-contain mx-auto mb-2" />}
            <h1 className="text-2xl font-bold">تقرير غياب الفصول المسندة</h1>
            <h2 className="text-lg">المعلم: {currentUser.name}</h2>
            <p className="text-sm mt-2">التاريخ: {selectedDate}</p>
         </div>
         
         {activeTab === 'daily' && reportData && (
             <>
                <div className="grid grid-cols-3 gap-4 mb-6 text-center border-b pb-6">
                    <div className="border p-2 rounded">
                        <div className="font-bold">حضور</div>
                        <div className="text-xl">{reportData.totalPresent}</div>
                    </div>
                    <div className="border p-2 rounded">
                        <div className="font-bold">غياب</div>
                        <div className="text-xl">{reportData.totalAbsent}</div>
                    </div>
                    <div className="border p-2 rounded">
                        <div className="font-bold">تأخر</div>
                        <div className="text-xl">{reportData.totalLate}</div>
                    </div>
                </div>

                <table className="w-full text-right border-collapse border border-slate-300">
                    <thead>
                    <tr className="bg-slate-100">
                        <th className="border p-2">الطالب</th>
                        <th className="border p-2">الصف</th>
                        <th className="border p-2">الفصل</th>
                        <th className="border p-2">الحالة</th>
                        <th className="border p-2">العذر</th>
                    </tr>
                    </thead>
                    <tbody>
                    {reportData.details.map((d, idx) => {
                        const status = getExcuseStatus(d.studentId, d.studentName);
                        return (
                        <tr key={idx}>
                            <td className="border p-2">{d.studentName}</td>
                            <td className="border p-2">{d.grade}</td>
                            <td className="border p-2">{d.className}</td>
                            <td className="border p-2">{d.status === AttendanceStatus.ABSENT ? 'غائب' : 'متأخر'}</td>
                            <td className="border p-2">
                                {status === RequestStatus.APPROVED ? 'مقبول ✅' : 
                                 status === RequestStatus.REJECTED ? 'مرفوض ❌' : 
                                 status === RequestStatus.PENDING ? 'قيد المراجعة ⏳' : '-'}
                            </td>
                        </tr>
                    )})}
                    {reportData.details.length === 0 && (
                        <tr><td colSpan={5} className="border p-4 text-center">لا يوجد غياب أو تأخر مسجل للفصول المسندة</td></tr>
                    )}
                    </tbody>
                </table>
             </>
         )}
      </div>

      <div className="space-y-8 pb-12 animate-fade-in no-print">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
                <BarChart2 className="text-amber-500" /> تقاريري وإحصائياتي
                </h1>
                <p className="text-slate-500 mt-1">مركز البيانات الخاص بفصولك المسندة</p>
            </div>
            {activeTab === 'daily' && (
                <button onClick={handlePrint} className="bg-slate-800 text-white p-2.5 rounded-xl hover:bg-slate-700 transition-colors" title="طباعة التقرير">
                    <Printer size={20} />
                </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-slate-100">
             <button 
                onClick={() => setActiveTab('daily')}
                className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'daily' ? 'border-blue-900 text-blue-900 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
             >
                التقرير اليومي
             </button>
             <button 
                onClick={() => setActiveTab('stats')}
                className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'stats' ? 'border-amber-500 text-amber-700 bg-amber-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
             >
                الإحصائيات الشاملة
             </button>
          </div>
        </div>

        {/* ================= TAB: DAILY REPORT ================= */}
        {activeTab === 'daily' && (
            <>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 w-fit mx-auto">
                    <div className="relative">
                        <input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-900 outline-none text-slate-800 font-bold bg-white"
                        />
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    </div>
                </div>

                {loading || !reportData ? (
                    <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                        <Loader2 className="mx-auto mb-4 animate-spin" size={32} />
                        <p className="font-bold">جاري جلب البيانات...</p>
                    </div>
                ) : (
                    <>
                        {/* Stats Summary - Responsive Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                                <div className="bg-emerald-100 p-4 rounded-full text-emerald-600">
                                    <CheckCircle size={32} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-500 uppercase">حضور فصولي</p>
                                    <p className="text-3xl font-bold text-emerald-900">{reportData.totalPresent}</p>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                                <div className="bg-red-100 p-4 rounded-full text-red-600">
                                    <AlertCircle size={32} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-500 uppercase">غياب فصولي</p>
                                    <p className="text-3xl font-bold text-red-900">{reportData.totalAbsent}</p>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                                <div className="bg-amber-100 p-4 rounded-full text-amber-600">
                                    <Clock size={32} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-500 uppercase">تأخر فصولي</p>
                                    <p className="text-3xl font-bold text-amber-900">{reportData.totalLate}</p>
                                </div>
                            </div>
                        </div>

                        {/* Detailed List */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
                                <h3 className="font-bold text-slate-800">قائمة الطلاب (فصولي فقط)</h3>
                            </div>
                            
                            {reportData.details.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <Users className="mx-auto mb-2 opacity-50" size={48} />
                                    <p>سجل نظيف! لا يوجد غياب أو تأخر في فصولك لهذا اليوم.</p>
                                </div>
                            ) : (
                                <table className="w-full text-right">
                                    <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-100">
                                        <tr>
                                        <th className="p-4">اسم الطالب</th>
                                        <th className="p-4">الصف</th>
                                        <th className="p-4">الفصل</th>
                                        <th className="p-4">الحالة</th>
                                        <th className="p-4">حالة العذر</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {reportData.details.map((d, idx) => {
                                            const status = getExcuseStatus(d.studentId, d.studentName);
                                            return (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 font-bold text-slate-800">{d.studentName}</td>
                                                <td className="p-4 text-slate-600">{d.grade}</td>
                                                <td className="p-4 text-slate-600">{d.className}</td>
                                                <td className="p-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                        d.status === AttendanceStatus.ABSENT 
                                                        ? 'bg-red-100 text-red-700' 
                                                        : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                        {d.status === AttendanceStatus.ABSENT ? 'غائب' : 'متأخر'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    {status ? (
                                                        <span className={`flex items-center gap-1.5 w-fit px-3 py-1.5 rounded-lg text-xs font-bold border ${
                                                            status === RequestStatus.APPROVED ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                            status === RequestStatus.REJECTED ? 'bg-red-50 text-red-700 border-red-200' :
                                                            'bg-amber-50 text-amber-700 border-amber-200'
                                                        }`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${
                                                                status === RequestStatus.APPROVED ? 'bg-emerald-500' :
                                                                status === RequestStatus.REJECTED ? 'bg-red-500' :
                                                                'bg-amber-500'
                                                            }`}></div>
                                                            {status === RequestStatus.APPROVED ? 'مقبول' : 
                                                             status === RequestStatus.REJECTED ? 'مرفوض' : 'قيد المراجعة'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs px-2 py-1 bg-slate-50 rounded border border-slate-100">لا يوجد عذر</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )})}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Daily Class Summary */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
                             <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <Grid className="text-blue-600" size={20} />
                                    ملخص الفصول لهذا اليوم
                                </h3>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                                {dailyClassSummary.map((item, idx) => (
                                    <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h4 className="font-bold text-slate-800">{item.grade}</h4>
                                                <p className="text-xs text-slate-500">فصل {item.className}</p>
                                            </div>
                                            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                                                item.rate > 90 ? 'bg-emerald-100 text-emerald-700' :
                                                item.rate > 80 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                %{item.rate}
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
                                            <div className={`h-2 rounded-full ${
                                                item.rate > 90 ? 'bg-emerald-500' :
                                                item.rate > 80 ? 'bg-amber-500' : 'bg-red-500'
                                            }`} style={{ width: `${item.rate}%` }}></div>
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-500">
                                            <span>غياب: <strong className="text-red-600">{item.absent} <span className="text-[10px] text-red-500 font-normal">({item.absentRate}%)</span></strong></span>
                                            <span>تأخر: <strong className="text-amber-600">{item.late} <span className="text-[10px] text-amber-500 font-normal">({item.lateRate}%)</span></strong></span>
                                            <span>عدد: <strong>{item.total}</strong></span>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    </>
                )}
            </>
        )}

        {/* ================= TAB: GENERAL STATS ================= */}
        {activeTab === 'stats' && (
            <>
                {loading || !statsData ? (
                    <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                        <Loader2 className="mx-auto mb-4 animate-spin" size={32} />
                        <p className="font-bold">جاري حساب الإحصائيات الشاملة...</p>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        
                        {/* KPIs */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                                <div className="absolute right-0 top-0 p-4 opacity-5"><TrendingUp size={64} className="text-blue-600"/></div>
                                <p className="text-slate-500 font-bold text-xs uppercase mb-2">نسبة الحضور العامة</p>
                                <h3 className="text-4xl font-extrabold text-blue-900">{statsData.attendanceRate}%</h3>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                                <div className="absolute right-0 top-0 p-4 opacity-5"><AlertCircle size={64} className="text-red-600"/></div>
                                <p className="text-slate-500 font-bold text-xs uppercase mb-2">نسبة الغياب</p>
                                <h3 className="text-4xl font-extrabold text-red-600">{statsData.absenceRate}%</h3>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                                <div className="absolute right-0 top-0 p-4 opacity-5"><Clock size={64} className="text-amber-600"/></div>
                                <p className="text-slate-500 font-bold text-xs uppercase mb-2">نسبة التأخير</p>
                                <h3 className="text-4xl font-extrabold text-amber-600">{statsData.latenessRate}%</h3>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                                <div className="absolute right-0 top-0 p-4 opacity-5"><Calendar size={64} className="text-purple-600"/></div>
                                <p className="text-slate-500 font-bold text-xs uppercase mb-2">اليوم الأكثر غياباً</p>
                                <h3 className="text-2xl font-extrabold text-purple-900 mt-2">{statsData.busiestDay}</h3>
                            </div>
                        </div>

                        {/* NEW: Comprehensive Class Statistics Grid */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <School className="text-indigo-600" size={20} />
                                    تحليل أداء الفصول الشامل
                                </h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                                {statsData.classChartData.map((cls: any, idx: number) => (
                                    <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-100 to-transparent rounded-bl-full -mr-10 -mt-10 group-hover:from-blue-50 transition-colors"></div>
                                        
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h4 className="text-lg font-extrabold text-slate-800">{cls.grade}</h4>
                                                    <p className="text-sm text-slate-500 font-medium">فصل {cls.className}</p>
                                                </div>
                                                <div className={`text-xl font-bold ${cls.rate >= 90 ? 'text-emerald-600' : cls.rate >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                                                    %{cls.rate}
                                                </div>
                                            </div>
                                            
                                            {/* Attendance Bar */}
                                            <div className="mb-4">
                                                <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
                                                    <span>مؤشر الحضور</span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-2.5">
                                                    <div 
                                                        className={`h-2.5 rounded-full transition-all duration-1000 ${
                                                            cls.rate >= 90 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 
                                                            cls.rate >= 80 ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 
                                                            'bg-gradient-to-r from-red-400 to-red-600'
                                                        }`} 
                                                        style={{ width: `${cls.rate}%` }}
                                                    ></div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-red-50 rounded-xl p-3 text-center border border-red-100">
                                                    <span className="block text-2xl font-bold text-red-700">{cls.absent}</span>
                                                    <span className="text-xs font-bold text-red-400 uppercase">حالات غياب</span>
                                                </div>
                                                <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                                                    <span className="block text-2xl font-bold text-amber-700">{cls.late}</span>
                                                    <span className="text-xs font-bold text-amber-400 uppercase">حالات تأخر</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Charts */}
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Distribution Pie */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <PieIcon className="text-blue-900" size={18}/> توزيع الحالات لفصولي
                                </h3>
                                <div className="flex-1 h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                {pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                                            <Legend verticalAlign="bottom" height={36}/>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Class Comparison Bar */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <BarChart2 className="text-blue-900" size={18}/> مقارنة الفصول (غياب وتأخير)
                                </h3>
                                <div className="flex-1 h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={statsData.classChartData} barGap={0} barSize={30}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                                            <YAxis axisLine={false} tickLine={false} />
                                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                                            <Legend />
                                            <Bar dataKey="absent" name="غياب" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="late" name="تأخر" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Top Violators Tables */}
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Most Absent */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-center">
                                    <h3 className="font-bold text-red-900">الأكثر غياباً في فصولي</h3>
                                    <AlertCircle size={18} className="text-red-500" />
                                </div>
                                <table className="w-full text-right text-sm">
                                    <thead className="text-xs font-bold text-slate-500 uppercase border-b border-slate-100 bg-white">
                                        <tr>
                                            <th className="p-3">الطالب</th>
                                            <th className="p-3">الفصل</th>
                                            <th className="p-3 text-center">أيام الغياب</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {statsData.topAbsentStudents.map((s: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-red-50/30">
                                                <td className="p-3 font-bold text-slate-800">{s.name}</td>
                                                <td className="p-3 text-slate-500">{s.grade} - {s.className}</td>
                                                <td className="p-3 text-center font-bold text-red-600">{s.absent}</td>
                                            </tr>
                                        ))}
                                        {statsData.topAbsentStudents.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-slate-400">سجل نظيف</td></tr>}
                                    </tbody>
                                </table>
                            </div>

                            {/* Most Late */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex justify-between items-center">
                                    <h3 className="font-bold text-amber-900">الأكثر تأخراً في فصولي</h3>
                                    <Clock size={18} className="text-amber-500" />
                                </div>
                                <table className="w-full text-right text-sm">
                                    <thead className="text-xs font-bold text-slate-500 uppercase border-b border-slate-100 bg-white">
                                        <tr>
                                            <th className="p-3">الطالب</th>
                                            <th className="p-3">الفصل</th>
                                            <th className="p-3 text-center">أيام التأخر</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {statsData.topLateStudents.map((s: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-amber-50/20">
                                                <td className="p-3 font-bold text-slate-800">{s.name}</td>
                                                <td className="p-3 text-slate-500">{s.grade} - {s.className}</td>
                                                <td className="p-3 text-center font-bold text-amber-600">{s.late}</td>
                                            </tr>
                                        ))}
                                        {statsData.topLateStudents.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-slate-400">سجل نظيف</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </>
        )}
      </div>
    </>
  );
};

export default StaffReports;
