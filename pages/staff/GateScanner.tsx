import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QrCode, CheckCircle, AlertCircle, Loader2, User, Clock, RefreshCw, XCircle, Printer, List, ShieldCheck, FileText, LayoutGrid, Sparkles, BrainCircuit, Calendar, ArrowRight, Bell } from 'lucide-react';
import { checkInVisitor, getDailyAppointments, generateSmartContent } from '../../services/storage';
import { Appointment } from '../../types';

// Declare global Html5QrcodeScanner
declare var Html5QrcodeScanner: any;

const GateScanner: React.FC = () => {
  // View State
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

  // Scanner Logic: Init only when in 'scanner' view
  useEffect(() => {
    if (activeView === 'scanner') {
        // Small timeout to ensure DOM element #reader is ready
        const timer = setTimeout(() => {
            if (!scannerRef.current) {
                const onScanSuccess = (decodedText: string, decodedResult: any) => {
                    if (scannerRef.current) {
                       scannerRef.current.clear(); // Stop scanning after success
                    }
                    setScanResult(decodedText);
                    handleScanProcess(decodedText);
                };
    
                const onScanFailure = (error: any) => {
                    // Ignore errors during scanning (frames without QR)
                };
    
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
        // Cleanup when leaving scanner view
        if (scannerRef.current) {
            try { scannerRef.current.clear().catch(() => {}); } catch(e) {}
            scannerRef.current = null;
        }
        // Reset scanner state
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
      
      // Re-init scanner if it was cleared
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
          2. ملاحظة حول طبيعة الزيارات (هل هي طارئة، إدارية، أم أولياء أمور).
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
      { id: 'scanner', title: 'ماسح البوابة', desc: 'مسح QR وتسجيل الدخول', icon: QrCode, color: 'bg-teal-500' },
      { id: 'log', title: 'سجل الزوار', desc: 'قائمة الحضور اليومية', icon: List, color: 'bg-blue-500' },
      { id: 'analytics', title: 'التقرير الذكي', desc: 'تحليل حركة البوابة (AI)', icon: Sparkles, color: 'bg-purple-500' },
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
        <div className="text-center border-b-2 border-black pb-4 mb-6">
            <h1 className="text-2xl font-bold">تقرير الزوار اليومي</h1>
            <p className="text-lg">التاريخ: {new Date().toLocaleDateString('ar-SA')}</p>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6 text-center">
             <div className="border p-2 font-bold">إجمالي المواعيد: {stats.total}</div>
             <div className="border p-2 font-bold">تم الوصول: {stats.arrived}</div>
             <div className="border p-2 font-bold">لم يصل: {stats.pending}</div>
        </div>
        <table className="w-full text-right border-collapse border border-black text-sm">
            <thead>
                <tr className="bg-gray-100">
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
        <div className="mt-8 flex justify-between">
            <p>مسؤول الأمن: .....................</p>
            <p>التوقيع: .....................</p>
        </div>
    </div>

    <div className="max-w-4xl mx-auto p-4 animate-fade-in space-y-6 no-print">
        
        {/* Header */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${activeView === 'menu' ? 'bg-slate-100 text-slate-600' : 'bg-teal-50 text-teal-600'}`}>
                   {activeView === 'menu' ? <LayoutGrid size={24} /> : 
                    activeView === 'scanner' ? <QrCode size={24} /> :
                    activeView === 'log' ? <List size={24} /> : <BrainCircuit size={24} />}
                </div>
                <div>
                   <h1 className="text-xl font-bold text-slate-900">
                       {activeView === 'menu' ? 'مكتب أمن البوابة' : 
                        activeView === 'scanner' ? 'الماسح الضوئي' :
                        activeView === 'log' ? 'سجل الزوار اليومي' : 'التحليل الذكي'}
                   </h1>
                   <p className="text-xs text-slate-500">نظام إدارة الدخول والخروج</p>
                </div>
            </div>
            {activeView !== 'menu' && (
                <button onClick={() => setActiveView('menu')} className="bg-slate-50 text-slate-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors flex items-center gap-2">
                    <LayoutGrid size={16} /> القائمة
                </button>
            )}
        </div>

        {/* MENU VIEW */}
        {activeView === 'menu' && (
            <div className="space-y-8">
                {/* Quick Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                            <Calendar size={24}/>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-bold uppercase">إجمالي الزوار</p>
                            <p className="text-2xl font-extrabold text-slate-800">{stats.total}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-4">
                        <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
                            <CheckCircle size={24}/>
                        </div>
                        <div>
                            <p className="text-xs text-emerald-600 font-bold uppercase">تم الدخول</p>
                            <p className="text-2xl font-extrabold text-emerald-700">{stats.arrived}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="bg-amber-50 p-3 rounded-xl text-amber-600">
                            <Clock size={24}/>
                        </div>
                        <div>
                            <p className="text-xs text-amber-600 font-bold uppercase">قائمة الانتظار</p>
                            <p className="text-2xl font-extrabold text-slate-800">{stats.pending}</p>
                        </div>
                    </div>
                </div>

                {/* Navigation Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {menuItems.map(item => (
                        <button 
                            key={item.id}
                            onClick={() => setActiveView(item.id as any)}
                            className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-teal-200 transition-all duration-300 text-right flex flex-col relative overflow-hidden h-48 items-start justify-between"
                        >
                            <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110 ${item.color}`}></div>
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md ${item.color} relative z-10`}>
                                <item.icon size={28} />
                            </div>
                            <div className="relative z-10 w-full">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-teal-900 transition-colors">{item.title}</h3>
                                        <p className="text-slate-500 text-sm">{item.desc}</p>
                                    </div>
                                    <ArrowRight className="text-slate-300 group-hover:text-teal-600 group-hover:translate-x-[-5px] transition-all" size={20}/>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
                
                {/* Alerts Section (Mockup) */}
                {stats.pending > 0 && (
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3 text-amber-800 animate-pulse">
                        <Bell size={20} />
                        <span className="font-bold text-sm">تنبيه: هناك {stats.pending} زوار متوقع وصولهم قريباً. يرجى الاستعداد.</span>
                    </div>
                )}
            </div>
        )}

        {/* SCANNER VIEW */}
        {activeView === 'scanner' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 text-center h-full flex flex-col">
                        {!scanResult ? (
                            <div className="bg-slate-50 p-2 rounded-3xl border border-slate-200 overflow-hidden flex-1 flex flex-col justify-center relative min-h-[300px]">
                                <div id="reader" className="w-full rounded-xl overflow-hidden"></div>
                                <p className="text-center text-xs text-slate-400 mt-4 animate-pulse absolute bottom-4 w-full">الكاميرا نشطة... بانتظار الرمز</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-3xl border border-slate-100 flex-1 flex flex-col">
                                {loading ? (
                                    <div className="py-12 text-center flex-1 flex flex-col justify-center items-center">
                                        <Loader2 className="animate-spin mx-auto text-teal-600 mb-4" size={48} />
                                        <p className="font-bold text-slate-600">جاري المعالجة...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 flex-1 flex flex-col">
                                        <div className={`text-center p-4 rounded-2xl ${checkInSuccess && !error ? 'bg-emerald-50' : error ? 'bg-red-50' : 'bg-teal-50'}`}>
                                            {error ? (
                                                <>
                                                    <XCircle className="mx-auto text-red-500 mb-2" size={40} />
                                                    <h3 className="text-lg font-bold text-red-800">تنبيه</h3>
                                                    <p className="text-sm text-red-600 mt-1">{error}</p>
                                                </>
                                            ) : checkInSuccess ? (
                                                <>
                                                    <CheckCircle className="mx-auto text-emerald-500 mb-2" size={40} />
                                                    <h3 className="text-lg font-bold text-emerald-800">تم تسجيل الدخول</h3>
                                                    <p className="text-sm text-emerald-600 mt-1">وقت الدخول: {new Date().toLocaleTimeString('ar-SA')}</p>
                                                </>
                                            ) : (
                                                <>
                                                    <AlertCircle className="mx-auto text-teal-500 mb-2" size={40} />
                                                    <h3 className="text-lg font-bold text-teal-800">بيانات صحيحة</h3>
                                                    <p className="text-sm text-teal-600 mt-1">يرجى تأكيد الدخول</p>
                                                </>
                                            )}
                                        </div>

                                        {scannedAppointment && (
                                            <div className="space-y-2 text-sm px-2">
                                                <div className="flex justify-between border-b border-slate-50 pb-2">
                                                    <span className="text-slate-500">الزائر</span>
                                                    <span className="font-bold">{scannedAppointment.parentName}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-50 pb-2">
                                                    <span className="text-slate-500">الطالب</span>
                                                    <span className="font-bold">{scannedAppointment.studentName}</span>
                                                </div>
                                                <div className="flex justify-between pb-2">
                                                    <span className="text-slate-500">السبب</span>
                                                    <span className="font-bold">{scannedAppointment.visitReason}</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-auto pt-4 flex gap-2">
                                            {!checkInSuccess && !error && (
                                                <button onClick={confirmCheckIn} className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700">تأكيد</button>
                                            )}
                                            <button onClick={resetScanner} className={`flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 ${checkInSuccess ? 'w-full' : ''}`}>
                                                {checkInSuccess ? 'مسح زائر آخر' : 'إلغاء'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Logs */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
                    <div className="p-4 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Clock size={18}/> آخر الحركات</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {todaysVisits.filter(v => v.status === 'completed').length === 0 ? (
                            <div className="text-center py-10 text-slate-400">لا يوجد عمليات دخول بعد</div>
                        ) : (
                            todaysVisits.filter(v => v.status === 'completed').map(v => (
                                <div key={v.id} className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/30 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{v.parentName}</p>
                                        <p className="text-xs text-slate-500">{v.studentName}</p>
                                    </div>
                                    <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[10px] font-bold">
                                        {new Date(v.arrivedAt!).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* LOG VIEW */}
        {activeView === 'log' && (
            <div className="space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
                    <h2 className="font-bold text-slate-800">قائمة زوار اليوم</h2>
                    <button onClick={handlePrintReport} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-900">
                        <Printer size={16}/> طباعة التقرير
                    </button>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold">
                            <tr>
                                <th className="p-4">الزائر</th>
                                <th className="p-4">الطالب</th>
                                <th className="p-4">الوقت</th>
                                <th className="p-4">الحالة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {todaysVisits.map(v => (
                                <tr key={v.id} className="hover:bg-slate-50">
                                    <td className="p-4 font-bold text-slate-800">{v.parentName}</td>
                                    <td className="p-4 text-slate-600">{v.studentName}</td>
                                    <td className="p-4 font-mono text-slate-500">{v.slot?.startTime}</td>
                                    <td className="p-4">
                                        {v.status === 'completed' ? (
                                            <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">تم الدخول</span>
                                        ) : (
                                            <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-xs font-bold">لم يصل</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* ANALYTICS VIEW */}
        {activeView === 'analytics' && (
            <div className="space-y-6">
                 {!aiReport ? (
                    <div className="text-center py-12 bg-white rounded-3xl border border-slate-200">
                        <BrainCircuit size={48} className="mx-auto mb-4 text-purple-500 animate-pulse"/>
                        <h3 className="font-bold text-slate-800 text-lg">تحليل حركة البوابة الذكي</h3>
                        <p className="text-slate-500 max-w-xs mx-auto mt-2 text-sm">استخدام الذكاء الاصطناعي لتحليل أوقات الذروة وأسباب الزيارات.</p>
                        <button onClick={handleGenerateAnalysis} disabled={isAnalyzing} className="mt-6 bg-purple-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-purple-700 transition-all flex items-center gap-2 mx-auto">
                            {isAnalyzing ? <Loader2 className="animate-spin" size={20}/> : <Sparkles size={20}/>}
                            بدء التحليل
                        </button>
                    </div>
                ) : (
                    <div className="bg-white p-6 rounded-3xl border border-purple-100 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-teal-500"></div>
                        <h3 className="font-bold text-purple-800 mb-4 flex items-center gap-2"><Sparkles size={18}/> تقرير الأمن والسلامة</h3>
                        <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed whitespace-pre-line font-medium">
                            {aiReport}
                        </div>
                        <button onClick={() => setAiReport(null)} className="mt-6 text-slate-400 text-xs hover:text-purple-600 flex items-center gap-1">
                            <RefreshCw size={12}/> إعادة التحليل
                        </button>
                    </div>
                )}
            </div>
        )}
    </div>
    </>
  );
};

export default GateScanner;