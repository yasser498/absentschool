
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QrCode, CheckCircle, AlertCircle, Loader2, User, Clock, RefreshCw, XCircle, Printer, List, ShieldCheck, FileText, LayoutGrid, Sparkles, BrainCircuit, Calendar, ArrowRight, Bell, LogOut, Home, X } from 'lucide-react';
import { checkInVisitor, getDailyAppointments, generateSmartContent } from '../../services/storage';
import { Appointment } from '../../types';

// Declare global Html5QrcodeScanner
declare var Html5QrcodeScanner: any;

const GateScanner: React.FC = () => {
  // View State - Default is now SCANNER (Always Ready)
  // We use overlays for logs and analytics to keep camera mounted
  const [showLog, setShowLog] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scannedAppointment, setScannedAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [todaysVisits, setTodaysVisits] = useState<Appointment[]>([]);
  
  // AI State
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // School Identity
  const SCHOOL_NAME = localStorage.getItem('school_name') || "متوسطة عماد الدين زنكي";
  const SCHOOL_LOGO = "https://www.raed.net/img?id=1471924"; 

  const scannerRef = useRef<any>(null);
  const isScannerRunning = useRef<boolean>(false);

  // Stats
  const stats = useMemo(() => {
      const total = todaysVisits.length;
      const arrived = todaysVisits.filter(v => v.status === 'completed').length;
      return { total, arrived, pending: total - arrived };
  }, [todaysVisits]);

  const fetchDailyVisits = async () => {
      const today = new Date().toISOString().split('T')[0];
      const visits = await getDailyAppointments(today);
      setTodaysVisits(visits);
  };

  useEffect(() => {
    fetchDailyVisits();
  }, []);

  // Scanner Logic - Runs ONCE on mount
  useEffect(() => {
    const initScanner = () => {
        if (isScannerRunning.current) return;
        
        // Slight delay to ensure DOM is ready
        setTimeout(() => {
            if (document.getElementById('reader')) {
                const onScanSuccess = (decodedText: string, decodedResult: any) => {
                    // Do not clear scanner here, just pause processing visually
                    if (scanResult !== decodedText) {
                        setScanResult(decodedText);
                        handleScanProcess(decodedText);
                    }
                };
    
                const onScanFailure = (error: any) => {
                    // handle error quietly
                };
    
                try {
                    const html5QrcodeScanner = new Html5QrcodeScanner(
                        "reader",
                        { fps: 10, qrbox: { width: 250, height: 250 } },
                        false
                    );
                    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
                    scannerRef.current = html5QrcodeScanner;
                    isScannerRunning.current = true;
                } catch (e) {
                    console.error("Scanner init error", e);
                }
            }
        }, 500);
    };

    initScanner();

    // Cleanup only on component unmount
    return () => {
        if (scannerRef.current) {
            try { 
                scannerRef.current.clear().catch(() => {}); 
                isScannerRunning.current = false;
            } catch(e) {}
        }
    };
  }, []);

  const handleScanProcess = async (appointmentId: string) => {
      setLoading(true);
      setError(null);
      setCheckInSuccess(false); // Reset previous success
      
      try {
          const today = new Date().toISOString().split('T')[0];
          // Re-fetch to be sure
          const appointments = await getDailyAppointments(today); 
          setTodaysVisits(appointments);
          
          const found = appointments.find((a: any) => a.id === appointmentId);
          
          if (found) {
              setScannedAppointment(found);
              if (found.status === 'completed') {
                  setCheckInSuccess(true); 
                  setError("هذا الزائر قام بتسجيل الدخول مسبقاً.");
              } else {
                  setCheckInSuccess(false);
              }
          } else {
              setScannedAppointment(null);
              setError("الموعد غير موجود أو غير مسجل لهذا اليوم.");
          }
      } catch (e) {
          setError("حدث خطأ أثناء التحقق من البيانات.");
      } finally {
          setLoading(false);
      }
  };

  const confirmCheckIn = async () => {
      if (!scannedAppointment) return;
      if (scannedAppointment.status === 'completed') return;

      setLoading(true);
      try {
          await checkInVisitor(scannedAppointment.id);
          setCheckInSuccess(true);
          setError(null); 
          fetchDailyVisits(); 
      } catch (e) {
          setError("فشل تسجيل الدخول.");
      } finally {
          setLoading(false);
      }
  };

  const resetScanner = () => {
      setScanResult(null);
      setScannedAppointment(null);
      setError(null);
      setCheckInSuccess(false);
      // Scanner stays running in background, just resetting state
  };

  const handleGenerateAnalysis = async () => {
      setIsAnalyzing(true);
      try {
          const prompt = `
          بصفتك مسؤول أمن محترف، حلل سجل الزوار لهذا اليوم:
          - إجمالي المواعيد: ${stats.total}
          - تم الدخول فعلياً: ${stats.arrived}
          - لم يصلوا: ${stats.pending}
          
          قائمة الزوار وأسباب الزيارة:
          ${todaysVisits.map(v => `- ${v.parentName} (السبب: ${v.visitReason})`).join('\n')}

          المطلوب:
          1. ملخص لحركة البوابة اليوم.
          2. ملاحظة حول طبيعة الزيارات.
          3. توصية لتحسين تنظيم الدخول غداً.
          `;
          const res = await generateSmartContent(prompt);
          setAiReport(res);
      } catch (e) {
          alert("فشل التحليل");
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handlePrintReport = () => {
      window.print();
  };

  return (
    <>
    {/* UNIFIED PRINT REPORT TEMPLATE */}
    <div id="gate-report" className="hidden" dir="rtl">
        {/* Unified Header */}
        <div className="print-header">
            <div className="print-header-right">
                <p>المملكة العربية السعودية</p>
                <p>وزارة التعليم</p>
                <p>{SCHOOL_NAME}</p>
            </div>
            <div className="print-header-center">
                <img src={SCHOOL_LOGO} alt="School Logo" className="print-logo mx-auto" />
            </div>
            <div className="print-header-left">
                <p>Ministry of Education</p>
                <p>Security & Safety</p>
                <p>{new Date().toLocaleDateString('en-GB')}</p>
            </div>
        </div>

        {/* Report Title */}
        <div className="text-center mb-6">
            <h1 className="text-xl font-bold border-b-2 border-black inline-block pb-1">سجل الزوار اليومي (بوابة الأمن)</h1>
            <p className="text-sm mt-2">التاريخ: {new Date().toLocaleDateString('ar-SA', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</p>
        </div>

        {/* Stats Summary Table */}
        <table className="mb-6 w-full text-center">
             <thead>
                 <tr>
                     <th>إجمالي المواعيد</th>
                     <th>تم الدخول</th>
                     <th>لم يصل / غائب</th>
                 </tr>
             </thead>
             <tbody>
                 <tr>
                     <td className="font-bold">{stats.total}</td>
                     <td className="font-bold">{stats.arrived}</td>
                     <td className="font-bold">{stats.pending}</td>
                 </tr>
             </tbody>
        </table>

        {/* Main Data Table */}
        <table className="w-full text-right text-sm">
            <thead>
                <tr>
                    <th style={{ width: '5%' }}>م</th>
                    <th style={{ width: '20%' }}>اسم الزائر</th>
                    <th style={{ width: '20%' }}>اسم الطالب</th>
                    <th style={{ width: '15%' }}>وقت الموعد</th>
                    <th style={{ width: '15%' }}>وقت الوصول</th>
                    <th style={{ width: '25%' }}>سبب الزيارة</th>
                </tr>
            </thead>
            <tbody>
                {todaysVisits.length > 0 ? (
                    todaysVisits.map((v, idx) => (
                        <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td className="font-bold">{v.parentName}</td>
                            <td>{v.studentName}</td>
                            <td>{v.slot?.startTime}</td>
                            <td>{v.arrivedAt ? new Date(v.arrivedAt).toLocaleTimeString('ar-SA') : '-'}</td>
                            <td>{v.visitReason}</td>
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan={6} className="text-center p-4">لا توجد زيارات مسجلة لهذا اليوم</td>
                    </tr>
                )}
            </tbody>
        </table>

        {/* Footer Signatures */}
        <div className="mt-16 flex justify-between px-10">
            <div className="text-center">
                <p className="font-bold mb-8">مسؤول الأمن والسلامة</p>
                <p>.............................</p>
            </div>
            <div className="text-center">
                <p className="font-bold mb-8">مدير المدرسة</p>
                <p>.............................</p>
            </div>
        </div>
    </div>

    <div className="max-w-7xl mx-auto animate-fade-in space-y-6 no-print pb-20">
        
        {/* COMPACT HEADER */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
                <div className="bg-teal-50 p-2.5 rounded-xl text-teal-600">
                    <ShieldCheck size={24} />
                </div>
                <div>
                    <h1 className="text-lg font-bold text-slate-900">بوابة الأمن الذكية</h1>
                    <p className="text-xs text-slate-500 font-medium">الماسح الضوئي نشط دائماً</p>
                </div>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
                <button onClick={() => setShowLog(true)} className="flex-1 md:flex-none bg-blue-50 text-blue-600 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 border border-blue-100">
                    <List size={18} /> سجل الزوار
                </button>
                <button onClick={() => setShowAnalytics(true)} className="flex-1 md:flex-none bg-purple-50 text-purple-600 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-purple-100 transition-colors flex items-center justify-center gap-2 border border-purple-100">
                    <BrainCircuit size={18} /> التحليل الأمني
                </button>
            </div>
        </div>

        {/* MAIN SCANNER AREA - ALWAYS VISIBLE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 1. Camera Feed */}
            <div className="bg-slate-900 rounded-3xl shadow-xl overflow-hidden flex flex-col relative border-4 border-slate-800 h-[500px]">
                <div className="absolute top-4 left-4 z-10 bg-red-600/90 text-white text-[10px] font-bold px-3 py-1 rounded-full animate-pulse flex items-center gap-1">
                    <div className="w-2 h-2 bg-white rounded-full"></div> مباشر
                </div>
                
                {/* Check-in Status Overlay */}
                {scanResult && (
                    <div className="absolute inset-0 z-20 bg-slate-900/95 flex flex-col items-center justify-center p-8 animate-fade-in text-center">
                        {loading ? (
                            <Loader2 size={48} className="text-teal-500 animate-spin mb-4"/>
                        ) : checkInSuccess ? (
                            <CheckCircle size={64} className="text-emerald-500 mb-4"/>
                        ) : error ? (
                            <XCircle size={64} className="text-red-500 mb-4"/>
                        ) : (
                            <AlertCircle size={64} className="text-blue-500 mb-4"/>
                        )}

                        <h3 className="text-2xl font-bold text-white mb-2">
                            {checkInSuccess ? 'تم تسجيل الدخول' : error ? 'خطأ في التحقق' : 'تأكيد البيانات'}
                        </h3>
                        
                        <p className={`text-sm mb-6 ${checkInSuccess ? 'text-emerald-400' : error ? 'text-red-400' : 'text-slate-400'}`}>
                            {checkInSuccess ? `وقت الدخول: ${new Date().toLocaleTimeString('ar-SA')}` : error ? error : 'يرجى مراجعة بيانات الزائر أدناه'}
                        </p>

                        {scannedAppointment && (
                            <div className="bg-white/10 rounded-xl p-4 w-full text-sm text-left mb-6 border border-white/10">
                                <div className="flex justify-between border-b border-white/10 pb-2 mb-2">
                                    <span className="text-slate-400">الزائر</span>
                                    <span className="text-white font-bold">{scannedAppointment.parentName}</span>
                                </div>
                                <div className="flex justify-between border-b border-white/10 pb-2 mb-2">
                                    <span className="text-slate-400">الطالب</span>
                                    <span className="text-white font-bold">{scannedAppointment.studentName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">السبب</span>
                                    <span className="text-white font-bold">{scannedAppointment.visitReason}</span>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 w-full">
                            {!checkInSuccess && !error && (
                                <button onClick={confirmCheckIn} className="flex-1 bg-teal-500 hover:bg-teal-600 text-white py-3 rounded-xl font-bold transition-colors">
                                    تأكيد الدخول
                                </button>
                            )}
                            <button onClick={resetScanner} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold border border-white/10 transition-colors">
                                مسح جديد
                            </button>
                        </div>
                    </div>
                )}

                {/* The Scanner Element */}
                <div id="reader" className="w-full h-full object-cover"></div>
                
                {/* Scan Frame Decor */}
                {!scanResult && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-64 h-64 border-2 border-teal-500/50 rounded-3xl relative">
                            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-teal-500 rounded-tl-xl"></div>
                            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-teal-500 rounded-tr-xl"></div>
                            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-teal-500 rounded-bl-xl"></div>
                            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-teal-500 rounded-br-xl"></div>
                        </div>
                        <p className="absolute bottom-8 text-white/70 text-sm font-medium bg-black/20 px-4 py-1 rounded-full backdrop-blur-sm">وجه الكاميرا نحو رمز QR</p>
                    </div>
                )}
            </div>

            {/* 2. Side Panel (Stats & Recent) */}
            <div className="flex flex-col gap-6 h-[500px]">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
                        <span className="block text-2xl font-extrabold text-slate-800">{stats.total}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">الكل</span>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm text-center">
                        <span className="block text-2xl font-extrabold text-emerald-600">{stats.arrived}</span>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase">وصل</span>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 shadow-sm text-center">
                        <span className="block text-2xl font-extrabold text-amber-600">{stats.pending}</span>
                        <span className="text-[10px] font-bold text-amber-600 uppercase">انتظار</span>
                    </div>
                </div>

                {/* Recent List */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Clock className="text-blue-600" size={18}/> آخر عمليات الدخول</h3>
                        <button onClick={fetchDailyVisits} className="text-slate-400 hover:text-blue-600"><RefreshCw size={16}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                        {todaysVisits.filter(v => v.status === 'completed').length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                                <List size={40} className="mb-2"/>
                                <p className="text-sm">سجل الدخول فارغ</p>
                            </div>
                        ) : (
                            todaysVisits.filter(v => v.status === 'completed').sort((a,b) => new Date(b.arrivedAt!).getTime() - new Date(a.arrivedAt!).getTime()).map(v => (
                                <div key={v.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{v.parentName}</p>
                                        <p className="text-[10px] text-slate-500">ولي أمر: {v.studentName}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">تم الدخول</span>
                                        <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{new Date(v.arrivedAt!).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'})}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* --- OVERLAYS (Keeping Scanner Mounted) --- */}

        {/* LOG OVERLAY */}
        {showLog && (
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><List size={20} className="text-blue-600"/> سجل الزوار التفصيلي</h2>
                        <button onClick={() => setShowLog(false)} className="bg-white p-2 rounded-full text-slate-400 hover:text-red-500 shadow-sm border border-slate-100 transition-colors"><X size={20}/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            <table className="w-full text-right">
                                <thead className="bg-slate-50 text-slate-500 font-bold text-sm">
                                    <tr>
                                        <th className="p-4">الزائر</th>
                                        <th className="p-4">الطالب</th>
                                        <th className="p-4">الموعد المحدد</th>
                                        <th className="p-4">وقت الدخول الفعلي</th>
                                        <th className="p-4">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {todaysVisits.map(v => (
                                        <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 font-bold text-slate-800">{v.parentName}</td>
                                            <td className="p-4 text-slate-600">{v.studentName}</td>
                                            <td className="p-4 font-mono text-slate-500">{v.slot?.startTime}</td>
                                            <td className="p-4 font-mono text-emerald-600 font-bold">{v.arrivedAt ? new Date(v.arrivedAt).toLocaleTimeString('ar-SA') : '-'}</td>
                                            <td className="p-4">
                                                {v.status === 'completed' ? (
                                                    <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">تم الدخول</span>
                                                ) : (
                                                    <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold">لم يصل</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
                        <button onClick={handlePrintReport} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-900 shadow-lg"><Printer size={18}/> طباعة التقرير</button>
                    </div>
                </div>
            </div>
        )}

        {/* ANALYTICS OVERLAY */}
        {showAnalytics && (
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden relative">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><BrainCircuit size={20} className="text-purple-600"/> المحلل الأمني الذكي</h2>
                        <button onClick={() => setShowAnalytics(false)} className="bg-white p-2 rounded-full text-slate-400 hover:text-red-500 shadow-sm border border-slate-100 transition-colors"><X size={20}/></button>
                    </div>
                    
                    <div className="p-8">
                        {!aiReport ? (
                            <div className="text-center py-10">
                                <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                                    <Sparkles size={40} className="text-purple-600"/>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 mb-2">جاهز للتحليل</h3>
                                <p className="text-slate-500 mb-8 max-w-sm mx-auto">سيقوم النظام بتحليل بيانات الزوار وتوقيتات الدخول لتقديم توصيات أمنية.</p>
                                <button onClick={handleGenerateAnalysis} disabled={isAnalyzing} className="bg-purple-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-purple-700 transition-all flex items-center gap-2 mx-auto">
                                    {isAnalyzing ? <Loader2 className="animate-spin" /> : <Sparkles size={20}/>}
                                    {isAnalyzing ? 'جاري التحليل...' : 'بدء التحليل الآن'}
                                </button>
                            </div>
                        ) : (
                            <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100 shadow-inner relative">
                                <h3 className="text-lg font-bold text-purple-900 mb-4 flex items-center gap-2"><FileText size={18}/> تقرير الذكاء الاصطناعي</h3>
                                <div className="prose prose-sm text-slate-700 leading-relaxed whitespace-pre-line font-medium max-h-[400px] overflow-y-auto custom-scrollbar">
                                    {aiReport}
                                </div>
                                <button onClick={() => setAiReport(null)} className="absolute top-4 left-4 text-purple-400 hover:text-purple-700"><RefreshCw size={16}/></button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

    </div>
    </>
  );
};

export default GateScanner;
