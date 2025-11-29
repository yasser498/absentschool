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

  // School Info
  const SCHOOL_NAME = localStorage.getItem('school_name') || "متوسطة عماد الدين زنكي";
  const SCHOOL_LOGO = "https://www.raed.net/img?id=1471924";

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
        
        {/* UNIFIED PRINT TEMPLATE */}
        <div id="print-area" className="hidden" dir="rtl">
            {/* Header */}
            <div className="print-header">
                <div className="print-header-right">
                    <p>المملكة العربية السعودية</p>
                    <p>وزارة التعليم</p>
                    <p>{SCHOOL_NAME}</p>
                </div>
                <div className="print-header-center">
                    <img src={SCHOOL_LOGO} alt="Logo" className="print-logo mx-auto" />
                </div>
                <div className="print-header-left">
                    <p>Ministry of Education</p>
                    <p>Student Attendance</p>
                    <p>{new Date().toLocaleDateString('en-GB')}</p>
                </div>
            </div>

            {/* Title & Date */}
            <div className="text-center mb-6">
                <h1 className="text-xl font-bold border-b-2 border-black inline-block pb-1">تقرير الغياب اليومي</h1>
                <p className="text-lg font-mono font-bold mt-2">{selectedDate}</p>
            </div>

            {/* Stats Summary */}
            {reportData && (
                <div className="flex justify-between gap-4 mb-6 text-center border-b border-black pb-4">
                    <div className="flex-1 border border-black p-2">
                        <div className="font-bold text-sm">إجمالي الحضور</div>
                        <div className="text-xl font-bold">{reportData.totalPresent}</div>
                    </div>
                    <div className="flex-1 border border-black p-2">
                        <div className="font-bold text-sm">إجمالي الغياب</div>
                        <div className="text-xl font-bold">{reportData.totalAbsent}</div>
                    </div>
                    <div className="flex-1 border border-black p-2">
                        <div className="font-bold text-sm">إجمالي التأخر</div>
                        <div className="text-xl font-bold">{reportData.totalLate}</div>
                    </div>
                </div>
            )}

            {/* Main Table */}
            {reportData && (
                <table className="w-full text-right border-collapse">
                    <thead>
                        <tr>
                            <th style={{ width: '5%' }}>م</th>
                            <th style={{ width: '30%' }}>الطالب</th>
                            <th style={{ width: '25%' }}>الصف / الفصل</th>
                            <th style={{ width: '20%' }}>حالة الحضور</th>
                            <th style={{ width: '20%' }}>حالة العذر</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.details.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center font-bold">
                                    سجل نظيف! لا يوجد غياب أو تأخر مسجل اليوم.
                                </td>
                            </tr>
                        ) : (
                            reportData.details.map((item, index) => {
                                const excuseStatus = getExcuseStatus(item.studentId, item.studentName);
                                return (
                                <tr key={index}>
                                    <td>{index + 1}</td>
                                    <td className="font-bold">
                                        {item.studentName}
                                        <div className="text-[10px] mt-1">{item.studentId}</div>
                                    </td>
                                    <td>{item.grade} - {item.className}</td>
                                    <td>{item.status === AttendanceStatus.ABSENT ? 'غياب' : 'تأخر'}</td>
                                    <td>
                                        {excuseStatus ? (
                                            excuseStatus === RequestStatus.APPROVED ? 'مقبول' :
                                            excuseStatus === RequestStatus.REJECTED ? 'مرفوض' : 'قيد المراجعة'
                                        ) : 'لا يوجد عذر'}
                                    </td>
                                </tr>
                            )})
                        )}
                    </tbody>
                </table>
            )}

            {/* Footer */}
            <div className="mt-16 flex justify-between px-12">
                 <div className="text-center">
                     <p className="font-bold mb-8">وكيل الشؤون الطلابية</p>
                     <p>.............................</p>
                 </div>
                 <div className="text-center">
                     <p className="font-bold mb-8">مدير المدرسة</p>
                     <p>.............................</p>
                 </div>
            </div>
            <div className="mt-8 text-center text-[10px] border-t pt-2">
                 تم استخراج هذا التقرير آلياً من نظام عذر الإلكتروني - {new Date().toLocaleDateString('ar-SA')}
            </div>
        </div>

        {/* SCREEN UI (NO CHANGES TO LOGIC) */}
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
            <div className="no-print">
                
                {/* AI Section (No Print) */}
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-2xl border border-indigo-100 no-print shadow-sm mb-8">
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

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                        <span className="block text-4xl font-bold text-emerald-700 mb-1">{reportData.totalPresent}</span>
                        <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">حضور</span>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                        <span className="block text-4xl font-bold text-red-700 mb-1">{reportData.totalAbsent}</span>
                        <span className="text-xs font-bold text-red-600 uppercase tracking-wider">غياب</span>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
                        <span className="block text-4xl font-bold text-amber-700 mb-1">{reportData.totalLate}</span>
                        <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">تأخر</span>
                    </div>
                </div>

                {/* Detailed Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-right border-collapse">
                        <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-200">
                            <tr>
                                <th className="p-4">الطالب</th>
                                <th className="p-4">المرحلة</th>
                                <th className="p-4">حالة الحضور</th>
                                <th className="p-4">حالة العذر</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {reportData.details.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-slate-400 font-bold flex flex-col items-center justify-center">
                                        <CheckCircle size={48} className="mb-2 text-emerald-200"/>
                                        سجل نظيف! لا يوجد غياب أو تأخر مسجل اليوم.
                                    </td>
                                </tr>
                            ) : (
                                reportData.details.map((item, index) => {
                                    const excuseStatus = getExcuseStatus(item.studentId, item.studentName);
                                    return (
                                    <tr key={index} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs border border-slate-200">
                                                    {item.studentName.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">{item.studentName}</p>
                                                    <p className="text-[10px] text-slate-400 font-mono hidden group-hover:block transition-all">{item.studentId || 'ID Missing'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700">{item.grade}</span>
                                                <span className="text-xs text-slate-500">فصل {item.className}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                                                item.status === AttendanceStatus.ABSENT 
                                                ? 'bg-red-50 text-red-700 border border-red-100' 
                                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                                            }`}>
                                                {item.status === AttendanceStatus.ABSENT ? 'غياب' : 'تأخر'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {excuseStatus ? (
                                                <span className={`flex items-center gap-1.5 w-fit px-3 py-1.5 rounded-lg text-xs font-bold border ${
                                                    excuseStatus === RequestStatus.APPROVED ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    excuseStatus === RequestStatus.REJECTED ? 'bg-red-50 text-red-700 border-red-200' :
                                                    'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                    {excuseStatus === RequestStatus.APPROVED ? 'مقبول' :
                                                     excuseStatus === RequestStatus.REJECTED ? 'مرفوض' : 'قيد المراجعة'}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-xs px-2 py-1 bg-slate-50 rounded border border-slate-100">لا يوجد عذر</span>
                                            )}
                                        </td>
                                    </tr>
                                )})
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </div>
  );
};

export default AttendanceReports;