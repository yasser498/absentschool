import React, { useState, useEffect } from 'react';
import { Calendar, Printer, Loader2, Sparkles, Send, FileSpreadsheet, AlertCircle, CheckCircle, FileText, X, User } from 'lucide-react';
import { getDailyAttendanceReport, generateSmartContent, sendAdminInsight, getRequests } from '../../services/storage';
import { AttendanceStatus, RequestStatus, ExcuseRequest } from '../../types';

const AttendanceReports: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<{
    totalPresent: number;
    totalAbsent: number;
    totalLate: number;
    details: any[];
  } | null>(null);
  
  const [dateRequests, setDateRequests] = useState<ExcuseRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const [data, allRequests] = await Promise.all([
            getDailyAttendanceReport(selectedDate),
            getRequests()
        ]);
        
        const reqs = allRequests.filter(r => r.date === selectedDate);
        setDateRequests(reqs);
        setReportData(data);
        
        setAiAnalysis(null); 
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [selectedDate]);

  const handlePrint = () => {
    window.print();
  };

  const analyzeReport = async () => {
      if (!reportData) return;
      setAnalyzing(true);
      try {
          const prompt = `
            حلل تقرير الحضور لهذا اليوم (${selectedDate}):
            - حضور: ${reportData.totalPresent}
            - غياب: ${reportData.totalAbsent}
            - تأخر: ${reportData.totalLate}
            - عدد الأعذار المقدمة: ${dateRequests.length}
            
            هل هذه النسب مقبولة؟ وما هي التوصيات لتحسين الانضباط غداً؟
            أجب باختصار في نقاط.
          `;
          const result = await generateSmartContent(prompt);
          setAiAnalysis(result);
      } catch (e) {
          alert("فشل التحليل");
      } finally {
          setAnalyzing(false);
      }
  };

  const handleSendAnalysis = async (target: 'counselor' | 'deputy') => {
      if (!aiAnalysis) return;
      try {
          await sendAdminInsight(target, aiAnalysis);
          alert("تم الإرسال بنجاح");
      } catch (e) {
          alert("فشل الإرسال");
      }
  };

  const getExcuseStatus = (studentId: string, studentName: string) => {
      const req = dateRequests.find(r => r.studentId === studentId) || dateRequests.find(r => r.studentName === studentName);
      return req ? req.status : null;
  };

  return (
    <div className="space-y-8 animate-fade-in">
        
        {/* CSS is handled globally in index.css now */}

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 no-print">
            <div>
                <h1 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
                    <FileSpreadsheet className="text-emerald-600"/> سجل الغياب اليومي
                </h1>
                <p className="text-slate-500 mt-1">عرض وطباعة كشوفات الغياب مع ربط الأعذار</p>
            </div>
            <div className="flex gap-2">
                <div className="relative">
                    <input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-900 outline-none text-slate-800 font-bold"
                    />
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                </div>
                <button onClick={handlePrint} className="bg-slate-800 text-white p-2.5 rounded-xl hover:bg-slate-700 transition-colors">
                    <Printer size={20} />
                </button>
            </div>
        </div>

        {loading || !reportData ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200 no-print">
                <Loader2 className="animate-spin mx-auto mb-4 text-blue-900" size={32} />
                <p className="text-slate-500 font-bold">جاري تحميل التقرير وربط الأعذار...</p>
            </div>
        ) : (
            <div id="print-area">
                
                {/* OFFICIAL PRINT HEADER */}
                <div className="hidden print:flex justify-between items-start border-b-2 border-black pb-6 mb-8">
                    <div className="text-right font-bold text-sm space-y-1">
                        <p>المملكة العربية السعودية</p>
                        <p>وزارة التعليم</p>
                        <p>إدارة المدرسة</p>
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold mb-2">تقرير الغياب اليومي</h1>
                        <p className="text-lg font-mono font-bold">{selectedDate}</p>
                    </div>
                    <div className="text-left">
                        <img src="https://www.raed.net/img?id=1471924" alt="Logo" className="h-24 object-contain" />
                    </div>
                </div>

                {/* AI Section (No Print) */}
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-2xl border border-indigo-100 no-print shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2 text-indigo-900 font-bold">
                            <Sparkles size={20} className="text-amber-500"/>
                            تحليل الذكاء الاصطناعي
                        </div>
                        {!aiAnalysis && (
                            <button 
                                onClick={analyzeReport} 
                                disabled={analyzing}
                                className="bg-white text-indigo-600 px-4 py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-indigo-50 disabled:opacity-50"
                            >
                                {analyzing ? 'جاري التحليل...' : 'تحليل التقرير'}
                            </button>
                        )}
                    </div>

                    {aiAnalysis ? (
                        <div className="animate-fade-in relative">
                            <div className="bg-white/60 backdrop-blur-md rounded-xl p-4 text-sm leading-relaxed whitespace-pre-line border border-white/50 mb-4 text-slate-800 font-medium">
                                {aiAnalysis}
                            </div>
                            <button onClick={() => setAiAnalysis(null)} className="absolute top-2 left-2 text-slate-400 hover:text-red-500"><X size={16}/></button>
                            <div className="flex gap-3">
                                <button onClick={() => handleSendAnalysis('counselor')} className="text-xs font-bold text-purple-700 bg-white px-3 py-2 rounded-lg hover:bg-purple-50 border border-purple-100 flex items-center gap-2 shadow-sm">
                                    <Send size={14}/> إرسال للموجه الطلابي
                                </button>
                                <button onClick={() => handleSendAnalysis('deputy')} className="text-xs font-bold text-blue-700 bg-white px-3 py-2 rounded-lg hover:bg-blue-50 border border-blue-100 flex items-center gap-2 shadow-sm">
                                    <Send size={14}/> إرسال للوكيل
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-indigo-900/60">اضغط على زر "تحليل التقرير" للحصول على رؤى ذكية حول بيانات اليوم.</p>
                    )}
                </div>

                {/* Summary Cards - Styled for Print too */}
                <div className="grid grid-cols-3 gap-6 print:grid print:grid-cols-3 print:gap-4 mb-8">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center print:border-black print:p-2">
                        <span className="block text-4xl font-bold text-emerald-700 mb-1 print:text-black">{reportData.totalPresent}</span>
                        <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider print:text-black">حضور</span>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center print:border-black print:p-2">
                        <span className="block text-4xl font-bold text-red-700 mb-1 print:text-black">{reportData.totalAbsent}</span>
                        <span className="text-xs font-bold text-red-600 uppercase tracking-wider print:text-black">غياب</span>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center print:border-black print:p-2">
                        <span className="block text-4xl font-bold text-amber-700 mb-1 print:text-black">{reportData.totalLate}</span>
                        <span className="text-xs font-bold text-amber-600 uppercase tracking-wider print:text-black">تأخر</span>
                    </div>
                </div>

                {/* Detailed Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
                    <table className="w-full text-right border-collapse print:w-full">
                        <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-200 print:bg-gray-200 print:text-black">
                            <tr>
                                <th className="p-4 print:p-2 print:border print:border-black">الطالب</th>
                                <th className="p-4 print:p-2 print:border print:border-black">المرحلة</th>
                                <th className="p-4 print:p-2 print:border print:border-black">حالة الحضور</th>
                                <th className="p-4 print:p-2 print:border print:border-black">حالة العذر</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm print:text-black">
                            {reportData.details.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-slate-400 font-bold flex flex-col items-center justify-center print:border print:border-black">
                                        <CheckCircle size={48} className="mb-2 text-emerald-200 print:hidden"/>
                                        سجل نظيف! لا يوجد غياب أو تأخر مسجل اليوم.
                                    </td>
                                </tr>
                            ) : (
                                reportData.details.map((item, index) => {
                                    const excuseStatus = getExcuseStatus(item.studentId, item.studentName);
                                    return (
                                    <tr key={index} className="hover:bg-blue-50/30 transition-colors group print:hover:bg-transparent">
                                        <td className="p-4 print:p-2 print:border print:border-black">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs border border-slate-200 print:hidden">
                                                    {item.studentName.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 print:text-black">{item.studentName}</p>
                                                    <p className="text-[10px] text-slate-400 font-mono hidden group-hover:block transition-all print:block print:text-black">{item.studentId || 'ID Missing'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 print:p-2 print:border print:border-black">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 print:text-black">{item.grade}</span>
                                                <span className="text-xs text-slate-500 print:text-black">فصل {item.className}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 print:p-2 print:border print:border-black">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold print:bg-white print:text-black print:border-0 print:p-0 ${
                                                item.status === AttendanceStatus.ABSENT 
                                                ? 'bg-red-50 text-red-700 border border-red-100' 
                                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                                            }`}>
                                                {item.status === AttendanceStatus.ABSENT ? 'غياب' : 'تأخر'}
                                            </span>
                                        </td>
                                        <td className="p-4 print:p-2 print:border print:border-black">
                                            {excuseStatus ? (
                                                <span className={`flex items-center gap-1.5 w-fit px-3 py-1.5 rounded-lg text-xs font-bold border print:bg-white print:text-black print:border-0 print:p-0 ${
                                                    excuseStatus === RequestStatus.APPROVED ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    excuseStatus === RequestStatus.REJECTED ? 'bg-red-50 text-red-700 border-red-200' :
                                                    'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                    {excuseStatus === RequestStatus.APPROVED ? 'مقبول' :
                                                     excuseStatus === RequestStatus.REJECTED ? 'مرفوض' : 'قيد المراجعة'}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-xs px-2 py-1 bg-slate-50 rounded border border-slate-100 print:bg-white print:text-black print:border-0">لا يوجد عذر</span>
                                            )}
                                        </td>
                                    </tr>
                                )})
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-12 flex justify-between px-8 hidden print:flex">
                     <div className="text-center">
                         <p className="font-bold mb-8">وكيل الشؤون الطلابية</p>
                         <p>.............................</p>
                     </div>
                     <div className="text-center">
                         <p className="font-bold mb-8">مدير المدرسة</p>
                         <p>.............................</p>
                     </div>
                </div>
                
                <div className="mt-8 text-center text-xs text-slate-400 hidden print:block border-t pt-2">
                     تم استخراج هذا التقرير آلياً من نظام عذر الإلكتروني - {new Date().toLocaleDateString('ar-SA')}
                </div>
            </div>
        )}
    </div>
  );
};

export default AttendanceReports;