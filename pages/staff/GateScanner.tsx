
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QrCode, CheckCircle, AlertCircle, Loader2, User, Clock, RefreshCw, XCircle, Printer, List, ShieldCheck, FileText, LayoutGrid, Sparkles, BrainCircuit, Calendar, ArrowRight, Bell, LogOut, Home, X, Camera, History, LogOut as ExitIcon, Grid } from 'lucide-react';
import { checkInVisitor, getDailyAppointments, generateSmartContent, getExitPermissions, completeExitPermission, getExitPermissionById } from '../../services/storage';
import { Appointment, ExitPermission } from '../../types';

// Declare global Html5Qrcode
declare var Html5Qrcode: any;

const GateScanner: React.FC = () => {
  // View State
  const [showLog, setShowLog] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [activeTab, setActiveTab] = useState<'scanner' | 'grid'>('scanner'); // NEW: Main Tabs
  
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scannedAppointment, setScannedAppointment] = useState<Appointment | null>(null);
  const [scannedExit, setScannedExit] = useState<ExitPermission | null>(null); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [exitSuccess, setExitSuccess] = useState(false); 
  const [isAlreadyCheckedIn, setIsAlreadyCheckedIn] = useState(false); 
  const [todaysVisits, setTodaysVisits] = useState<Appointment[]>([]);
  const [todaysExits, setTodaysExits] = useState<ExitPermission[]>([]); 
  
  // AI State
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const scannerRef = useRef<any>(null);
  const isScannerRunning = useRef<boolean>(false);
  const isProcessing = useRef<boolean>(false); 

  // Stats
  const stats = useMemo(() => {
      const exits = todaysExits.length;
      const exitsPending = todaysExits.filter(e => e.status === 'pending_pickup').length;
      const exitsCompleted = todaysExits.filter(e => e.status === 'completed').length;
      
      const visits = todaysVisits.length;
      const visitsArrived = todaysVisits.filter(v => v.status === 'completed').length;
      
      return { exits, exitsPending, exitsCompleted, visits, visitsArrived };
  }, [todaysExits, todaysVisits]);

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
        // Only run scanner if activeTab is 'scanner'
        if (activeTab !== 'scanner') {
            if (scannerRef.current && isScannerRunning.current) {
                scannerRef.current.stop().then(() => {
                    scannerRef.current.clear();
                    isScannerRunning.current = false;
                }).catch((err: any) => console.error("Stop failed", err));
            }
            return;
        }

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
        // Don't stop on unmount immediately to allow quick tab switching, 
        // but explicit stop logic above handles tab changes.
    };
  }, [activeTab]);

  const handleScanProcess = async (decodedText: string) => {
      setLoading(true);
      setError(null);
      setCheckInSuccess(false);
      setExitSuccess(false);
      setIsAlreadyCheckedIn(false);
      
      try {
          // 1. Determine ID
          let exitId = decodedText;
          if (decodedText.startsWith('EXIT:')) exitId = decodedText.split(':')[1];

          // 2. Check Local Cache First (Fast)
          let foundExit = todaysExits.find((e: any) => e.id === exitId);
          
          // 3. Fallback: Fetch from DB directly if not found locally (Fixes duplicate scan error on new items)
          if (!foundExit) {
              const freshExit = await getExitPermissionById(exitId);
              if (freshExit) {
                  foundExit = freshExit;
                  // Update local list to prevent re-fetching
                  setTodaysExits(prev => [...prev, freshExit]);
              }
          }
          
          if (foundExit) {
              setScannedExit(foundExit);
              setScannedAppointment(null); 
              if (foundExit.status === 'completed') {
                  setIsAlreadyCheckedIn(true);
              }
              setLoading(false);
              return;
          }

          // 4. Check Visitor Appointments (Local Cache is usually sufficient for pre-booked)
          const foundAppt = todaysVisits.find((a: any) => a.id === decodedText);
          
          if (foundAppt) {
              setScannedAppointment(foundAppt);
              setScannedExit(null); 
              if (foundAppt.status === 'completed') {
                  setIsAlreadyCheckedIn(true);
              }
          } else {
              setScannedAppointment(null);
              setScannedExit(null);
              setError("الرمز غير مسجل في النظام.");
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
              await completeExitPermission(scannedExit.id);
              setExitSuccess(true);
          } else if (scannedAppointment) {
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

  const generateSmartReport = async () => {
      setIsAnalyzing(true);
      try {
          const exitsText = todaysExits.map(e => `student: ${e.studentName}, authorizer: ${e.createdByName || 'Unknown'}, status: ${e.status}`).join('\n');
          const prompt = `
            بصفتك مسؤول الأمن الذكي، حلل حركة خروج الطلاب اليوم:
            إجمالي الخروج: ${stats.exits}
            المكتمل: ${stats.exitsCompleted}
            الانتظار: ${stats.exitsPending}
            
            قائمة الخروج:
            ${exitsText}
            
            المطلوب:
            1. تقرير موجز عن الحركة.
            2. ذكر أسماء الموظفين (المصرحين) الأكثر نشاطاً في التصريح.
            3. أي ملاحظات أمنية.
          `;
          const res = await generateSmartContent(prompt);
          setAiReport(res);
      } catch (e) { alert("فشل التحليل"); }
      finally { setIsAnalyzing(false); }
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in space-y-6 no-print pb-20">
        
        {/* COMPACT HEADER */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
                <div className="bg-teal-50 p-2.5 rounded-xl text-teal-600">
                    <ShieldCheck size={24} />
                </div>
                <div>
                    <h1 className="text-lg font-bold text-slate-900">بوابة الأمن الذكية</h1>
                    <p className="text-xs text-slate-500 font-medium">التحكم بالدخول والخروج</p>
                </div>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto bg-slate-50 p-1 rounded-xl">
                <button 
                    onClick={() => setActiveTab('scanner')} 
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'scanner' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Camera size={18} /> الماسح
                </button>
                <button 
                    onClick={() => { setActiveTab('grid'); fetchDailyData(); }} 
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'grid' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Grid size={18} /> 
                    الطلاب ({stats.exitsPending})
                </button>
            </div>
        </div>

        {/* --- TAB 1: SCANNER --- */}
        {activeTab === 'scanner' && (
            <div className="bg-slate-900 rounded-3xl shadow-xl overflow-hidden flex flex-col relative border-4 border-slate-800 h-[600px]">
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
                            <div className="bg-white/10 rounded-xl p-4 w-full text-left mb-6 border border-white/10 mt-4 max-w-md">
                                {scannedExit ? (
                                    <>
                                        <div className="text-orange-400 font-bold text-center border-b border-white/10 pb-2 mb-2">إذن مغادرة طالب</div>
                                        <p className="text-white font-bold text-xl text-center mb-1">{scannedExit.studentName}</p>
                                        <p className="text-slate-300 text-center text-sm">{scannedExit.grade} - {scannedExit.className}</p>
                                        <div className="mt-4 flex justify-between text-sm border-t border-white/10 pt-2">
                                            <span className="text-slate-400">المستلم:</span>
                                            <span className="text-white font-bold">{scannedExit.parentName}</span>
                                        </div>
                                        <div className="mt-2 flex justify-between text-sm">
                                            <span className="text-slate-400">تم التصريح بواسطة:</span>
                                            <span className="text-orange-300 font-bold">{scannedExit.createdByName || 'غير محدد'}</span>
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

                        <div className="flex gap-3 w-full max-w-md mt-4">
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
        )}

        {/* --- TAB 2: GRID DASHBOARD --- */}
        {activeTab === 'grid' && (
            <div className="space-y-6">
                
                {/* Stats Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
                        <div className="bg-orange-50 p-2 rounded-lg text-orange-600"><LogOut size={20}/></div>
                        <div><p className="text-xs text-slate-500 font-bold">انتظار خروج</p><p className="text-xl font-bold text-slate-800">{stats.exitsPending}</p></div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
                        <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600"><CheckCircle size={20}/></div>
                        <div><p className="text-xs text-slate-500 font-bold">تم الخروج</p><p className="text-xl font-bold text-slate-800">{stats.exitsCompleted}</p></div>
                    </div>
                    <button onClick={() => setShowLog(true)} className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-100 flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors text-blue-700 font-bold">
                        <List size={20}/> سجل الزوار
                    </button>
                    <button onClick={generateSmartReport} disabled={isAnalyzing} className="bg-purple-50 p-4 rounded-xl shadow-sm border border-purple-100 flex items-center justify-center gap-2 hover:bg-purple-100 transition-colors text-purple-700 font-bold">
                        {isAnalyzing ? <Loader2 size={20} className="animate-spin"/> : <Sparkles size={20}/>} التقرير الذكي
                    </button>
                </div>

                {/* AI Report Section */}
                {aiReport && (
                    <div className="bg-purple-50 rounded-2xl p-6 border border-purple-200 relative animate-fade-in">
                        <button onClick={() => setAiReport(null)} className="absolute top-4 left-4 text-purple-400 hover:text-red-500"><X size={18}/></button>
                        <h3 className="font-bold text-purple-900 mb-3 flex items-center gap-2"><Sparkles size={18}/> تحليل الأمن الذكي</h3>
                        <p className="text-sm text-purple-800 leading-relaxed whitespace-pre-line font-medium">{aiReport}</p>
                    </div>
                )}

                {/* Main Grid */}
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Clock className="text-orange-500" size={20}/> قائمة الطلاب (الانتظار)
                </h3>
                
                {todaysExits.filter(e => e.status === 'pending_pickup').length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-200 border-dashed p-12 text-center text-slate-400">
                        <LogOut size={48} className="mx-auto mb-4 opacity-50"/>
                        <p className="font-bold">لا يوجد طلاب بانتظار المغادرة حالياً</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {todaysExits.filter(e => e.status === 'pending_pickup').map(e => (
                            <div key={e.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:border-orange-300 transition-colors">
                                <div className="p-4 flex items-start justify-between bg-gradient-to-br from-white to-slate-50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-lg border-2 border-white shadow-sm">
                                            {e.studentName.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 text-base">{e.studentName}</h4>
                                            <p className="text-xs text-slate-500">{e.grade} - {e.className}</p>
                                        </div>
                                    </div>
                                    <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded border border-orange-200">انتظار</span>
                                </div>
                                <div className="p-4 border-t border-slate-100 space-y-3 flex-1">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400">المستلم:</span>
                                        <span className="font-bold text-slate-700">{e.parentName}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400">المصرح:</span>
                                        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{e.createdByName || 'غير محدد'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400">الوقت:</span>
                                        <span className="font-mono text-slate-600">{new Date(e.createdAt).toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                </div>
                                <div className="p-3 bg-slate-50 border-t border-slate-100">
                                    <button onClick={() => manualConfirmExit(e.id)} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-xl font-bold text-sm transition-colors shadow-sm">
                                        تأكيد المغادرة يدوياً
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* History (Completed) */}
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mt-8 opacity-60">
                    <CheckCircle className="text-emerald-500" size={20}/> تم الخروج مؤخراً
                </h3>
                <div className="space-y-2 opacity-80">
                    {todaysExits.filter(e => e.status === 'completed').slice(0, 5).map(e => (
                        <div key={e.id} className="bg-slate-50 rounded-xl p-3 flex justify-between items-center border border-slate-200">
                            <span className="font-bold text-slate-600 text-sm">{e.studentName}</span>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-400">بواسطة: {e.createdByName}</span>
                                <span className="text-xs font-mono text-emerald-600 font-bold">{new Date(e.completedAt!).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'})}</span>
                            </div>
                        </div>
                    ))}
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
  );
};

export default GateScanner;
