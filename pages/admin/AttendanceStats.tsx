
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { 
    Sparkles, BrainCircuit, Loader2, TrendingUp, AlertCircle, 
    PieChart as PieIcon, BarChart2, Lightbulb, Calendar, 
    UserX, Clock, ShieldAlert, Trophy, UserCheck, MessageSquare 
} from 'lucide-react';
import { getAttendanceRecords, generateSmartContent, getBehaviorRecords, getStudentObservations } from '../../services/storage';
import { AttendanceStatus } from '../../types';

const AttendanceStats: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [processingAI, setProcessingAI] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
        try {
            const [attendance, behavior, observations] = await Promise.all([
                getAttendanceRecords(),
                getBehaviorRecords(),
                getStudentObservations()
            ]);
            
            // --- ATTENDANCE AGGREGATION ---
            let totalRecords = 0;
            let present = 0, absent = 0, late = 0;
            const classMap: Record<string, any> = {};
            const studentStats: Record<string, {name: string, grade: string, className: string, absent: number, late: number}> = {};
            const dailyTrend: Record<string, any> = {};
            
            attendance.forEach(r => {
                const classKey = `${r.grade} - ${r.className}`;
                if (!classMap[classKey]) classMap[classKey] = { present: 0, absent: 0, late: 0, total: 0 };
                
                const dateKey = r.date;
                if(!dailyTrend[dateKey]) dailyTrend[dateKey] = { date: dateKey, absent: 0, late: 0 };

                r.records.forEach(student => {
                    totalRecords++;
                    classMap[classKey].total++;
                    
                    if(!studentStats[student.studentId]) studentStats[student.studentId] = { name: student.studentName, grade: r.grade, className: r.className, absent: 0, late: 0 };

                    if (student.status === AttendanceStatus.PRESENT) {
                        present++;
                        classMap[classKey].present++;
                    } else if (student.status === AttendanceStatus.ABSENT) {
                        absent++;
                        classMap[classKey].absent++;
                        dailyTrend[dateKey].absent++;
                        studentStats[student.studentId].absent++;
                    } else if (student.status === AttendanceStatus.LATE) {
                        late++;
                        classMap[classKey].late++;
                        dailyTrend[dateKey].late++;
                        studentStats[student.studentId].late++;
                    }
                });
            });

            // Top Students (Absent & Late)
            const topAbsentStudents = Object.values(studentStats).sort((a,b)=>b.absent-a.absent).slice(0,5).filter(s=>s.absent>0);
            const topLateStudents = Object.values(studentStats).sort((a,b)=>b.late-a.late).slice(0,5).filter(s=>s.late>0);

            // --- BEHAVIOR AGGREGATION ---
            const violationCounts: Record<string, number> = {};
            const studentViolations: Record<string, {name: string, count: number, grade: string}> = {};
            
            behavior.forEach(b => {
                violationCounts[b.violationName] = (violationCounts[b.violationName] || 0) + 1;
                if(!studentViolations[b.studentId]) studentViolations[b.studentId] = {name: b.studentName, count: 0, grade: b.grade};
                studentViolations[b.studentId].count++;
            });
            const topViolations = Object.entries(violationCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
            const topBehaviorStudents = Object.values(studentViolations).sort((a,b)=>b.count-a.count).slice(0,5);

            // --- OBSERVATION AGGREGATION ---
            const obsSentiment = { positive: 0, negative: 0 };
            const studentObsCount: Record<string, {name: string, count: number, grade: string}> = {};
            
            observations.forEach(o => {
                if (o.type === 'positive') obsSentiment.positive++;
                else obsSentiment.negative++;
                if(!studentObsCount[o.studentId]) studentObsCount[o.studentId] = {name: o.studentName, count: 0, grade: o.grade};
                studentObsCount[o.studentId].count++;
            });
            const topObsStudents = Object.values(studentObsCount).sort((a,b)=>b.count-a.count).slice(0,5);

            // Class Rankings
            const classData = Object.entries(classMap).map(([name, counts]) => ({
                name,
                attendanceRate: counts.total > 0 ? Math.round((counts.present / counts.total) * 100) : 0,
                absenceRate: counts.total > 0 ? Math.round((counts.absent / counts.total) * 100) : 0
            }));
            const topAttendanceClasses = [...classData].sort((a, b) => b.attendanceRate - a.attendanceRate).slice(0, 5);
            const topAbsenceClasses = [...classData].sort((a, b) => b.absenceRate - a.absenceRate).slice(0, 5);

            setStats({
                rates: {
                    present: totalRecords ? Math.round((present/totalRecords)*100) : 0,
                    absent: totalRecords ? Math.round((absent/totalRecords)*100) : 0,
                    late: totalRecords ? Math.round((late/totalRecords)*100) : 0,
                },
                topAttendanceClasses,
                topAbsenceClasses,
                topViolations,
                obsSentiment,
                dailyTrend: Object.values(dailyTrend).sort((a:any,b:any)=> new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-7),
                totalViolations: behavior.length,
                topAbsentStudents,
                topLateStudents,
                topBehaviorStudents,
                topObsStudents
            });

        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchStats();
  }, []);

  const generateDeepAnalysis = async () => {
    if(!stats) return;
    setProcessingAI(true);
    try {
        const prompt = `بصفتك خبير بيانات، حلل التالي:\nغياب: ${stats.rates.absent}%\nأهم المخالفات: ${stats.topViolations.map((v:any)=>v.name).join(',')}\nأعط 3 توصيات مركزة.`;
        const res = await generateSmartContent(prompt);
        setAiReport(res);
    } catch(e) { alert('فشل التوليد'); } finally { setProcessingAI(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-purple-900" size={48}/></div>;

  const TopListTable = ({ title, icon: Icon, color, data, valueKey, label }: any) => (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
          <div className={`p-4 border-b border-slate-100 flex justify-between items-center ${color.replace('text-', 'bg-').replace('600', '50').replace('500', '50')}`}>
              <h3 className={`font-bold ${color} flex items-center gap-2`}>
                  <Icon size={18}/> {title}
              </h3>
          </div>
          <div className="flex-1 overflow-y-auto">
              {data.length === 0 ? <p className="text-center py-8 text-slate-400 text-sm">سجل نظيف</p> : (
                  <table className="w-full text-sm text-right">
                      <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase"><tr><th className="p-3">الطالب</th><th className="p-3 text-center">{label}</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                          {data.map((item: any, i: number) => (
                              <tr key={i} className="hover:bg-slate-50">
                                  <td className="p-3 font-bold text-slate-800">{item.name}<div className="text-xs text-slate-400 font-normal">{item.grade}</div></td>
                                  <td className={`p-3 text-center font-bold ${color}`}>{item[valueKey]}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              )}
          </div>
      </div>
  );

  return (
    <div className="space-y-8 animate-fade-in pb-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div>
                <h1 className="text-2xl font-bold text-purple-900 flex items-center gap-2"><BrainCircuit className="text-pink-500"/> التحليل الذكي الشامل</h1>
                <p className="text-slate-500 mt-1">رؤية مركزية لجميع بيانات المدرسة وتحليل الأنماط</p>
            </div>
            <button onClick={generateDeepAnalysis} disabled={processingAI} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:shadow-lg transition-all">{processingAI ? <Loader2 className="animate-spin" size={20}/> : <Sparkles size={20} />} توليد التقرير الاستراتيجي</button>
        </div>

        {aiReport && (
            <div className="bg-white rounded-3xl border-2 border-purple-100 shadow-xl p-8 relative overflow-hidden animate-fade-in-up">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-50 rounded-full -mr-20 -mt-20 blur-3xl opacity-50"></div>
                <h2 className="text-xl font-bold text-purple-900 mb-4 relative z-10 flex items-center gap-2"><Lightbulb size={24} className="text-amber-400"/> الرؤية الاستراتيجية</h2>
                <div className="prose prose-purple max-w-none text-slate-700 leading-relaxed whitespace-pre-line font-medium relative z-10">{aiReport}</div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <TopListTable title="الأكثر غياباً" icon={UserX} color="text-red-600" data={stats.topAbsentStudents} valueKey="absent" label="أيام" />
            <TopListTable title="الأكثر تأخراً" icon={Clock} color="text-amber-600" data={stats.topLateStudents} valueKey="late" label="مرات" />
            <TopListTable title="الأكثر مخالفات" icon={ShieldAlert} color="text-purple-600" data={stats.topBehaviorStudents} valueKey="count" label="مخالفة" />
            <TopListTable title="الأكثر ملاحظات" icon={MessageSquare} color="text-blue-600" data={stats.topObsStudents} valueKey="count" label="ملاحظة" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 md:col-span-2">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><TrendingUp size={18} className="text-blue-600"/> مؤشر الغياب الأسبوعي</h3>
                <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={stats.dailyTrend}><defs><linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="date" tick={{fontSize:10}}/><Tooltip/><Area type="monotone" dataKey="absent" stroke="#ef4444" fill="url(#colorAbsent)"/></AreaChart></ResponsiveContainer></div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><PieIcon size={18} className="text-green-600"/> الانطباع العام (الملاحظات)</h3>
                <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{name:'إيجابي',value:stats.obsSentiment.positive,color:'#10b981'},{name:'سلبي',value:stats.obsSentiment.negative,color:'#ef4444'}]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value">{[{name:'إيجابي',value:stats.obsSentiment.positive,color:'#10b981'},{name:'سلبي',value:stats.obsSentiment.negative,color:'#ef4444'}].map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div>
            </div>
        </div>
    </div>
  );
};

export default AttendanceStats;
