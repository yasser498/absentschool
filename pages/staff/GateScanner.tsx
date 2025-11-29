import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QrCode, CheckCircle, AlertCircle, Loader2, User, Clock, RefreshCw, XCircle, Printer, List, ShieldCheck, FileText, LayoutGrid, Sparkles, BrainCircuit, Calendar, ArrowRight, Bell, LogOut, Home } from 'lucide-react';
import { checkInVisitor, getDailyAppointments, generateSmartContent } from '../../services/storage';
import { Appointment } from '../../types';

// Declare global Html5QrcodeScanner
declare var Html5QrcodeScanner: any;

const GateScanner: React.FC = () => {
  // View State - Default to 'menu' (Dashboard) as requested for "squares"
  const [activeView, setActiveView] = useState<'menu' | 'scanner' | 'log' | 'analytics'>('menu');
  
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scannedAppointment, setScannedAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [todaysVisits, setTodaysVisits] = useState<Appointment[]>([]);
  
  // AI State
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const scannerRef = useRef<any>(null);

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

  // Scanner Logic
  useEffect(() => {
    if (activeView === 'scanner') {
        const timer = setTimeout(() => {
            if (!scannerRef.current && document.getElementById('reader')) {
                const onScanSuccess = (decodedText: string, decodedResult: any) => {
                    if (scannerRef.current) {
                       scannerRef.current.clear(); 
                    }
                    setScanResult(decodedText);
                    handleScanProcess(decodedText);
                };
    
                const onScanFailure = (error: any) => {};
    
                try {
                    const html5QrcodeScanner = new Html5QrcodeScanner(
                        "reader",
                        { fps: 10, qrbox: { width: 250, height: 250 } },
                        false
                    );
                    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
                    scannerRef.current = html5QrcodeScanner;
                } catch (e) {
                    console.error("Scanner init error", e);
                }
            }
        }, 300);

        return () => clearTimeout(timer);
    } else {
        if (scannerRef.current) {
            try { scannerRef.current.clear().catch(() => {}); } catch(e) {}
            scannerRef.current = null;
        }
        setScanResult(null);
        setScannedAppointment(null);
        setCheckInSuccess(false);
        setError(null);
    }
  }, [activeView]);

  const handleScanProcess = async (appointmentId: string) => {
      setLoading(true);
      setError(null);
      try {
          const today = new Date().toISOString().split('T')[0];
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
      // Force reload scanner instance by toggling view briefly or just clearing state
      if (scannerRef.current) {
           scannerRef.current.render(
               (text: string) => {
                   scannerRef.current.clear();
                   setScanResult(text);
                   handleScanProcess(text);
               },
               () => {}
           );
      }
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

  const menuItems = [
      { id: 'scanner', title: 'الماسح الضوئي', desc: 'مسح QR وتسجيل الدخول', icon: QrCode, color: 'bg-teal-500', gradient: 'from-teal-500 to-teal-600' },
      { id: 'log', title: 'سجل الزيارات', desc: 'عرض وطباعة قائمة اليوم', icon: List, color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' },
      { id: 'analytics', title: 'التحليل الأمني', desc: 'تقرير الذكاء الاصطناعي', icon: BrainCircuit, color: 'bg-purple-500', gradient: 'from-purple-500 to-purple-600' },
  ];

  return (
    <>
    <style>
        {`
          @media print {
            body * { visibility: hidden; }
            #gate-report, #gate-report * { visibility: visible; }
            #gate-report { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; background: white; z-index: 9999; }
            .no-print { display: none !important; }
          }
        `}
    </style>

    {/* PRINT REPORT */}
    <div id="gate-report" className="hidden" dir="rtl">
        <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
            <div className="text-right font-bold text-sm space-y-1">
                <p>المملكة العربية السعودية</p>
                <p>وزارة التعليم</p>
                <p>الأمن والسلامة</p>
            </div>
            <div className="text-center">
                <h1 className="text-2xl font-bold mb-2">سجل الزوار اليومي</h1>
                <p className="text-lg font-mono">{new Date().toLocaleDateString('ar-SA')}</p>
            </div>
            <div className="text-left">
                {/* Placeholder for Logo */}
            </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6 text-center print:grid print:grid-cols-3">
             <div className="border border-black p-2 font-bold">إجمالي المواعيد: {stats.total}</div>
             <div className="border border-black p-2 font-bold">تم الوصول: {stats.arrived}</div>
             <div className="border border-black p-2 font-bold">لم يصل: {stats.pending}</div>
        </div>
        <table className="w-full text-right border-collapse border border-black text-sm">
            <thead>
                <tr className="bg-gray-100 print:bg-gray-200">
                    <th className="border border-black p-2">الزائر</th>
                    <th className="border border-black p-2">الطالب</th>
                    <th className="border border-black p-2">الموعد</th>
                    <th className="border border-black p-2">وقت الوصول</th>
                    <th className="border border-black p-2">السبب</th>
                </tr>
            </thead>
            <tbody>
                {todaysVisits.map((v, idx) => (
                    <tr key={idx}>
                        <td className="border border-black p-2">{v.parentName}</td>
                        <td className="border border-black p-2">{v.studentName}</td>
                        <td className="border border-black p-2">{v.slot?.startTime}</td>
                        <td className="border border-black p-2">{v.arrivedAt ? new Date(v.arrivedAt).toLocaleTimeString('ar-SA') : '-'}</td>
                        <td className="border border-black p-2">{v.visitReason}</td>
                    </tr>
                ))}
            </tbody>
        </table>
        <div className="mt-12 flex justify-between px-10">
            <div className="text-center">
                <p className="font-bold mb-8">مسؤول الأمن</p>
                <p>.....................</p>
            </div>
            <div className="text-center">
                <p className="font-bold mb-8">مدير المدرسة</p>
                <p>.....................</p>
            </div>
        </div>
    </div>

    <div className="max-w-6xl mx-auto p-4 animate-fade-in space-y-6 no-print pb-20">
        
        {/* WELCOME HEADER */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 rounded-3xl shadow-lg text-white relative overflow-hidden mb-6">
             <div className="absolute top-0 left-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
             <div className="absolute bottom-0 right-0 w-48 h-48 bg-teal-500 opacity-10 rounded-full translate-x-1/2 translate-y-1/2"></div>
             
             <div className="relative z-10 flex justify-between items-center">
                 <div>
                     <div className="flex items-center gap-3 mb-1 opacity-80">
                         <ShieldCheck size={20} />
                         <span className="text-sm font-bold uppercase tracking-wider">بوابة الأمن والسلامة</span>
                     </div>
                     <h1 className="text-2xl font-bold">مرحباً بك، مسؤول الأمن 👋</h1>
                 </div>
                 <div className="hidden md:block text-left">
                     <p className="text-xs font-bold text-slate-400 uppercase mb-1">تاريخ اليوم</p>
                     <p className="text-lg font-bold">{new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                 </div>
             </div>
        </div>

        {/* Navigation Header (Back Button) */}
        {activeView !== 'menu' && (
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${activeView === 'scanner' ? 'bg-teal-50 text-teal-600' : 'bg-blue-50 text-blue-600'}`}>
                        {activeView === 'scanner' ? <QrCode size={24} /> : <List size={24} />}
                    </div>
                    <h1 className="text-xl font-bold text-slate-900">
                        {activeView === 'scanner' ? 'الماسح الضوئي' : 
                         activeView === 'log' ? 'سجل الزوار' : 'التحليل الذكي'}
                    </h1>
                </div>
                <button onClick={() => setActiveView('menu')} className="bg-slate-50 text-slate-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors flex items-center gap-2">
                    <LayoutGrid size={16} /> القائمة الرئيسية
                </button>
            </div>
        )}

        {/* MENU VIEW (DASHBOARD) */}
        {activeView === 'menu' && (
            <div className="space-y-8 animate-fade-in-up">
                
                {/* Quick Stats Strip */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                        <span className="text-3xl font-extrabold text-slate-800 block mb-1">{stats.total}</span>
                        <span className="text-xs font-bold text-slate-400 uppercase">زوار اليوم</span>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm flex flex-col items-center justify-center text-center bg-emerald-50/30">
                        <span className="text-3xl font-extrabold text-emerald-600 block mb-1">{stats.arrived}</span>
                        <span className="text-xs font-bold text-emerald-600 uppercase">تم الدخول</span>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm flex flex-col items-center justify-center text-center bg-amber-50/30">
                        <span className="text-3xl font-extrabold text-amber-600 block mb-1">{stats.pending}</span>
                        <span className="text-xs font-bold text-amber-600 uppercase">قائمة الانتظار</span>
                    </div>
                </div>

                {/* Main Actions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {menuItems.map(item => (
                        <button 
                            key={item.id}
                            onClick={() => setActiveView(item.id as any)}
                            className="group relative overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 h-64 text-right p-6 flex flex-col justify-between hover:-translate-y-1"
                        >
                            <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${item.gradient}`}></div>
                            
                            <div className="relative z-10">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br ${item.gradient} mb-6 group-hover:scale-110 transition-transform`}>
                                    <item.icon size={32} />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-2 group-hover:text-teal-900 transition-colors">{item.title}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                            </div>

                            <div className="flex items-center gap-2 text-sm font-bold text-slate-400 group-hover:text-teal-600 transition-colors mt-4">
                                <span>فتح الشاشة</span>
                                <ArrowRight size={18} className="group-hover:-translate-x-1 transition-transform"/>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Alert Banner */}
                {stats.pending > 0 && (
                    <div className="bg-white border-r-4 border-r-amber-500 rounded-xl p-4 shadow-sm flex items-center gap-4 animate-pulse">
                        <div className="bg-amber-100 p-2 rounded-full text-amber-600"><Bell size={20}/></div>
                        <p className="text-sm font-bold text-slate-700">
                            يوجد <span className="text-amber-600">{stats.pending}</span> زوار في قائمة الانتظار لم يصلوا بعد. يرجى الاستعداد عند البوابة.
                        </p>
                    </div>
                )}
            </div>
        )}

        {/* SCANNER VIEW */}
        {activeView === 'scanner' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                {/* Scanner Cam */}
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200 flex flex-col relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><QrCode className="text-teal-600"/> الماسح الضوئي</h2>
                        <div className="px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold animate-pulse">مباشر</div>
                    </div>
                    
                    {!scanResult ? (
                        <div className="bg-slate-900 rounded-2xl overflow-hidden flex-1 min-h-[350px] relative">
                            <div id="reader" className="w-full h-full"></div>
                            <div className="absolute inset-0 border-2 border-teal-500/30 pointer-events-none"></div>
                            <div className="absolute bottom-4 left-0 w-full text-center text-white/70 text-xs">وجه الكاميرا نحو الرمز</div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-slate-200 min-h-[350px] p-8">
                            {loading ? (
                                <div className="text-center">
                                    <Loader2 size={48} className="text-teal-600 animate-spin mx-auto mb-4"/>
                                    <p className="font-bold text-slate-600">جاري التحقق من البيانات...</p>
                                </div>
                            ) : (
                                <div className="w-full space-y-6">
                                    <div className={`text-center p-6 rounded-2xl ${checkInSuccess ? 'bg-emerald-100 text-emerald-800' : error ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {checkInSuccess ? (
                                            <>
                                                <CheckCircle size={48} className="mx-auto mb-2"/>
                                                <h3 className="text-xl font-bold">تم تسجيل الدخول</h3>
                                                <p className="text-sm text-emerald-600 mt-1">وقت الدخول: {new Date().toLocaleTimeString('ar-SA')}</p>
                                            </>
                                        ) : error ? (
                                            <>
                                                <XCircle size={48} className="mx-auto mb-2"/>
                                                <h3 className="text-xl font-bold">خطأ</h3>
                                                <p className="text-sm mt-1">{error}</p>
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle size={48} className="mx-auto mb-2"/>
                                                <h3 className="text-xl font-bold">تأكيد البيانات</h3>
                                            </>
                                        )}
                                    </div>
                                    
                                    {scannedAppointment && (
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 text-sm space-y-3">
                                            <div className="flex justify-between border-b pb-2"><span>الزائر</span><span className="font-bold">{scannedAppointment.parentName}</span></div>
                                            <div className="flex justify-between border-b pb-2"><span>الطالب</span><span className="font-bold">{scannedAppointment.studentName}</span></div>
                                            <div className="flex justify-between"><span>السبب</span><span className="font-bold">{scannedAppointment.visitReason}</span></div>
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        {!checkInSuccess && !error && <button onClick={confirmCheckIn} className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 shadow-lg">تأكيد الدخول</button>}
                                        <button onClick={resetScanner} className="flex-1 bg-white border border-slate-300 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-50">مسح جديد</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar: Recent Scans */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col h-full">
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Clock className="text-blue-600"/> آخر العمليات</h2>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                        {todaysVisits.filter(v => v.status === 'completed').length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                                <List size={48} className="mb-2"/>
                                <p>سجل الدخول فارغ</p>
                            </div>
                        ) : (
                            todaysVisits.filter(v => v.status === 'completed').map(v => (
                                <div key={v.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{v.parentName}</p>
                                        <p className="text-xs text-slate-500">{v.studentName}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded">تم الدخول</span>
                                        <span className="text-[10px] text-slate-400 font-mono mt-1 block">{new Date(v.arrivedAt!).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'})}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* LOG PAGE */}
        {activeView === 'log' && (
            <div className="space-y-6 animate-fade-in">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800">سجل الزوار التفصيلي</h2>
                    <button onClick={handlePrintReport} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-900 shadow-lg"><Printer size={18}/> طباعة التقرير</button>
                </div>
                
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-right">
                        <thead className="bg-slate-50 text-slate-500 font-bold text-sm">
                            <tr>
                                <th className="p-5">الزائر</th>
                                <th className="p-5">الطالب</th>
                                <th className="p-5">الموعد المحدد</th>
                                <th className="p-5">وقت الدخول الفعلي</th>
                                <th className="p-5">الحالة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {todaysVisits.map(v => (
                                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-5 font-bold text-slate-800">{v.parentName}</td>
                                    <td className="p-5 text-slate-600">{v.studentName}</td>
                                    <td className="p-5 font-mono text-slate-500">{v.slot?.startTime}</td>
                                    <td className="p-5 font-mono text-emerald-600 font-bold">{v.arrivedAt ? new Date(v.arrivedAt).toLocaleTimeString('ar-SA') : '-'}</td>
                                    <td className="p-5">
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
        )}

        {/* ANALYTICS PAGE */}
        {activeView === 'analytics' && (
            <div className="animate-fade-in max-w-3xl mx-auto">
                {!aiReport ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
                        <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                            <BrainCircuit size={40} className="text-purple-600"/>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">المحلل الأمني الذكي</h2>
                        <p className="text-slate-500 max-w-md mx-auto mb-8">سيقوم النظام بتحليل بيانات الدخول والخروج، أوقات الذروة، وأسباب الزيارة لتقديم توصيات لتحسين أمن البوابة.</p>
                        <button onClick={handleGenerateAnalysis} disabled={isAnalyzing} className="bg-purple-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg hover:bg-purple-700 transition-all flex items-center gap-2 mx-auto">
                            {isAnalyzing ? <Loader2 className="animate-spin" /> : <Sparkles size={20}/>}
                            {isAnalyzing ? 'جاري التحليل...' : 'بدء التحليل الآن'}
                        </button>
                    </div>
                ) : (
                    <div className="bg-white p-8 rounded-3xl border border-purple-100 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 to-blue-500"></div>
                        <div className="flex justify-between items-start mb-6">
                             <h2 className="text-2xl font-bold text-purple-900 flex items-center gap-3"><Sparkles className="text-amber-400"/> تقرير التحليل الذكي</h2>
                             <button onClick={() => setAiReport(null)} className="text-slate-400 hover:text-purple-600"><RefreshCw size={20}/></button>
                        </div>
                        <div className="prose prose-lg text-slate-700 leading-relaxed whitespace-pre-line font-medium">
                            {aiReport}
                        </div>
                    </div>
                )}
            </div>
        )}

    </div>
    </>
  );
};

export default GateScanner;