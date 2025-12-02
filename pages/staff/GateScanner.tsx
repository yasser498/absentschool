
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  QrCode, CheckCircle, AlertCircle, Loader2, User, Clock, RefreshCw, XCircle, 
  Printer, List, ShieldCheck, FileText, LayoutGrid, Sparkles, BrainCircuit, 
  Calendar, ArrowRight, Bell, LogOut, Home, X, Camera, History, LogOut as ExitIcon, 
  Grid, UserCheck, Search, Filter, ScanLine 
} from 'lucide-react';
import { 
  checkInVisitor, getDailyAppointments, generateSmartContent, getExitPermissions, 
  completeExitPermission, getExitPermissionById 
} from '../../services/storage';
import { Appointment, ExitPermission } from '../../types';

// Declare global Html5Qrcode
declare var Html5Qrcode: any;

const GateScanner: React.FC = () => {
  // --- View State ---
  const [activeTab, setActiveTab] = useState<'scanner' | 'students' | 'visitors'>('scanner');
  const [showSmartReport, setShowSmartReport] = useState(false);
  const [printMode, setPrintMode] = useState<'none' | 'exits' | 'visitors'>('none');
  
  // --- Data State ---
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [todaysVisits, setTodaysVisits] = useState<Appointment[]>([]);
  const [todaysExits, setTodaysExits] = useState<ExitPermission[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // --- Scanner State ---
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scannedAppointment, setScannedAppointment] = useState<Appointment | null>(null);
  const [scannedExit, setScannedExit] = useState<ExitPermission | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccessType, setScanSuccessType] = useState<'checkin' | 'exit' | null>(null);
  const [isAlreadyProcessed, setIsAlreadyProcessed] = useState(false);

  // --- AI State ---
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- Filter State ---
  const [searchTerm, setSearchTerm] = useState('');

  const scannerRef = useRef<any>(null);
  const isScannerRunning = useRef<boolean>(false);
  const isProcessingScan = useRef<boolean>(false);
  const scannerLock = useRef<boolean>(false); // Mutex to prevent race conditions

  // Constants
  const REPORT_LOGO = "https://www.raed.net/img?id=1475049";
  const SCHOOL_NAME = localStorage.getItem('school_name') || "متوسطة عماد الدين زنكي";

  // --- Statistics ---
  const stats = useMemo(() => {
      const exitsTotal = todaysExits.length;
      const exitsPending = todaysExits.filter(e => e.status === 'pending_pickup').length;
      const exitsCompleted = todaysExits.filter(e => e.status === 'completed').length;
      
      const visitsTotal = todaysVisits.length;
      const visitsPending = todaysVisits.filter(v => v.status !== 'completed' && v.status !== 'cancelled').length;
      const visitsCompleted = todaysVisits.filter(v => v.status === 'completed').length;
      
      return { exitsTotal, exitsPending, exitsCompleted, visitsTotal, visitsPending, visitsCompleted };
  }, [todaysExits, todaysVisits]);

  // --- Fetch Data ---
  const fetchDailyData = async () => {
      setLoadingData(true);
      try {
          const [visits, exits] = await Promise.all([
              getDailyAppointments(reportDate),
              getExitPermissions(reportDate)
          ]);
          setTodaysVisits(visits);
          setTodaysExits(exits);
      } catch (e) {
          console.error("Failed to fetch gate data", e);
      } finally {
          setLoadingData(false);
      }
  };

  useEffect(() => {
    fetchDailyData();
    const interval = setInterval(fetchDailyData, 30000);
    return () => clearInterval(interval);
  }, [reportDate]);

  // --- Scanner Logic ---
  const stopScanner = async () => {
      if (scannerLock.current) return; // Wait if busy
      scannerLock.current = true;

      try {
          if (scannerRef.current) {
              if (isScannerRunning.current) {
                  try {
                      await scannerRef.current.stop();
                  } catch (e) {
                      // Ignore "not running" errors
                      console.debug("Stop ignored:", e);
                  }
              }
              try {
                  await scannerRef.current.clear();
              } catch (e) {
                  console.debug("Clear ignored:", e);
              }
          }
      } catch (err) {
          console.error("Failed to stop scanner completely", err);
      } finally {
          isScannerRunning.current = false;
          scannerRef.current = null;
          scannerLock.current = false;
      }
  };

  const startScanner = async () => {
      if (activeTab !== 'scanner') return;
      if (scannerLock.current) return;
      if (isScannerRunning.current) return;

      scannerLock.current = true;
      setScanError(null);

      try {
          // Cleanup old instance if needed
          if (scannerRef.current) {
              try { await scannerRef.current.stop(); } catch(e){}
              try { await scannerRef.current.clear(); } catch(e){}
              scannerRef.current = null;
          }

          // Delay for DOM
          await new Promise(r => setTimeout(r, 100));
          if (!document.getElementById('reader')) {
              scannerLock.current = false;
              return;
          }

          const html5QrCode = new Html5Qrcode("reader");
          scannerRef.current = html5QrCode;

          const config = {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0
          };

          await html5QrCode.start(
              { facingMode: "environment" },
              config,
              (decodedText: string) => {
                  if (!isProcessingScan.current) {
                      handleScan(decodedText);
                  }
              },
              (errorMessage: string) => { /* ignore frame errors */ }
          );
          
          isScannerRunning.current = true;

      } catch (err: any) {
          console.error("Camera error:", err);
          let msg = "تعذر تشغيل الكاميرا.";
          const errStr = err?.toString() || '';
          
          if (
              err?.name === "NotAllowedError" || 
              err?.name === "PermissionDeniedError" || 
              errStr.includes("Permission denied")
          ) {
                msg = "تم رفض إذن الكاميرا. يرجى الضغط على أيقونة القفل 🔒 في شريط العنوان والسماح بالوصول للكاميرا.";
          } else if (err?.name === "NotFoundError" || errStr.includes("NotFoundError")) {
                msg = "لم يتم العثور على كاميرا في الجهاز.";
          } else if (err?.name === "NotReadableError" || errStr.includes("NotReadableError")) {
                msg = "الكاميرا قيد الاستخدام بواسطة تطبيق آخر.";
          } else if (errStr.includes("Is already running")) {
                // Ignore if it claims running, just mark flag true
                isScannerRunning.current = true;
                msg = ""; // clear error
          }
          
          if (msg) setScanError(msg);
          if (msg) isScannerRunning.current = false;
      } finally {
          scannerLock.current = false;
      }
  };

  // Manage Scanner Lifecycle
  useEffect(() => {
    let ignore = false;

    const init = async () => {
        if (activeTab === 'scanner') {
            // Give time for unmount/remount in React Strict Mode
            await new Promise(r => setTimeout(r, 200));
            if (!ignore) {
                await startScanner();
            }
        } else {
            await stopScanner();
        }
    };

    init();

    return () => {
        ignore = true;
        stopScanner();
    };
  }, [activeTab]);

  const handleScan = async (decodedText: string) => {
      isProcessingScan.current = true;
      setScanLoading(true);
      setScanResult(decodedText);
      setScanError(null);
      setScannedAppointment(null);
      setScannedExit(null);
      setScanSuccessType(null);
      setIsAlreadyProcessed(false);

      try {
          // 1. Exit Permission Check
          let exitId = decodedText;
          if (decodedText.startsWith('EXIT:')) {
              exitId = decodedText.split(':')[1];
          }

          let foundExit = todaysExits.find(e => e.id === exitId);
          if (!foundExit) {
              // Try fetching from DB if not in daily list (maybe old)
              const freshExit = await getExitPermissionById(exitId);
              if (freshExit) {
                  // Only consider it valid if it was created today OR is still pending
                  const isToday = freshExit.createdAt.startsWith(new Date().toISOString().split('T')[0]);
                  if (isToday || freshExit.status === 'pending_pickup') {
                      foundExit = freshExit;
                  }
              }
          }

          if (foundExit) {
              setScannedExit(foundExit);
              if (foundExit.status === 'completed') {
                  setIsAlreadyProcessed(true);
              }
              setScanLoading(false);
              return; // Stop here if exit found
          }

          // 2. Visitor Appointment Check
          let visitId = decodedText;
          let foundVisit = todaysVisits.find(v => v.id === visitId);
          
          if (!foundVisit) {
             // Try refreshing data
             const visits = await getDailyAppointments(reportDate);
             setTodaysVisits(visits);
             foundVisit = visits.find(v => v.id === visitId);
          }
          
          if (foundVisit) {
              setScannedAppointment(foundVisit);
              if (foundVisit.status === 'completed') {
                  setIsAlreadyProcessed(true);
              }
              setScanLoading(false);
              return;
          }

          // 3. Not Found
          setScanError("الرمز غير موجود في سجل هذا اليوم.");

      } catch (e) {
          setScanError("حدث خطأ أثناء معالجة الرمز.");
      } finally {
          setScanLoading(false);
      }
  };

  const confirmAction = async () => {
      setScanLoading(true);
      try {
          if (scannedExit) {
              await completeExitPermission(scannedExit.id);
              setScanSuccessType('exit');
              setTodaysExits(prev => prev.map(e => e.id === scannedExit.id ? { ...e, status: 'completed', completedAt: new Date().toISOString() } : e));
          } else if (scannedAppointment) {
              await checkInVisitor(scannedAppointment.id);
              setScanSuccessType('checkin');
              setTodaysVisits(prev => prev.map(v => v.id === scannedAppointment.id ? { ...v, status: 'completed', arrivedAt: new Date().toISOString() } : v));
          }
      } catch (e) {
          setScanError("فشل تنفيذ العملية. حاول مرة أخرى.");
      } finally {
          setScanLoading(false);
      }
  };

  const resetScanner = async () => {
      setScanResult(null);
      setScannedExit(null);
      setScannedAppointment(null);
      setScanError(null);
      setScanSuccessType(null);
      setIsAlreadyProcessed(false);
      isProcessingScan.current = false;
      
      // Ensure scanner is running if it stopped
      if (!isScannerRunning.current) {
          await startScanner();
      }
  };

  const handleManualExit = async (id: string) => {
      if (!window.confirm("تأكيد خروج الطالب؟")) return;
      await completeExitPermission(id);
      fetchDailyData();
  };

  const handleManualCheckIn = async (id: string) => {
      if (!window.confirm("تأكيد دخول الزائر؟")) return;
      await checkInVisitor(id);
      fetchDailyData();
  };

  // --- Reports & Utils ---
  const generateReport = async () => {
      setIsAnalyzing(true);
      setShowSmartReport(true);
      try {
          const prompt = `حلل حركة البوابة اليوم ${reportDate}. خروج: ${stats.exitsCompleted}/${stats.exitsTotal}. زوار: ${stats.visitsCompleted}/${stats.visitsTotal}. اكتب ملخصاً.`;
          const res = await generateSmartContent(prompt);
          setAiReport(res);
      } catch (e) { setAiReport("تعذر التوليد."); } finally { setIsAnalyzing(false); }
  };

  const handlePrint = (mode: 'exits' | 'visitors') => {
      setPrintMode(mode);
      setTimeout(() => { window.print(); setTimeout(() => setPrintMode('none'), 1000); }, 300);
  };

  const getVisitorReportStatus = (v: Appointment) => {
      if (v.status === 'completed') return 'حضر';
      const isPast = new Date(reportDate) < new Date(new Date().setHours(0,0,0,0));
      return isPast || new Date().getHours() >= 13 ? 'لم يحضر' : 'انتظار';
  };

  const filteredExits = todaysExits.filter(e => e.studentName.includes(searchTerm) || e.grade.includes(searchTerm));
  const filteredVisits = todaysVisits.filter(v => v.parentName.includes(searchTerm) || v.studentName.includes(searchTerm));

  return (
    <>
    <style>{`
        @media print {
            body * { visibility: hidden; }
            #gate-report, #gate-report * { visibility: visible; }
            #gate-report { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; background: white; z-index: 9999; }
            .no-print { display: none !important; }
        }
        @keyframes scan-move {
            0% { top: 0; opacity: 0; }
            20% { opacity: 1; }
            80% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
        }
        .animate-scan { animation: scan-move 2s linear infinite; }
    `}</style>

    {/* --- OFFICIAL PRINT TEMPLATES --- */}
    <div id="gate-report" className="hidden" dir="rtl">
        {/* Same Print Header as before */}
        <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
            <div className="text-right font-bold text-sm space-y-1"><p>المملكة العربية السعودية</p><p>وزارة التعليم</p><p>{SCHOOL_NAME}</p></div>
            <div className="text-center"><img src={REPORT_LOGO} alt="Logo" className="h-24 w-auto object-contain mx-auto"/></div>
            <div className="text-left font-bold text-sm space-y-1"><p>Security Report</p><p>Date: {reportDate}</p></div>
        </div>
        {/* Exits Table */}
        {printMode === 'exits' && (
            <table className="w-full text-right border-collapse border border-black text-sm">
                <thead><tr className="bg-gray-100"><th className="border border-black p-2">الطالب</th><th className="border border-black p-2">المستلم</th><th className="border border-black p-2">السبب</th><th className="border border-black p-2">المصرح</th><th className="border border-black p-2">الوقت</th></tr></thead>
                <tbody>{todaysExits.length > 0 ? todaysExits.map((e, i) => (<tr key={i}><td className="border border-black p-2">{e.studentName}</td><td className="border border-black p-2">{e.parentName}</td><td className="border border-black p-2">{e.reason}</td><td className="border border-black p-2">{e.createdByName}</td><td className="border border-black p-2">{e.completedAt ? new Date(e.completedAt).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'}) : '-'}</td></tr>)) : <tr><td colSpan={5} className="p-4 text-center">لا يوجد</td></tr>}</tbody>
            </table>
        )}
        {/* Visitors Table */}
        {printMode === 'visitors' && (
            <table className="w-full text-right border-collapse border border-black text-sm">
                <thead><tr className="bg-gray-100"><th className="border border-black p-2">الزائر</th><th className="border border-black p-2">الطالب</th><th className="border border-black p-2">الموعد</th><th className="border border-black p-2">الحضور</th><th className="border border-black p-2">الحالة</th></tr></thead>
                <tbody>{todaysVisits.length > 0 ? todaysVisits.map((v, i) => (<tr key={i}><td className="border border-black p-2">{v.parentName}</td><td className="border border-black p-2">{v.studentName}</td><td className="border border-black p-2">{v.slot?.startTime}</td><td className="border border-black p-2">{v.arrivedAt ? new Date(v.arrivedAt).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'}) : '-'}</td><td className="border border-black p-2">{getVisitorReportStatus(v)}</td></tr>)) : <tr><td colSpan={5} className="p-4 text-center">لا يوجد</td></tr>}</tbody>
            </table>
        )}
    </div>

    <div className="max-w-7xl mx-auto space-y-6 pb-24 no-print animate-fade-in">
        
        {/* DASHBOARD STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 aspect-square">
                <div className="bg-orange-50 p-3 rounded-full text-orange-600"><Clock size={24}/></div>
                <h3 className="text-2xl font-extrabold">{stats.exitsPending}</h3><p className="text-xs text-slate-400 font-bold uppercase">انتظار</p>
            </div>
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 aspect-square">
                <div className="bg-emerald-50 p-3 rounded-full text-emerald-600"><LogOut size={24}/></div>
                <h3 className="text-2xl font-extrabold">{stats.exitsCompleted}</h3><p className="text-xs text-slate-400 font-bold uppercase">مغادر</p>
            </div>
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 aspect-square">
                <div className="bg-blue-50 p-3 rounded-full text-blue-600"><UserCheck size={24}/></div>
                <h3 className="text-2xl font-extrabold">{stats.visitsCompleted}</h3><p className="text-xs text-slate-400 font-bold uppercase">زوار</p>
            </div>
            <div onClick={generateReport} className="bg-purple-50 p-4 rounded-3xl shadow-sm border border-purple-100 flex flex-col items-center justify-center gap-2 aspect-square cursor-pointer hover:bg-purple-100 transition-colors">
                <div className="bg-white p-3 rounded-full text-purple-600"><Sparkles size={24}/></div>
                <h3 className="text-lg font-bold text-purple-900">تقرير</h3><p className="text-[10px] text-purple-400 font-bold">ذكاء اصطناعي</p>
            </div>
        </div>

        {showSmartReport && (
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6 relative animate-fade-in">
                <button onClick={() => setShowSmartReport(false)} className="absolute top-4 left-4 text-purple-400"><X size={20}/></button>
                <h3 className="font-bold text-purple-900 mb-2 flex items-center gap-2"><BrainCircuit size={18}/> تحليل الأمن</h3>
                {isAnalyzing ? <Loader2 className="animate-spin text-purple-600"/> : <p className="text-sm text-purple-800 leading-relaxed whitespace-pre-line">{aiReport}</p>}
            </div>
        )}

        {/* TABS */}
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex overflow-x-auto">
            <button onClick={() => setActiveTab('scanner')} className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeTab === 'scanner' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Camera size={18} /> الماسح</button>
            <button onClick={() => setActiveTab('students')} className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeTab === 'students' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Grid size={18} /> خروج ({stats.exitsPending})</button>
            <button onClick={() => setActiveTab('visitors')} className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeTab === 'visitors' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><List size={18} /> زوار</button>
        </div>

        {/* SCANNER VIEW */}
        {activeTab === 'scanner' && (
            <div className="flex flex-col items-center">
                {/* CAMERA CONTAINER */}
                <div className="w-full max-w-md aspect-square bg-black rounded-3xl overflow-hidden relative shadow-2xl border-4 border-slate-900 group">
                    <div id="reader" className="w-full h-full object-cover"></div>
                    
                    {/* Visual Overlay (The Square) */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <div className="w-64 h-64 border-2 border-white/30 rounded-3xl relative">
                            {/* Corners */}
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl"></div>
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl"></div>
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl"></div>
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl"></div>
                            
                            {/* Scanning Animation */}
                            {!scanResult && <div className="absolute left-0 right-0 h-1 bg-emerald-400/80 shadow-[0_0_20px_rgba(52,211,153,0.8)] animate-scan"></div>}
                        </div>
                    </div>

                    {/* Status Badge */}
                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 z-20">
                        <div className={`w-2 h-2 rounded-full ${scanError ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`}></div>
                        {scanError ? 'خطأ' : 'جاري المسح'}
                    </div>

                    {/* Camera Error Message */}
                    {scanError && (
                        <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-white z-30 p-6 text-center">
                            <AlertCircle size={48} className="text-red-500 mb-4"/>
                            <p className="font-bold mb-4">{scanError}</p>
                            <button onClick={() => { setScanError(null); startScanner(); }} className="bg-white text-black px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-200"><RefreshCw size={16}/> إعادة</button>
                        </div>
                    )}
                </div>

                {/* RESULT MODAL (FULL SCREEN OVERLAY) */}
                {(scanResult || isAlreadyProcessed || scanSuccessType) && (
                    <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative">
                            {/* Close Button */}
                            {!scanLoading && (
                                <button onClick={resetScanner} className="absolute top-4 left-4 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors z-10">
                                    <X size={24} className="text-slate-600"/>
                                </button>
                            )}

                            <div className="p-8 text-center">
                                {/* Success State */}
                                {scanSuccessType ? (
                                    <div className="animate-fade-in-up">
                                        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <CheckCircle size={48} />
                                        </div>
                                        <h2 className="text-3xl font-extrabold text-slate-900 mb-2">
                                            {scanSuccessType === 'exit' ? 'تم الخروج بنجاح' : 'تم الدخول بنجاح'}
                                        </h2>
                                        <p className="text-slate-500 font-bold">العملية مسجلة في النظام</p>
                                        <button onClick={resetScanner} className="mt-8 w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all">
                                            مسح التالي
                                        </button>
                                    </div>
                                ) : isAlreadyProcessed ? (
                                    /* Already Processed State */
                                    <div className="animate-fade-in-up">
                                        <div className="w-24 h-24 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <History size={48} />
                                        </div>
                                        <h2 className="text-3xl font-extrabold text-slate-900 mb-2">تمت العملية مسبقاً</h2>
                                        <p className="text-slate-500 font-bold mb-6">
                                            {scannedExit ? `الطالب: ${scannedExit.studentName}` : `الزائر: ${scannedAppointment?.parentName}`}
                                        </p>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 inline-block w-full">
                                            <p className="text-xs text-slate-400 font-bold uppercase mb-1">وقت التنفيذ</p>
                                            <p className="font-mono text-xl font-bold text-slate-800">
                                                {scannedExit?.completedAt ? new Date(scannedExit.completedAt).toLocaleTimeString('ar-SA') : scannedAppointment?.arrivedAt ? new Date(scannedAppointment.arrivedAt).toLocaleTimeString('ar-SA') : '-'}
                                            </p>
                                        </div>
                                        <button onClick={resetScanner} className="mt-8 w-full py-4 bg-slate-200 text-slate-700 rounded-2xl font-bold text-lg hover:bg-slate-300 transition-all">
                                            عودة
                                        </button>
                                    </div>
                                ) : scannedExit ? (
                                    /* Exit Confirmation */
                                    <div className="animate-fade-in-up">
                                        <div className="bg-orange-50 border-2 border-orange-100 rounded-2xl p-6 mb-6">
                                            <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 inline-block">إذن خروج طالب</span>
                                            <h2 className="text-3xl font-extrabold text-slate-900 mb-1">{scannedExit.studentName}</h2>
                                            <p className="text-lg text-slate-500">{scannedExit.grade} - {scannedExit.className}</p>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4 text-right mb-8">
                                            <div className="bg-slate-50 p-4 rounded-2xl">
                                                <p className="text-xs text-slate-400 font-bold uppercase mb-1">المستلم (ولي الأمر)</p>
                                                <p className="font-bold text-slate-800">{scannedExit.parentName}</p>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded-2xl">
                                                <p className="text-xs text-slate-400 font-bold uppercase mb-1">المصرح (الموظف)</p>
                                                <p className="font-bold text-slate-800">{scannedExit.createdByName}</p>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={confirmAction}
                                            disabled={scanLoading}
                                            className="w-full py-5 bg-orange-600 text-white rounded-2xl font-bold text-xl hover:bg-orange-700 shadow-xl shadow-orange-200 transition-all flex items-center justify-center gap-3"
                                        >
                                            {scanLoading ? <Loader2 className="animate-spin"/> : <LogOut size={24}/>}
                                            تأكيد المغادرة
                                        </button>
                                    </div>
                                ) : scannedAppointment ? (
                                    /* Visitor Confirmation */
                                    <div className="animate-fade-in-up">
                                        <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl p-6 mb-6">
                                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 inline-block">موعد زيارة</span>
                                            <h2 className="text-3xl font-extrabold text-slate-900 mb-1">{scannedAppointment.parentName}</h2>
                                            <p className="text-lg text-slate-500">ولي أمر: {scannedAppointment.studentName}</p>
                                        </div>
                                        
                                        <div className="bg-slate-50 p-4 rounded-2xl mb-8 text-right">
                                            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-3">
                                                <span className="text-slate-400 text-sm font-bold">وقت الموعد</span>
                                                <span className="font-mono text-xl font-bold text-slate-800">{scannedAppointment.slot?.startTime}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 text-sm font-bold block mb-1">سبب الزيارة</span>
                                                <span className="font-bold text-slate-800">{scannedAppointment.visitReason}</span>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={confirmAction}
                                            disabled={scanLoading}
                                            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold text-xl hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-3"
                                        >
                                            {scanLoading ? <Loader2 className="animate-spin"/> : <CheckCircle size={24}/>}
                                            تسجيل الدخول
                                        </button>
                                    </div>
                                ) : (
                                    /* Not Found / Error inside modal */
                                    <div className="py-10">
                                        <XCircle size={64} className="text-red-500 mx-auto mb-4"/>
                                        <h3 className="text-xl font-bold text-slate-800 mb-2">الرمز غير صالح</h3>
                                        <p className="text-slate-500">{scanError || "لم يتم العثور على بيانات لهذا الرمز اليوم."}</p>
                                        <button onClick={resetScanner} className="mt-8 px-8 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200">مسح مرة أخرى</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* ================= CONTENT: STUDENTS QUEUE ================= */}
        {activeTab === 'students' && (
            <div className="space-y-6">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1"><Search className="absolute right-3 top-2.5 text-slate-400" size={20}/><input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="بحث..." className="w-full pr-10 pl-4 py-2 bg-slate-50 border-none rounded-xl outline-none"/></div>
                    <div className="flex gap-2">
                        <input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)} className="bg-slate-50 border-none rounded-xl px-4 py-2 font-bold text-slate-600 outline-none"/>
                        <button onClick={()=>handlePrint('exits')} className="bg-slate-800 text-white px-4 rounded-xl flex items-center gap-2"><Printer size={18}/> طباعة</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredExits.filter(e => e.status === 'pending_pickup').map(e => (
                        <div key={e.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                            <div className="flex justify-between items-start mb-3">
                                <div><h4 className="font-bold text-lg text-slate-900">{e.studentName}</h4><p className="text-xs text-slate-500">{e.grade} - {e.className}</p></div>
                                <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded">انتظار</span>
                            </div>
                            <div className="space-y-2 text-sm text-slate-600 mb-4">
                                <p><span className="text-slate-400">المستلم:</span> <strong>{e.parentName}</strong></p>
                                <p><span className="text-slate-400">المصرح:</span> {e.createdByName}</p>
                            </div>
                            <button onClick={()=>handleManualExit(e.id)} className="w-full bg-orange-600 text-white py-2 rounded-xl font-bold text-sm hover:bg-orange-700 flex items-center justify-center gap-2"><LogOut size={16}/> تأكيد المغادرة</button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* ================= CONTENT: VISITORS ================= */}
        {activeTab === 'visitors' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold">سجل الزوار</h3>
                    <div className="flex gap-2"><input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)} className="border p-1 rounded"/><button onClick={()=>handlePrint('visitors')}><Printer/></button></div>
                </div>
                {filteredVisits.length === 0 ? <p className="p-8 text-center text-slate-400">لا يوجد زوار</p> : (
                    <div className="divide-y">
                        {filteredVisits.map(v => (
                            <div key={v.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                                <div><h4 className="font-bold">{v.parentName}</h4><p className="text-xs text-slate-500">ولي أمر: {v.studentName}</p></div>
                                <div className="text-left">
                                    <p className="font-mono font-bold text-slate-700">{v.slot?.startTime}</p>
                                    {v.status === 'completed' ? <span className="text-emerald-600 text-xs font-bold">تم الدخول</span> : <button onClick={()=>handleManualCheckIn(v.id)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded font-bold">دخول يدوي</button>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
    </div>
    </>
  );
};

export default GateScanner;
