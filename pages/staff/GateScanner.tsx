
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QrCode, CheckCircle, AlertCircle, Loader2, User, Clock, RefreshCw, XCircle, Printer, List, ShieldCheck, FileText, LayoutGrid, Sparkles, BrainCircuit, Calendar, ArrowRight, Bell, LogOut, Home, X, Camera, History, LogOut as ExitIcon } from 'lucide-react';
import { checkInVisitor, getDailyAppointments, generateSmartContent, getExitPermissions, completeExitPermission } from '../../services/storage';
import { Appointment, ExitPermission } from '../../types';

// Declare global Html5Qrcode
declare var Html5Qrcode: any;

const GateScanner: React.FC = () => {
  // View State - Scanner is default and always active
  const [showLog, setShowLog] = useState(false);
  const [showExitList, setShowExitList] = useState(false); // New: Show Exit Permissions
  const [showAnalytics, setShowAnalytics] = useState(false);
  
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scannedAppointment, setScannedAppointment] = useState<Appointment | null>(null);
  const [scannedExit, setScannedExit] = useState<ExitPermission | null>(null); // New: Scanned Exit
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [exitSuccess, setExitSuccess] = useState(false); // New
  const [isAlreadyCheckedIn, setIsAlreadyCheckedIn] = useState(false); 
  const [todaysVisits, setTodaysVisits] = useState<Appointment[]>([]);
  const [todaysExits, setTodaysExits] = useState<ExitPermission[]>([]); // New
  
  // AI State
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // School Identity
  const SCHOOL_NAME = localStorage.getItem('school_name') || "متوسطة عماد الدين زنكي";
  const SCHOOL_LOGO = "https://www.raed.net/img?id=1471924"; 

  const scannerRef = useRef<any>(null);
  const isScannerRunning = useRef<boolean>(false);
  const isProcessing = useRef<boolean>(false); 

  // Stats
  const stats = useMemo(() => {
      const total = todaysVisits.length;
      const arrived = todaysVisits.filter(v => v.status === 'completed').length;
      return { total, arrived, pending: total - arrived };
  }, [todaysVisits]);

  const fetchDailyData = async () => {
      const today = new Date().toISOString().split('T')[0];
      const [visits, exits] = await Promise.all([
          getDailyAppointments(today),
          getExitPermissions(today)
      ]);
      setTodaysVisits(visits);
      setTodaysExits(exits);
  };

  useEffect(() => {
    fetchDailyData();
    // Poll for new exit permissions every 30s
    const interval = setInterval(fetchDailyData, 30000);
    return () => clearInterval(interval);
  }, []);

  // --- SCANNER INITIALIZATION ---
  useEffect(() => {
    const startScanner = async () => {
        if (isScannerRunning.current || !document.getElementById('reader')) return;

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
                    if (!isProcessing.current) {
                        isProcessing.current = true;
                        setScanResult(decodedText);
                        handleScanProcess(decodedText);
                    }
                },
                (errorMessage: string) => { }
            );
            isScannerRunning.current = true;
        } catch (err) {
            console.error("Camera start error:", err);
            setError("تعذر تشغيل الكاميرا. يرجى التأكد من السماح بالوصول للكاميرا في إعدادات المتصفح.");
        }
    };

    const timer = setTimeout(startScanner, 500);

    return () => {
        clearTimeout(timer);
        if (scannerRef.current && isScannerRunning.current) {
            scannerRef.current.stop().then(() => {
                scannerRef.current.clear();
                isScannerRunning.current = false;
            }).catch((err: any) => console.error("Stop failed", err));
        }
    };
  }, []);

  const handleScanProcess = async (decodedText: string) => {
      setLoading(true);
      setError(null);
      setCheckInSuccess(false);
      setExitSuccess(false);
      setIsAlreadyCheckedIn(false);
      
      try {
          const today = new Date().toISOString().split('T')[0];
          await fetchDailyData(); 
          
          // 1. Check Exit Permissions (Prefix 'EXIT:' or just ID lookup)
          // We'll try to find in exits first since prompt implies dedicated QR
          let exitId = decodedText;
          if (decodedText.startsWith('EXIT:')) exitId = decodedText.split(':')[1];

          // Check Exits
          const foundExit = todaysExits.find((e: any) => e.id === exitId);
          
          if (foundExit) {
              setScannedExit(foundExit);
              setScannedAppointment(null); // Clear appt
              if (foundExit.status === 'completed') {
                  setIsAlreadyCheckedIn(true);
              }
              setLoading(false);
              return;
          }

          // 2. Check Visitor Appointments
          const foundAppt = todaysVisits.find((a: any) => a.id === decodedText);
          
          if (foundAppt) {
              setScannedAppointment(foundAppt);
              setScannedExit(null); // Clear exit
              if (foundAppt.status === 'completed') {
                  setIsAlreadyCheckedIn(true);
              }
          } else {
              setScannedAppointment(null);
              setScannedExit(null);
              setError("الرمز غير مسجل في النظام لهذا اليوم.");
          }
      } catch (e) {
          setError("حدث خطأ أثناء التحقق من البيانات.");
      } finally {
          setLoading(false);
      }
  };

  const confirmCheckIn = async () => {
      setLoading(true);
      try {
          if (scannedExit) {
              // Confirm Exit
              await completeExitPermission(scannedExit.id);
              setExitSuccess(true);
          } else if (scannedAppointment) {
              // Confirm Visitor
              await checkInVisitor(scannedAppointment.id);
              setCheckInSuccess(true);
          }
          fetchDailyData();
      } catch (e) {
          setError("فشل تنفيذ العملية.");
      } finally {
          setLoading(false);
      }
  };

  const manualConfirmExit = async (id: string) => {
      if(!window.confirm("هل أنت متأكد من مغادرة الطالب؟")) return;
      await completeExitPermission(id);
      fetchDailyData();
  };

  const resetScanner = () => {
      setScanResult(null);
      setScannedAppointment(null);
      setScannedExit(null);
      setError(null);
      setCheckInSuccess(false);
      setExitSuccess(false);
      setIsAlreadyCheckedIn(false);
      isProcessing.current = false;
  };

  return (
    <>
    <div className="max-w-7xl mx-auto animate-fade-in space-y-6 no-print pb-20">
        
        {/* COMPACT HEADER */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
                <div className="bg-teal-50 p-2.5 rounded-xl text-teal-600">
                    <ShieldCheck size={24} />
                </div>
                <div>
                    <h1 className="text-lg font-bold text-slate-900">بوابة الأمن الذكية</h1>
                    <p className="text-xs text-slate-500 font-medium">الماسح الضوئي نشط دائماً (الكاميرا الخلفية)</p>
                </div>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
                <button onClick={() => setShowExitList(true)} className="flex-1 md:flex-none bg-orange-50 text-orange-600 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-orange-100 transition-colors flex items-center justify-center gap-2 border border-orange-100">
                    <LogOut size={18} /> مغادرة الطلاب
                    {todaysExits.filter(e => e.status === 'pending_pickup').length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full animate-pulse">{todaysExits.filter(e => e.status === 'pending_pickup').length}</span>}
                </button>
                <button onClick={() => setShowLog(true)} className="flex-1 md:flex-none bg-blue-50 text-blue-600 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 border border-blue-100">
                    <List size={18} /> سجل الزوار
                </button>
            </div>
        </div>

        {/* MAIN SCANNER AREA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 1. Camera Feed */}
            <div className="bg-slate-900 rounded-3xl shadow-xl overflow-hidden flex flex-col relative border-4 border-slate-800 h-[500px]">
                <div className="absolute top-4 left-4 z-10 bg-red-600/90 text-white text-[10px] font-bold px-3 py-1 rounded-full animate-pulse flex items-center gap-1">
                    <div className="w-2 h-2 bg-white rounded-full"></div> مباشر
                </div>
                
                {/* Result Overlay */}
                {scanResult && (
                    <div className="absolute inset-0 z-20 bg-slate-900/95 flex flex-col items-center justify-center p-8 animate-fade-in text-center">
                        {loading ? (
                            <Loader2 size={48} className="text-teal-500 animate-spin mb-4"/>
                        ) : isAlreadyCheckedIn ? (
                             <History size={64} className="text-amber-500 mb-4 animate-pulse"/>
                        ) : checkInSuccess || exitSuccess ? (
                            <CheckCircle size={64} className="text-emerald-500 mb-4"/>
                        ) : error ? (
                            <XCircle size={64} className="text-red-500 mb-4"/>
                        ) : (
                            <AlertCircle size={64} className="text-blue-500 mb-4"/>
                        )}

                        <h3 className="text-2xl font-bold text-white mb-2">
                            {isAlreadyCheckedIn ? 'تمت العملية مسبقاً' : (checkInSuccess || exitSuccess) ? 'تمت العملية بنجاح' : error ? 'تنبيه' : 'تأكيد البيانات'}
                        </h3>
                        
                        {/* Detail Box */}
                        {(scannedAppointment || scannedExit) && !error && !checkInSuccess && !exitSuccess && !isAlreadyCheckedIn && (
                            <div className="bg-white/10 rounded-xl p-4 w-full text-left mb-6 border border-white/10 mt-4">
                                {scannedExit ? (
                                    <>
                                        <div className="text-orange-400 font-bold text-center border-b border-white/10 pb-2 mb-2">إذن مغادرة طالب</div>
                                        <p className="text-white font-bold text-lg text-center mb-1">{scannedExit.studentName}</p>
                                        <p className="text-slate-300 text-center text-sm">{scannedExit.grade} - {scannedExit.className}</p>
                                        <div className="mt-4 flex justify-between text-sm">
                                            <span className="text-slate-400">المستلم:</span>
                                            <span className="text-white font-bold">{scannedExit.parentName}</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-teal-400 font-bold text-center border-b border-white/10 pb-2 mb-2">زائر (موعد)</div>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-slate-400">الزائر</span>
                                            <span className="text-white font-bold">{scannedAppointment?.parentName}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">الطالب</span>
                                            <span className="text-white font-bold">{scannedAppointment?.studentName}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3 w-full mt-4">
                            {!checkInSuccess && !exitSuccess && !error && !isAlreadyCheckedIn && (
                                <button onClick={confirmCheckIn} className={`flex-1 ${scannedExit ? 'bg-orange-500 hover:bg-orange-600' : 'bg-teal-500 hover:bg-teal-600'} text-white py-3 rounded-xl font-bold transition-colors`}>
                                    {scannedExit ? 'تأكيد المغادرة' : 'تأكيد الدخول'}
                                </button>
                            )}
                            <button onClick={resetScanner} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold border border-white/10 transition-colors">
                                مسح جديد
                            </button>
                        </div>
                    </div>
                )}

                <div id="reader" className="w-full h-full object-cover"></div>
            </div>

            {/* 2. Side Panel (Quick Exit List) */}
            <div className="flex flex-col gap-6 h-[500px]">
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-50">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><LogOut className="text-orange-600" size={18}/> طلاب للمغادرة الآن</h3>
                        <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded-full">{todaysExits.filter(e => e.status === 'pending_pickup').length}</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                        {todaysExits.filter(e => e.status === 'pending_pickup').length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                                <LogOut size={40} className="mb-2"/>
                                <p className="text-sm">لا يوجد طلاب بانتظار المغادرة</p>
                            </div>
                        ) : (
                            todaysExits.filter(e => e.status === 'pending_pickup').map(e => (
                                <div key={e.id} className="p-3 rounded-2xl bg-orange-50 border border-orange-100 flex flex-col gap-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{e.studentName}</p>
                                            <p className="text-[10px] text-slate-500">{e.grade} - {e.className}</p>
                                        </div>
                                        <span className="text-[10px] font-bold text-orange-600 bg-white px-2 py-1 rounded shadow-sm">انتظار</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs pt-2 border-t border-orange-200/50">
                                        <span className="text-slate-600">المستلم: <strong>{e.parentName}</strong></span>
                                        <button onClick={() => manualConfirmExit(e.id)} className="bg-orange-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-orange-700 transition-colors">تأكيد الخروج</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* --- OVERLAYS --- */}

        {/* EXIT LIST FULL OVERLAY */}
        {showExitList && (
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><LogOut size={20} className="text-orange-600"/> سجل استئذان الطلاب اليومي</h2>
                        <button onClick={() => setShowExitList(false)} className="bg-white p-2 rounded-full text-slate-400 hover:text-red-500 shadow-sm border border-slate-100 transition-colors"><X size={20}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-slate-50 font-bold text-slate-600">
                                <tr>
                                    <th className="p-3">الطالب</th>
                                    <th className="p-3">ولي الأمر</th>
                                    <th className="p-3">وقت الطلب</th>
                                    <th className="p-3">وقت الخروج</th>
                                    <th className="p-3">الحالة</th>
                                </tr>
                            </thead>
                            <tbody>
                                {todaysExits.map((e, idx) => (
                                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                                        <td className="p-3 font-bold">{e.studentName}</td>
                                        <td className="p-3">{e.parentName} <span className="text-[10px] text-slate-400 block">{e.parentPhone}</span></td>
                                        <td className="p-3 font-mono">{new Date(e.createdAt).toLocaleTimeString('ar-SA')}</td>
                                        <td className="p-3 font-mono text-emerald-600 font-bold">{e.completedAt ? new Date(e.completedAt).toLocaleTimeString('ar-SA') : '-'}</td>
                                        <td className="p-3">
                                            {e.status === 'completed' ? <span className="text-emerald-600 font-bold">تم الخروج</span> : <button onClick={() => manualConfirmExit(e.id)} className="text-xs bg-orange-600 text-white px-2 py-1 rounded">تأكيد الآن</button>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* LOG OVERLAY (Visitors) */}
        {showLog && (
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><List size={20} className="text-blue-600"/> سجل الزوار التفصيلي</h2>
                        <button onClick={() => setShowLog(false)} className="bg-white p-2 rounded-full text-slate-400 hover:text-red-500 shadow-sm border border-slate-100 transition-colors"><X size={20}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                        {/* Existing Visitor Table ... */}
                        <table className="w-full text-right text-sm">
                            <thead className="bg-slate-50 font-bold text-slate-600">
                                <tr>
                                    <th className="p-3">الزائر</th>
                                    <th className="p-3">الطالب</th>
                                    <th className="p-3">الوقت</th>
                                    <th className="p-3">الحالة</th>
                                </tr>
                            </thead>
                            <tbody>
                                {todaysVisits.map((v, idx) => (
                                    <tr key={idx} className="border-b border-slate-50">
                                        <td className="p-3 font-bold">{v.parentName}</td>
                                        <td className="p-3">{v.studentName}</td>
                                        <td className="p-3 font-mono">{v.slot?.startTime}</td>
                                        <td className="p-3">
                                            {v.status === 'completed' ? <span className="text-emerald-600 font-bold">تم الدخول</span> : <span className="text-slate-400">انتظار</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

    </div>
    </>
  );
};

export default GateScanner;
