import React, { useState, useEffect, useRef } from 'react';
import { QrCode, CheckCircle, AlertCircle, Loader2, User, Clock, RefreshCw, XCircle } from 'lucide-react';
import { checkInVisitor, getDailyAppointments } from '../../services/storage';
import { Appointment } from '../../types';

// Declare global Html5QrcodeScanner as it comes from script tag
declare var Html5QrcodeScanner: any;

const GateScanner: React.FC = () => {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scannedAppointment, setScannedAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    // Initialize scanner only if not already initialized
    if (!scannerRef.current) {
      const onScanSuccess = (decodedText: string, decodedResult: any) => {
        // Stop scanning temporarily
        if (scannerRef.current) {
           scannerRef.current.clear();
        }
        setScanResult(decodedText);
        handleScanProcess(decodedText);
      };

      const onScanFailure = (error: any) => {
        // handle scan failure, usually better to ignore and keep scanning
        // console.warn(`Code scan error = ${error}`);
      };

      // Use a timeout to ensure DOM is ready
      setTimeout(() => {
          try {
            const html5QrcodeScanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: { width: 250, height: 250 } },
                /* verbose= */ false
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
            try {
                scannerRef.current.clear().catch((err: any) => console.error(err));
            } catch(e) {}
            scannerRef.current = null;
        }
    };
  }, []); // Run once

  const handleScanProcess = async (appointmentId: string) => {
      setLoading(true);
      setError(null);
      try {
          // 1. Fetch Today's Appointments to verify
          const today = new Date().toISOString().split('T')[0];
          const appointments = await getDailyAppointments(today);
          
          const found = appointments.find((a: any) => a.id === appointmentId);
          
          if (found) {
              setScannedAppointment(found);
              if (found.status === 'completed') {
                  setCheckInSuccess(true); // Already checked in
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
      setLoading(true);
      try {
          await checkInVisitor(scannedAppointment.id);
          setCheckInSuccess(true);
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
      window.location.reload(); // Simplest way to restart the library correctly
  };

  return (
    <div className="max-w-md mx-auto p-4 animate-fade-in space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 text-center">
            <h1 className="text-2xl font-bold text-slate-900 mb-2 flex items-center justify-center gap-2">
                <QrCode className="text-teal-600" /> بوابة الأمن - ماسح الزوار
            </h1>
            <p className="text-slate-500 text-sm">قم بمسح رمز QR الخاص بولي الأمر لتسجيل الدخول</p>
        </div>

        {!scanResult ? (
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div id="reader" className="w-full"></div>
                <p className="text-center text-xs text-slate-400 mt-4">وجه الكاميرا نحو الرمز</p>
            </div>
        ) : (
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200 animate-fade-in-up">
                {loading ? (
                    <div className="py-12 text-center">
                        <Loader2 className="animate-spin mx-auto text-teal-600 mb-4" size={48} />
                        <p className="font-bold text-slate-600">جاري التحقق من البيانات...</p>
                    </div>
                ) : error ? (
                    <div className="text-center py-8">
                        <XCircle className="mx-auto text-red-500 mb-4" size={64} />
                        <h3 className="text-xl font-bold text-red-700 mb-2">خطأ في المسح</h3>
                        <p className="text-slate-600 mb-6">{error}</p>
                        <button onClick={resetScanner} className="bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-bold w-full">مسح جديد</button>
                    </div>
                ) : scannedAppointment ? (
                    <div className="space-y-6">
                        <div className={`text-center p-4 rounded-2xl ${checkInSuccess ? 'bg-emerald-50' : 'bg-teal-50'}`}>
                            {checkInSuccess ? (
                                <>
                                    <CheckCircle className="mx-auto text-emerald-500 mb-2" size={48} />
                                    <h3 className="text-xl font-bold text-emerald-800">تم تسجيل الدخول</h3>
                                    <p className="text-sm text-emerald-600 mt-1">أهلاً وسهلاً بالزائر</p>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="mx-auto text-teal-500 mb-2" size={48} />
                                    <h3 className="text-xl font-bold text-teal-800">بيانات الحجز صحيحة</h3>
                                    <p className="text-sm text-teal-600 mt-1">يرجى تأكيد الدخول أدناه</p>
                                </>
                            )}
                        </div>

                        <div className="space-y-4 border-t border-slate-100 pt-4">
                            <div className="flex justify-between">
                                <span className="text-slate-500 text-sm">اسم ولي الأمر</span>
                                <span className="font-bold text-slate-800">{scannedAppointment.parentName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 text-sm">الطالب</span>
                                <span className="font-bold text-slate-800">{scannedAppointment.studentName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 text-sm">وقت الموعد</span>
                                <span className="font-bold text-slate-800 font-mono">{scannedAppointment.slot?.startTime}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 text-sm">سبب الزيارة</span>
                                <span className="font-bold text-slate-800">{scannedAppointment.visitReason}</span>
                            </div>
                        </div>

                        <div className="pt-4 flex gap-3">
                            {!checkInSuccess ? (
                                <button onClick={confirmCheckIn} className="flex-1 bg-teal-600 text-white py-4 rounded-xl font-bold hover:bg-teal-700 shadow-lg shadow-teal-600/20 transition-all">تأكيد الدخول</button>
                            ) : null}
                            <button onClick={resetScanner} className={`flex-1 bg-slate-100 text-slate-700 py-4 rounded-xl font-bold hover:bg-slate-200 transition-all ${checkInSuccess ? 'w-full' : ''}`}>
                                {checkInSuccess ? 'مسح زائر آخر' : 'إلغاء'}
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        )}
    </div>
  );
};

export default GateScanner;