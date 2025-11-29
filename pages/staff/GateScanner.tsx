import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QrCode, CheckCircle, AlertCircle, Loader2, User, Clock, RefreshCw, XCircle, Printer, List, ShieldCheck, FileText } from 'lucide-react';
import { checkInVisitor, getDailyAppointments } from '../../services/storage';
import { Appointment } from '../../types';

// Declare global Html5QrcodeScanner
declare var Html5QrcodeScanner: any;

const GateScanner: React.FC = () => {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scannedAppointment, setScannedAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [todaysVisits, setTodaysVisits] = useState<Appointment[]>([]);
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

    // Initialize scanner
    if (!scannerRef.current) {
      const onScanSuccess = (decodedText: string, decodedResult: any) => {
        if (scannerRef.current) {
           scannerRef.current.clear();
        }
        setScanResult(decodedText);
        handleScanProcess(decodedText);
      };

      const onScanFailure = (error: any) => {
        // Ignore errors during scanning
      };

      setTimeout(() => {
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
      }, 500);
    }

    return () => {
        if (scannerRef.current) {
            try { scannerRef.current.clear().catch(() => {}); } catch(e) {}
            scannerRef.current = null;
        }
    };
  }, []);

  const handleScanProcess = async (appointmentId: string) => {
      setLoading(true);
      setError(null);
      try {
          const today = new Date().toISOString().split('T')[0];
          const appointments = await getDailyAppointments(today); // Refresh to be sure
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
          setError(null); // Clear any previous errors
          fetchDailyVisits(); // Refresh list
      } catch (e) {
          setError("فشل تسجيل الدخول.");
      } finally {
          setLoading(false);
      }
  };

  const resetScanner = () => {
      window.location.reload(); 
  };

  const handlePrintReport = () => {
      window.print();
  };

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
        
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                 <div className="bg-teal-50 p-3 rounded-xl text-teal-600"><ShieldCheck size={24}/></div>
                 <div>
                     <p className="text-xs text-slate-500 font-bold">زوار اليوم</p>
                     <h3 className="text-2xl font-bold text-slate-800">{stats.total}</h3>
                 </div>
             </div>
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                 <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600"><CheckCircle size={24}/></div>
                 <div>
                     <p className="text-xs text-slate-500 font-bold">تم الدخول</p>
                     <h3 className="text-2xl font-bold text-emerald-700">{stats.arrived}</h3>
                 </div>
             </div>
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-slate-50" onClick={handlePrintReport}>
                 <div className="bg-slate-100 p-3 rounded-xl text-slate-600"><Printer size={24}/></div>
                 <div>
                     <p className="text-xs text-slate-500 font-bold">طباعة التقرير</p>
                     <h3 className="text-sm font-bold text-slate-800">سجل الزوار</h3>
                 </div>
             </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SCANNER SECTION */}
            <div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 text-center h-full flex flex-col">
                    <h1 className="text-xl font-bold text-slate-900 mb-4 flex items-center justify-center gap-2">
                        <QrCode className="text-teal-600" /> ماسح البوابة الذكي
                    </h1>

                    {!scanResult ? (
                        <div className="bg-slate-50 p-2 rounded-3xl border border-slate-200 overflow-hidden flex-1 flex flex-col justify-center">
                            <div id="reader" className="w-full rounded-xl overflow-hidden"></div>
                            <p className="text-center text-xs text-slate-400 mt-2 animate-pulse">الكاميرا نشطة... بانتظار الرمز</p>
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
                                        <button onClick={resetScanner} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200">مسح جديد</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* LOG LIST */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><List size={18}/> سجل الزوار اليوم</h3>
                    <button onClick={fetchDailyVisits} className="p-1.5 bg-white rounded-lg hover:bg-slate-200"><RefreshCw size={14}/></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {todaysVisits.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                            <p>لا يوجد زوار اليوم</p>
                        </div>
                    ) : (
                        todaysVisits.map(v => (
                            <div key={v.id} className={`p-3 rounded-xl border flex justify-between items-center ${v.status === 'completed' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-100'}`}>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{v.parentName}</p>
                                    <p className="text-xs text-slate-500">{v.studentName}</p>
                                </div>
                                <div className="text-right">
                                    {v.status === 'completed' ? (
                                        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[10px] font-bold">
                                            دخل {new Date(v.arrivedAt!).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'})}
                                        </span>
                                    ) : (
                                        <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-lg text-[10px] font-bold">
                                            {v.slot?.startTime}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    </div>
    </>
  );
};

export default GateScanner;