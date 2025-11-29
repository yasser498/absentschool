
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { 
    Sparkles, 
    BrainCircuit, 
    Send, 
    Loader2, 
    TrendingUp, 
    AlertCircle, 
    PieChart as PieIcon,
    BarChart2,
    Lightbulb,
    Calendar,
    UserX,
    Clock
} from 'lucide-react';
import { getAttendanceRecords, generateSmartContent, sendAdminInsight } from '../../services/storage';
import { AttendanceStatus } from '../../types';

const AttendanceStats: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // AI States
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [predictionReport, setPredictionReport] = useState<string | null>(null);
  const [processingAI, setProcessingAI] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
        try {
            const records = await getAttendanceRecords();
            
            // Calculate aggregations
            let totalRecords = 0;
            let present = 0;
            let absent = 0;
            let late = 0;
            
            const classMap: Record<string, { present: number, absent: number, late: number, total: number }> = {};
            const dayMap: Record<string, number> = {}; // For busiest day
            const dailyTrend: Record<string, { date: string, absent: number, late: number }> = {};
            const studentMap: Record<string, { name: string, grade: string, className: string, absent: number, late: number }> = {};

            records.forEach(r => {
                const dayName = new Date(r.date).toLocaleDateString('ar-SA', {weekday: 'long'});
                const dateKey = r.date;

                // Initialize daily trend
                if (!dailyTrend[dateKey]) dailyTrend[dateKey] = { date: dateKey, absent: 0, late: 0 };

                // Initialize class stats
                const classKey = `${r.grade} - ${r.className}`;
                if (!classMap[classKey]) classMap[classKey] = { present: 0, absent: 0, late: 0, total: 0 };

                r.records.forEach(student => {
                    totalRecords++;
                    classMap[classKey].total++;

                    // Initialize Student Stats
                    if (!studentMap[student.studentId]) {
                        studentMap[student.studentId] = { 
                            name: student.studentName, 
                            grade: r.grade, 
                            className: r.className, 
                            absent: 0, 
                            late: 0 
                        };
                    }

                    if (student.status === AttendanceStatus.PRESENT) {
                        present++;
                        classMap[classKey].present++;
                    } else if (student.status === AttendanceStatus.ABSENT) {
                        absent++;
                        classMap[classKey].absent++;
                        dayMap[dayName] = (dayMap[dayName] || 0) + 1;
                        dailyTrend[dateKey].absent++;
                        studentMap[student.studentId].absent++;
                    } else if (student.status === AttendanceStatus.LATE) {
                        late++;
                        classMap[classKey].late++;
                        dailyTrend[dateKey].late++;
                        studentMap[student.studentId].late++;
                    }
                });
            });

            // 1. Class Performance (Sorted by Absence Rate - Highest to Lowest)
            const classData = Object.entries(classMap).map(([name, counts]) => ({
                name,
                absent: counts.absent,
                late: counts.late,
                present: counts.present,
                total: counts.total,
                absenceRate: counts.total > 0 ? Math.round((counts.absent / counts.total) * 100) : 0
            })).sort((a, b) => b.absenceRate - a.absenceRate); // Sort descending

            // 2. Daily Trend Data (Last 7 entries)
            const trendData = Object.values(dailyTrend)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(-7);

            // 3. Risk Lists
            const topAbsent = Object.values(studentMap)
                .sort((a, b) => b.absent - a.absent)
                .filter(s => s.absent > 0)
                .slice(0, 5);

            const topLate = Object.values(studentMap)
                .sort((a, b) => b.late - a.late)
                .filter(s => s.late > 0)
                .slice(0, 5);

            // Busiest Day
            const busiestDay = Object.entries(dayMap).sort((a,b) => b[1] - a[1])[0]?.[0] || '-';

            setStats({
                totalRecords,
                present,
                absent,
                late,
                rates: {
                    present: totalRecords ? Math.round((present/totalRecords)*100) : 0,
                    absent: totalRecords ? Math.round((absent/totalRecords)*100) : 0,
                    late: totalRecords ? Math.round((late/totalRecords)*100) : 0,
                },
                classData,
                trendData,
                topAbsent,
                topLate,
                busiestDay
            });

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    fetchStats();
  }, []);

  // ... (AI Functions remain same)
  const generateStrategy = async () => {
    if(!stats) return;
    setProcessingAI(true);
    try {
        const prompt = `
            بصفتك خبير استراتيجي تربوي، حلل بيانات المدرسة:
            - نسبة الغياب: ${stats.rates.absent}%
            - نسبة التأخر: ${stats.rates.late}%
            - اليوم الأكثر غياباً: ${stats.busiestDay}
            
            اقترح خطة استراتيجية من 3 نقاط لتحسين الانضباط.
        `;
        const res = await generateSmartContent(prompt);
        setAiReport(res);
    } catch(e) { alert('فشل التوليد'); }
    finally { setProcessingAI(false); }
  };

  const predictRisks = async () => {
    if(!stats) return;
    setProcessingAI(true);
    try {
        const prompt = `
            بناءً على نسبة غياب ${stats.rates.absent}%، 
            تنبأ بالمخاطر المحتملة على التحصيل الدراسي.
        `;
        const res = await generateSmartContent(prompt);
        setPredictionReport(res);
    } catch(e) { alert('فشل التوليد'); }
    finally { setProcessingAI(false); }
  };

  const handleSendReport = async (content: string, role: 'counselor' | 'deputy') => {
      try {
          await sendAdminInsight(role, content);
          alert('تم الإرسال');
      } catch (e) { alert('فشل الإرسال'); }
  };

  const pieData = stats ? [
      { name: 'حضور', value: stats.present, color: '#10b981' },
      { name: 'غياب', value: stats.absent, color: '#ef4444' },
      { name: 'تأخر', value: stats.late, color: '#f59e0b' },
  ] : [];

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-900" size={40}/></div>;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h1 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
                    <TrendingUp className="text-purple-600"/> التحليل والإحصائيات
                </h1>
                <p className="text-slate-500 mt-1">لوحة المعلومات البيانية والتحليل الاستراتيجي</p>
            </div>
            <div className="flex gap-2">
                <button onClick={generateStrategy} disabled={processingAI} className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md hover:bg-amber-600 transition-all">
                    {processingAI ? <Loader2 className="animate-spin" size={16}/> : <Lightbulb size={16} />} اقتراح استراتيجية
                </button>
                <button onClick={predictRisks} disabled={processingAI} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 transition-all">
                    {processingAI ? <Loader2 className="animate-spin" size={16}/> : <BrainCircuit size={16} />} تنبؤ المخاطر
                </button>
            </div>
        </div>

        {/* AI Reports Rendering ... (Same as before) */}
        <div className="space-y-6">
            {aiReport && (
                <div className="bg-white rounded-2xl shadow-lg border border-amber-100 p-6 relative">
                    <button onClick={() => setAiReport(null)} className="absolute top-4 left-4 text-slate-400 hover:text-red-500"><span className="sr-only">close</span>✕</button>
                    <h2 className="text-lg font-bold text-amber-800 mb-3 flex items-center gap-2"><Sparkles size={18}/> التقرير الاستراتيجي</h2>
                    <p className="whitespace-pre-line text-sm text-slate-700">{aiReport}</p>
                    <div className="mt-4 flex gap-3"><button onClick={()=>handleSendReport(aiReport, 'counselor')} className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded border border-amber-200">إرسال للمرشد</button></div>
                </div>
            )}
            {predictionReport && (
                <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 p-6 relative">
                    <button onClick={() => setPredictionReport(null)} className="absolute top-4 left-4 text-slate-400 hover:text-red-500"><span className="sr-only">close</span>✕</button>
                    <h2 className="text-lg font-bold text-indigo-800 mb-3 flex items-center gap-2"><BrainCircuit size={18}/> تقرير المخاطر</h2>
                    <p className="whitespace-pre-line text-sm text-slate-700">{predictionReport}</p>
                </div>
            )}
        </div>

        {/* 1. KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center">
                <p className="text-slate-500 text-xs font-bold uppercase mb-2">نسبة الغياب</p>
                <p className="text-4xl font-extrabold text-red-600">{stats.rates.absent}%</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center">
                <p className="text-slate-500 text-xs font-bold uppercase mb-2">نسبة التأخر</p>
                <p className="text-4xl font-extrabold text-amber-600">{stats.rates.late}%</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center">
                <p className="text-slate-500 text-xs font-bold uppercase mb-2">نسبة الحضور</p>
                <p className="text-4xl font-extrabold text-emerald-600">{stats.rates.present}%</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center">
                <p className="text-slate-500 text-xs font-bold uppercase mb-2">الأكثر غياباً</p>
                <p className="text-2xl font-extrabold text-purple-900 mt-2">{stats.busiestDay}</p>
            </div>
        </div>

        {/* 2. Charts Grid */}
        <div className="grid md:grid-cols-2 gap-6">
            {/* Daily Trend (Area Chart) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Calendar className="text-blue-500" size={18}/> توزيع الغياب على الأيام
                </h3>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.trendData}>
                            <defs>
                                <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{borderRadius: '8px', border: 'none'}} />
                            <Area type="monotone" dataKey="absent" stroke="#ef4444" fillOpacity={1} fill="url(#colorAbsent)" name="عدد الغياب" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Class Performance (Ranking Bar Chart) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <BarChart2 className="text-red-500" size={18}/> ترتيب الفصول (من الأكثر غياباً)
                </h3>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.classData} layout="vertical" margin={{left: 40}}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={100} tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none'}} />
                            <Bar dataKey="absenceRate" name="نسبة الغياب %" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={15} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* 3. Risk Lists */}
        <div className="grid md:grid-cols-2 gap-6">
            {/* Most Absent Students */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-center">
                    <h3 className="font-bold text-red-900 flex items-center gap-2"><UserX size={18}/> قائمة الخطر: الأكثر غياباً</h3>
                </div>
                <table className="w-full text-right text-sm">
                    <thead className="bg-white text-slate-500 font-bold border-b border-slate-100 text-xs uppercase">
                        <tr>
                            <th className="p-4">الطالب</th>
                            <th className="p-4">الفصل</th>
                            <th className="p-4 text-center">أيام الغياب</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {stats.topAbsent.map((s: any, idx: number) => (
                            <tr key={idx} className="hover:bg-red-50/30">
                                <td className="p-4 font-bold text-slate-800">{s.name}</td>
                                <td className="p-4 text-slate-500">{s.grade} - {s.className}</td>
                                <td className="p-4 text-center font-bold text-red-600">{s.absent}</td>
                            </tr>
                        ))}
                        {stats.topAbsent.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-slate-400">سجل نظيف</td></tr>}
                    </tbody>
                </table>
            </div>

            {/* Most Late Students */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex justify-between items-center">
                    <h3 className="font-bold text-amber-900 flex items-center gap-2"><Clock size={18}/> قائمة الخطر: الأكثر تأخراً</h3>
                </div>
                <table className="w-full text-right text-sm">
                    <thead className="bg-white text-slate-500 font-bold border-b border-slate-100 text-xs uppercase">
                        <tr>
                            <th className="p-4">الطالب</th>
                            <th className="p-4">الفصل</th>
                            <th className="p-4 text-center">أيام التأخر</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {stats.topLate.map((s: any, idx: number) => (
                            <tr key={idx} className="hover:bg-amber-50/30">
                                <td className="p-4 font-bold text-slate-800">{s.name}</td>
                                <td className="p-4 text-slate-500">{s.grade} - {s.className}</td>
                                <td className="p-4 text-center font-bold text-amber-600">{s.late}</td>
                            </tr>
                        ))}
                        {stats.topLate.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-slate-400">سجل نظيف</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default AttendanceStats;
