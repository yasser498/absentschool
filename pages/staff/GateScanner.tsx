
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  QrCode, CheckCircle, AlertCircle, Loader2, User, Clock, RefreshCw, XCircle, 
  Printer, List, ShieldCheck, FileText, LayoutGrid, Sparkles, BrainCircuit, 
  Calendar, ArrowRight, Bell, LogOut, Home, X, Camera, History, LogOut as ExitIcon, 
  Grid, UserCheck, Search, Filter 
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
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

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
          setLastRefreshed(new Date());
      } catch (e) {
          console.error("Failed to fetch gate data", e);
      } finally {
          setLoadingData(false);
      }
  };

  useEffect(() => {
    fetchDailyData();
    // Poll every 30 seconds
    const interval = setInterval(fetchDailyData, 30000);
    return () => clearInterval(interval);
  }, [reportDate]);

  // --- Scanner Logic ---
  const startScanner = async () => {
      if (activeTab !== 'scanner') return;
      if (isScannerRunning.current) return;

      // Reset error
      setScanError(null);

      // Small delay to ensure DOM is ready
      await new Promise(r => setTimeout(r, 100));
      
      if (!document.getElementById('reader')) return;

      try {
          const html5QrCode = new Html5Qrcode("reader");
          scannerRef.current = html5QrCode;

          await html5QrCode.start(
              { facingMode: "environment" },
              {
                  fps: 10,
                  qrbox: { width: 250, height: 250 },
                  aspectRatio: 1.0
              },
              (decodedText: string) => {
                  if (!isProcessingScan.current) {
                      handleScan(decodedText);
                  }
              },
              (errorMessage: string) => { /* ignore errors */ }
          );
          isScannerRunning.current = true;
      } catch (err: any) {
          console.error("Camera error:", err);
          let msg = "تعذر تشغيل الكاميرا.";
          if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
                msg = "تم رفض إذن الكاميرا. يرجى السماح بالوصول من إعدادات المتصفح (أعلى الصفحة) ثم إعادة المحاولة.";
          } else if (err?.name === "NotFoundError") {
                msg = "لم يتم العثور على كاميرا في الجهاز.";
          } else if (err?.name === "NotReadableError") {
                msg = "الكاميرا قيد الاستخدام من قبل تطبيق آخر.";
          }
          setScanError(msg);
          isScannerRunning.current = false;
      }
  };

  const stopScanner = async () => {
      if (scannerRef.current && isScannerRunning.current) {
          try {
              await scannerRef.current.stop();
              scannerRef.current.clear();
              isScannerRunning.current = false;
          } catch (err) {
              console.error("Failed to stop scanner", err);
          }
      }
  };

  useEffect(() => {
    if (activeTab === 'scanner') {
        startScanner();
    } else {
        stopScanner();
    }

    return () => {
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
          // 1. Is it an Exit Permission? (Format: EXIT:uuid or just uuid if legacy, but let's assume EXIT: prefix for strictness or just lookup ID)
          let exitId = decodedText;
          if (decodedText.startsWith('EXIT:')) {
              exitId = decodedText.split(':')[1];
          }

          // Try to find in local Exits first
          let foundExit = todaysExits.find(e => e.id === exitId);
          
          // If not found locally, try DB (maybe it's fresh)
          if (!foundExit) {
              const freshExit = await getExitPermissionById(exitId);
              if (freshExit) {
                  foundExit = freshExit;
                  // Update local state gently
                  setTodaysExits(prev => [...prev, freshExit]); 
              }
          }

          if (foundExit) {
              setScannedExit(foundExit);
              if (foundExit.status === 'completed') {
                  setIsAlreadyProcessed(true);
              }
              setScanLoading(false);
              return;
          }

          // 2. Is it a Visitor Appointment?
          let visitId = decodedText; // Appointment IDs are UUIDs
          const foundVisit = todaysVisits.find(v => v.id === visitId);
          
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
              // Update local state immediately
              setTodaysExits(prev => prev.map(e => e.id === scannedExit.id ? { ...e, status: 'completed', completedAt: new Date().toISOString() } : e));
          } else if (scannedAppointment) {
              await checkInVisitor(scannedAppointment.id);
              setScanSuccessType('checkin');
              // Update local state immediately
              setTodaysVisits(prev => prev.map(v => v.id === scannedAppointment.id ? { ...v, status: 'completed', arrivedAt: new Date().toISOString() } : v));
          }
      } catch (e) {
          setScanError("فشل تنفيذ العملية. حاول مرة أخرى.");
      } finally {
          setScanLoading(false);
      }
  };

  const resetScanner = () => {
      setScanResult(null);
      setScannedExit(null);
      setScannedAppointment(null);
      setScanError(null);
      setScanSuccessType(null);
      setIsAlreadyProcessed(false);
      isProcessingScan.current = false;
      
      // If camera stopped due to error, try restart
      if (!isScannerRunning.current) {
          startScanner();
      }
  };

  // --- Manual Actions (Tabs) ---
  const handleManualExit = async (id: string) => {
      if (!window.confirm("هل أنت متأكد من تسجيل خروج الطالب؟")) return;
      try {
          await completeExitPermission(id);
          fetchDailyData();
      } catch (e) { alert("حدث خطأ"); }
  };

  const handleManualCheckIn = async (id: string) => {
      if (!window.confirm("هل أنت متأكد من تسجيل دخول الزائر؟")) return;
      try {
          await checkInVisitor(id);
          fetchDailyData();
      } catch (e) { alert("حدث خطأ"); }
  };

  // --- Smart Report ---
  const generateReport = async () => {
      setIsAnalyzing(true);
      setShowSmartReport(true);
      try {
          const exitSummary = todaysExits.map(e => `${e.studentName} (${e.status})`).join(', ');
          const visitSummary = todaysVisits.map(v => `${v.parentName} (${v.status})`).join(', ');
          
          const prompt = `
            حلل حركة البوابة اليومية للمدرسة (تاريخ ${reportDate}):
            - خروج الطلاب: ${stats.exitsCompleted} من أصل ${stats.exitsTotal}.
            - دخول الزوار: ${stats.visitsCompleted} من أصل ${stats.visitsTotal}.
            
            تفاصيل الطلاب: ${exitSummary}
            تفاصيل الزوار: ${visitSummary}
            
            اكتب تقريراً أمنياً مختصراً لإدارة المدرسة يلخص الحركة ويسلط الضوء على أي ازدحام أو ملاحظات.
          `;
          const res = await generateSmartContent(prompt);
          setAiReport(res);
      } catch (e) {
          setAiReport("تعذر توليد التقرير.");
      } finally {
          setIsAnalyzing(false);
      }
  };

  // --- Print Handler ---
  const handlePrint = (mode: 'exits' | 'visitors') => {
      setPrintMode(mode);
      setTimeout(() => {
          window.print();
          // Reset after print dialog closes (approximate)
          setTimeout(() => setPrintMode('none'), 1000);
      }, 300);
  };

  // --- Helper to determine visitor status text for report ---
  const getVisitorReportStatus = (v: Appointment) => {
      if (v.status === 'completed') return 'حضر';
      
      const now = new Date();
      // If looking at a past date, and not completed, they missed it
      const reportDateObj = new Date(reportDate);
      const today = new Date();
      today.setHours(0,0,0,0);
      reportDateObj.setHours(0,0,0,0);

      const isPastDate = reportDateObj < today;
      const isPast1PM = now.getHours() >= 13; // 1:00 PM
      
      if (isPastDate || isPast1PM) return 'لم يحضر';
      return 'انتظار';
  };

  // --- Filtered Lists ---
  const filteredExits = todaysExits.filter(e => 
      e.studentName.includes(searchTerm) || e.grade.includes(searchTerm)
  );
  
  const filteredVisits = todaysVisits.filter(v => 
      v.parentName.includes(searchTerm) || v.studentName.includes(searchTerm)
  );

  return (
    <>
    <style>{`
        @media print {
            body * { visibility: hidden; }
            #gate-report, #gate-report * { visibility: visible; }
            #gate-report { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; background: white; z-index: 9999; }
            .no-print { display: none !important; }
        }
    `}</style>

    {/* --- OFFICIAL PRINT TEMPLATES --- */}
    <div id="gate-report" className="hidden" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
            <div className="text-right font-bold text-sm space-y-1">
                <p>المملكة العربية السعودية</p>
                <p>وزارة التعليم</p>
                <p>{SCHOOL_NAME}</p>
                <p>إدارة الأمن والسلامة</p>
            </div>
            <div className="text-center">
                <img src={REPORT_LOGO} alt="Logo" className="h-24 w-auto object-contain mx-auto"/>
            </div>
            <div className="text-left font-bold text-sm space-y-1">
                <p>Ministry of Education</p>
                <p>Security Gate Report</p>
                <p>Date: {reportDate}</p>
            </div>
        </div>

        {/* Exits Report Content */}
        {printMode === 'exits' && (
            <>
                <h1 className="text-2xl font-extrabold text-center mb-6 underline underline-offset-8">بيان خروج الطلاب اليومي (استئذان)</h1>
                <table className="w-full text-right border-collapse border border-black text-sm">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-black p-2 w-10 text-center">م</th>
                            <th className="border border-black p-2">اسم الطالب</th>
                            <th className="border border-black p-2">الصف / الفصل</th>
                            <th className="border border-black p-2">المستلم (ولي الأمر)</th>
                            <th className="border border-black p-2">السبب</th>
                            <th className="border border-black p-2 bg-gray-200">المصرح (المصدر)</th>
                            <th className="border border-black p-2 text-center">وقت الخروج</th>
                        </tr>
                    </thead>
                    <tbody>
                        {todaysExits.length > 0 ? (
                            todaysExits.map((e, idx) => (
                                <tr key={idx}>
                                    <td className="border border-black p-2 text-center">{idx + 1}</td>
                                    <td className="border border-black p-2 font-bold">{e.studentName}</td>
                                    <td className="border border-black p-2">{e.grade} - {e.className}</td>
                                    <td className="border border-black p-2">{e.parentName}</td>
                                    <td className="border border-black p-2">{e.reason}</td>
                                    <td className="border border-black p-2 font-bold">{e.createdByName || '-'}</td>
                                    <td className="border border-black p-2 text-center font-mono">
                                        {e.completedAt ? new Date(e.completedAt).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'}) : 'لم يخرج'}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={7} className="border border-black p-4 text-center">لا يوجد حالات خروج لهذا اليوم</td></tr>
                        )}
                    </tbody>
                </table>
            </>
        )}

        {/* Visitors Report Content */}
        {printMode === 'visitors' && (
            <>
                <h1 className="text-2xl font-extrabold text-center mb-6 underline underline-offset-8">سجل الزوار اليومي</h1>
                <table className="w-full text-right border-collapse border border-black text-sm">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-black p-2 w-10 text-center">م</th>
                            <th className="border border-black p-2">اسم الزائر</th>
                            <th className="border border-black p-2">ولي أمر الطالب</th>
                            <th className="border border-black p-2">سبب الزيارة</th>
                            <th className="border border-black p-2 text-center">وقت الموعد</th>
                            <th className="border border-black p-2 text-center">وقت الحضور</th>
                            <th className="border border-black p-2 text-center">الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        {todaysVisits.length > 0 ? (
                            todaysVisits.map((v, idx) => {
                                const statusText = getVisitorReportStatus(v);
                                return (
                                <tr key={idx}>
                                    <td className="border border-black p-2 text-center">{idx + 1}</td>
                                    <td className="border border-black p-2 font-bold">{v.parentName}</td>
                                    <td className="border border-black p-2">{v.studentName}</td>
                                    <td className="border border-black p-2">{v.visitReason}</td>
                                    <td className="border border-black p-2 text-center font-mono">{v.slot?.startTime}</td>
                                    <td className="border border-black p-2 text-center font-mono">
                                        {v.arrivedAt ? new Date(v.arrivedAt).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'}) : '-'}
                                    </td>
                                    <td className="border border-black p-2 text-center font-bold">
                                        {statusText}
                                    </td>
                                </tr>
                            )})
                        ) : (
                            <tr><td colSpan={7} className="border border-black p-4 text-center">لا يوجد زوار لهذا اليوم</td></tr>
                        )}
                    </tbody>
                </table>
            </>
        )}

        {/* Footer */}
        <div className="mt-16 flex justify-between px-12 text-lg">
            <div className="text-center"><p className="font-bold mb-8">مشرف الأمن</p><p>.............................</p></div>
            <div className="text-center"><p className="font-bold mb-8">مدير المدرسة</p><p>.............................</p></div>
        </div>
        <div className="mt-8 text-center text-[10px] border-t border-black pt-2">
            تم استخراج التقرير آلياً من نظام الأمن الذكي - {new Date().toLocaleTimeString('ar-SA')}
        </div>
    </div>

    <div className="max-w-7xl mx-auto space-y-6 pb-24 no-print animate-fade-in">
        
        {/* HEADER & STATS (SQUARES LAYOUT) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center gap-2 aspect-square hover:border-orange-200 transition-colors">
                <div className="bg-orange-50 p-4 rounded-full text-orange-600 mb-1">
                    <Clock size={28}/>
                </div>
                <h3 className="text-3xl font-extrabold text-slate-800">{stats.exitsPending}</h3>
                <p className="text-slate-400 text-xs font-bold uppercase">طلاب الانتظار</p>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center gap-2 aspect-square hover:border-emerald-200 transition-colors">
                <div className="bg-emerald-50 p-4 rounded-full text-emerald-600 mb-1">
                    <LogOut size={28}/>
                </div>
                <h3 className="text-3xl font-extrabold text-slate-800">{stats.exitsCompleted}</h3>
                <p className="text-slate-400 text-xs font-bold uppercase">تم الخروج</p>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center gap-2 aspect-square hover:border-blue-200 transition-colors">
                <div className="bg-blue-50 p-4 rounded-full text-blue-600 mb-1">
                    <UserCheck size={28}/>
                </div>
                <h3 className="text-3xl font-extrabold text-slate-800">{stats.visitsCompleted}/{stats.visitsTotal}</h3>
                <p className="text-slate-400 text-xs font-bold uppercase">زوار اليوم</p>
            </div>

            <div 
                onClick={generateReport}
                className="bg-purple-50 p-6 rounded-3xl shadow-sm border border-purple-100 flex flex-col items-center justify-center text-center gap-2 aspect-square cursor-pointer hover:bg-purple-100 transition-colors group"
            >
                <div className="bg-white p-4 rounded-full text-purple-600 mb-1 shadow-sm group-hover:scale-110 transition-transform">
                    <Sparkles size={28}/>
                </div>
                <h3 className="text-lg font-bold text-purple-900">التقرير الذكي</h3>
                <p className="text-purple-400 text-xs font-bold uppercase">تحليل فوري</p>
            </div>
        </div>

        {/* AI REPORT OVERLAY */}
        {showSmartReport && (
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6 relative animate-fade-in shadow-sm">
                <button onClick={() => setShowSmartReport(false)} className="absolute top-4 left-4 text-purple-400 hover:text-purple-700"><X size={20}/></button>
                <h3 className="font-bold text-purple-900 mb-4 flex items-center gap-2"><BrainCircuit size={20}/> تقرير الأمن الذكي</h3>
                {isAnalyzing ? (
                    <div className="flex items-center gap-2 text-purple-600 font-bold"><Loader2 className="animate-spin"/> جاري تحليل البيانات...</div>
                ) : (
                    <p className="text-sm text-purple-800 leading-relaxed whitespace-pre-line">{aiReport}</p>
                )}
            </div>
        )}

        {/* NAVIGATION TABS */}
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex overflow-x-auto">
            <button 
                onClick={() => setActiveTab('scanner')} 
                className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all whitespace-nowrap ${activeTab === 'scanner' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <Camera size={18} /> الماسح الضوئي
            </button>
            <button 
                onClick={() => setActiveTab('students')} 
                className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all whitespace-nowrap ${activeTab === 'students' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <Grid size={18} /> طابور الطلاب ({stats.exitsPending})
            </button>
            <button 
                onClick={() => setActiveTab('visitors')} 
                className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all whitespace-nowrap ${activeTab === 'visitors' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <List size={18} /> سجل الزوار
            </button>
        </div>

        {/* ================= CONTENT: SCANNER ================= */}
        {activeTab === 'scanner' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
                {/* Camera View */}
                <div className="bg-black rounded-3xl overflow-hidden relative shadow-lg border-4 border-slate-800">
                    <div id="reader" className="w-full h-full object-cover"></div>
                    
                    {!scanError && (
                        <div className="absolute top-4 right-4 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-full animate-pulse flex items-center gap-1 z-10">
                            <div className="w-2 h-2 bg-white rounded-full"></div> LIVE
                        </div>
                    )}

                    {/* Scanner Errors Overlay */}
                    {scanError && (
                        <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-white p-6 text-center z-20">
                            <AlertCircle size={48} className="text-red-500 mb-4"/>
                            <h3 className="text-xl font-bold mb-2">تعذر الوصول للكاميرا</h3>
                            <p className="text-slate-300 text-sm mb-6">{scanError}</p>
                            <button onClick={startScanner} className="bg-white text-slate-900 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-200 transition-colors">
                                <RefreshCw size={18}/> إعادة المحاولة
                            </button>
                        </div>
                    )}

                    {/* Instructions Overlay */}
                    {!scanResult && !scanError && (
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent text-white text-center pointer-events-none">
                            <p className="font-bold text-lg mb-1">وجه الكاميرا نحو الرمز</p>
                            <p className="text-sm opacity-80">يدعم بطاقات الطلاب ومواعيد الزوار</p>
                        </div>
                    )}
                </div>

                {/* Result Panel */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col justify-center items-center text-center relative overflow-hidden">
                    {!scanResult ? (
                        <div className="text-slate-300 flex flex-col items-center">
                            <QrCode size={80} className="mb-4 opacity-50" />
                            <p className="font-bold text-lg text-slate-400">بانتظار المسح...</p>
                        </div>
                    ) : (
                        <div className="w-full max-w-md animate-fade-in-up z-10">
                            {/* Loading State */}
                            {scanLoading && <Loader2 size={48} className="text-blue-600 animate-spin mx-auto mb-4" />}
                            
                            {/* Error State */}
                            {scanError && (
                                <div className="text-red-500 mb-6">
                                    <XCircle size={64} className="mx-auto mb-2" />
                                    <h3 className="text-xl font-bold">خطأ في المسح</h3>
                                    <p className="text-sm mt-1">{scanError}</p>
                                </div>
                            )}

                            {/* Already Processed State */}
                            {isAlreadyProcessed && !scanError && (
                                <div className="text-amber-500 mb-6">
                                    <History size={64} className="mx-auto mb-2" />
                                    <h3 className="text-xl font-bold">تمت العملية مسبقاً</h3>
                                    <p className="text-sm mt-1 text-slate-500">
                                        {scannedExit ? `تم خروج الطالب ${scannedExit.studentName}` : `تم دخول الزائر ${scannedAppointment?.parentName}`}
                                    </p>
                                    <p className="text-xs font-mono mt-1 text-slate-400">
                                        {scannedExit?.completedAt ? new Date(scannedExit.completedAt).toLocaleTimeString('ar-SA') : scannedAppointment?.arrivedAt ? new Date(scannedAppointment.arrivedAt).toLocaleTimeString('ar-SA') : ''}
                                    </p>
                                </div>
                            )}

                            {/* Success Action State */}
                            {scanSuccessType && (
                                <div className="text-emerald-500 mb-6">
                                    <CheckCircle size={64} className="mx-auto mb-2" />
                                    <h3 className="text-xl font-bold">{scanSuccessType === 'exit' ? 'تم تسجيل الخروج' : 'تم تسجيل الدخول'}</h3>
                                    <p className="text-sm mt-1 text-slate-500">العملية ناجحة</p>
                                </div>
                            )}

                            {/* Verification State (Ready to Confirm) */}
                            {!scanLoading && !scanError && !isAlreadyProcessed && !scanSuccessType && (
                                <>
                                    {scannedExit && (
                                        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 mb-6">
                                            <p className="text-xs font-bold text-orange-400 uppercase mb-2">إذن مغادرة طالب</p>
                                            <h2 className="text-2xl font-bold text-slate-800 mb-1">{scannedExit.studentName}</h2>
                                            <p className="text-sm text-slate-500 mb-4">{scannedExit.grade} - {scannedExit.className}</p>
                                            
                                            <div className="bg-white rounded-xl p-3 text-left space-y-2 border border-orange-100">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-400">المستلم:</span>
                                                    <span className="font-bold text-slate-700">{scannedExit.parentName}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-400">المصرح:</span>
                                                    <span className="font-bold text-slate-700">{scannedExit.createdByName}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {scannedAppointment && (
                                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 mb-6">
                                            <p className="text-xs font-bold text-blue-400 uppercase mb-2">موعد زيارة</p>
                                            <h2 className="text-2xl font-bold text-slate-800 mb-1">{scannedAppointment.parentName}</h2>
                                            <p className="text-sm text-slate-500 mb-4">ولي أمر الطالب: {scannedAppointment.studentName}</p>
                                            
                                            <div className="bg-white rounded-xl p-3 text-left space-y-2 border border-blue-100">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-400">الوقت:</span>
                                                    <span className="font-bold text-slate-700 font-mono">{scannedAppointment.slot?.startTime}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-400">السبب:</span>
                                                    <span className="font-bold text-slate-700">{scannedAppointment.visitReason}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <button 
                                        onClick={confirmAction}
                                        className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 ${scannedExit ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
                                    >
                                        <CheckCircle size={20} />
                                        {scannedExit ? 'تأكيد مغادرة الطالب' : 'تسجيل دخول الزائر'}
                                    </button>
                                </>
                            )}

                            {/* Reset Button */}
                            <button 
                                onClick={resetScanner} 
                                className="mt-4 text-slate-400 font-bold text-sm hover:text-slate-600 flex items-center justify-center gap-2 w-full py-3"
                            >
                                <RefreshCw size={14} /> مسح رمز جديد
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* ================= CONTENT: STUDENTS QUEUE ================= */}
        {activeTab === 'students' && (
            <div className="space-y-6">
                {/* Search Bar & Date Picker */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                        <input 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="بحث في قائمة الخروج..."
                            className="w-full pr-10 pl-4 py-2 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-orange-100"
                        />
                    </div>
                    
                    {/* Report Date Picker */}
                    <div className="relative w-full md:w-auto">
                        <input 
                            type="date" 
                            value={reportDate} 
                            onChange={(e) => setReportDate(e.target.value)} 
                            className="w-full md:w-auto pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-orange-100 font-bold text-slate-600 cursor-pointer"
                        />
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>

                    <div className="flex gap-2">
                        <button onClick={fetchDailyData} className="bg-slate-100 p-2 rounded-xl text-slate-500 hover:text-slate-800"><RefreshCw size={20}/></button>
                        <button onClick={() => handlePrint('exits')} className="bg-slate-800 text-white p-2 rounded-xl flex items-center gap-2 px-4 font-bold text-sm hover:bg-slate-900"><Printer size={18}/> طباعة التقرير</button>
                    </div>
                </div>

                {/* Queue Grid */}
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Clock size={20} className="text-orange-500"/> قيد الانتظار ({todaysExits.filter(e => e.status === 'pending_pickup').length})</h3>
                
                {filteredExits.filter(e => e.status === 'pending_pickup').length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">
                        <LogOut size={48} className="mx-auto mb-4 opacity-50"/>
                        <p>لا يوجد طلاب في الانتظار حالياً</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredExits.filter(e => e.status === 'pending_pickup').map(e => (
                            <div key={e.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
                                <div className="p-5 flex justify-between items-start bg-gradient-to-br from-white to-orange-50/50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-lg">
                                            {e.studentName.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 text-base">{e.studentName}</h4>
                                            <p className="text-xs text-slate-500">{e.grade} - {e.className}</p>
                                        </div>
                                    </div>
                                    <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-orange-200">
                                        انتظار
                                    </span>
                                </div>
                                <div className="px-5 py-3 space-y-2 text-sm border-t border-slate-50 flex-1">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">المستلم:</span>
                                        <span className="font-bold text-slate-700">{e.parentName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">المصرح:</span>
                                        <span className="font-bold text-slate-700 bg-slate-100 px-2 rounded">{e.createdByName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">الوقت:</span>
                                        <span className="font-mono text-slate-600">{new Date(e.createdAt).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'})}</span>
                                    </div>
                                </div>
                                <div className="p-3 bg-slate-50 border-t border-slate-100">
                                    <button 
                                        onClick={() => handleManualExit(e.id)}
                                        className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-xl font-bold text-sm shadow-sm flex items-center justify-center gap-2"
                                    >
                                        <LogOut size={16}/> تأكيد المغادرة يدوياً
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* History List */}
                <div className="mt-8">
                    <h3 className="font-bold text-slate-500 text-sm uppercase mb-4 flex items-center gap-2"><CheckCircle size={16}/> تم المغادرة مؤخراً</h3>
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        {filteredExits.filter(e => e.status === 'completed').length === 0 ? (
                            <p className="p-6 text-center text-sm text-slate-400">السجل فارغ</p>
                        ) : (
                            <table className="w-full text-sm text-right">
                                <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase">
                                    <tr>
                                        <th className="p-3">الطالب</th>
                                        <th className="p-3">المستلم</th>
                                        <th className="p-3">وقت الخروج</th>
                                        <th className="p-3">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredExits.filter(e => e.status === 'completed').slice(0, 10).map(e => (
                                        <tr key={e.id} className="hover:bg-slate-50">
                                            <td className="p-3 font-bold text-slate-800">{e.studentName}</td>
                                            <td className="p-3 text-slate-600">{e.parentName}</td>
                                            <td className="p-3 font-mono text-slate-500">{new Date(e.completedAt!).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'})}</td>
                                            <td className="p-3"><span className="text-emerald-600 font-bold text-xs flex items-center gap-1"><CheckCircle size={12}/> مغادر</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* ================= CONTENT: VISITOR LOG ================= */}
        {activeTab === 'visitors' && (
            <div className="space-y-6">
                 {/* Search Bar & Date Picker */}
                 <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                        <input 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="بحث في سجل الزوار..."
                            className="w-full pr-10 pl-4 py-2 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    {/* Report Date Picker */}
                    <div className="relative w-full md:w-auto">
                        <input 
                            type="date" 
                            value={reportDate} 
                            onChange={(e) => setReportDate(e.target.value)} 
                            className="w-full md:w-auto pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-blue-100 font-bold text-slate-600 cursor-pointer"
                        />
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>

                    <div className="flex gap-2">
                        <button onClick={fetchDailyData} className="bg-slate-100 p-2 rounded-xl text-slate-500 hover:text-slate-800"><RefreshCw size={20}/></button>
                        <button onClick={() => handlePrint('visitors')} className="bg-slate-800 text-white p-2 rounded-xl flex items-center gap-2 px-4 font-bold text-sm hover:bg-slate-900"><Printer size={18}/> طباعة التقرير</button>
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><List size={20} className="text-blue-600"/> جدول الزيارات اليومي</h3>
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">{stats.visitsTotal} زائر</span>
                    </div>
                    
                    {filteredVisits.length === 0 ? (
                        <div className="p-20 text-center text-slate-400">
                            <UserCheck size={48} className="mx-auto mb-4 opacity-50"/>
                            <p>لا يوجد زيارات مسجلة لهذا اليوم.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredVisits.map(v => (
                                <div key={v.id} className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-4 w-full md:w-auto">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 ${v.status === 'completed' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                                            {v.parentName.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900">{v.parentName}</h4>
                                            <p className="text-xs text-slate-500">ولي أمر الطالب: <strong>{v.studentName}</strong></p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-400 uppercase font-bold">وقت الموعد</p>
                                            <p className="font-mono font-bold text-slate-700">{v.slot?.startTime}</p>
                                        </div>
                                        
                                        {v.status === 'completed' ? (
                                            <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border border-emerald-100">
                                                <CheckCircle size={16}/> تم الدخول
                                                <span className="text-[10px] opacity-70 font-mono">({new Date(v.arrivedAt!).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'})})</span>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => handleManualCheckIn(v.id)}
                                                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm shadow-blue-200 transition-colors flex items-center gap-2"
                                            >
                                                تسجيل دخول يدوي
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

    </div>
    </>
  );
};

export default GateScanner;
